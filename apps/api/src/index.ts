import type { Context } from 'hono';
import type { D1Database } from '@cloudflare/workers-types';
import { Hono } from 'hono';
import { deleteCookie, getCookie, setCookie } from 'hono/cookie';
import { cors } from 'hono/cors';
import { validator } from 'hono/validator';
import { hashPassword, hashToken, randomToken, verifyPassword } from './auth';

type Bindings = {
  APP_ORIGIN: string;
  DB: D1Database;
  GITHUB_CALLBACK_URL: string;
  GITHUB_CLIENT_ID: string;
  GITHUB_CLIENT_SECRET: string;
};

type WorkerEnv = { Bindings: Bindings };

type UserRow = {
  avatar_url: string | null;
  email: string;
  github_id: string | null;
  id: string;
  name: string;
  password_hash: string | null;
  password_salt: string | null;
};

type PublicUser = Pick<UserRow, 'avatar_url' | 'id' | 'name'>;

type GitHubEmail = {
  email: string;
  primary: boolean;
  verified: boolean;
};

const SESSION_COOKIE = 'tools_session';
const OAUTH_STATE_COOKIE = 'tools_github_state';
const SESSION_SECONDS = 60 * 60 * 24 * 30;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const app = new Hono<WorkerEnv>().basePath('/api');

app.use('*', async (c, next) =>
  cors({
    origin: c.env.APP_ORIGIN,
    allowHeaders: ['Content-Type'],
    allowMethods: ['GET', 'POST', 'OPTIONS'],
    credentials: true,
  })(c, next),
);

app.onError((error, c) => {
  console.error(error);
  return c.json({ error: '服务暂时不可用' }, 500);
});

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function isToolPath(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    value.length <= 100 &&
    /^\/[a-z0-9-]+$/.test(value)
  );
}

export function toPublicUser(user: UserRow): PublicUser {
  return {
    avatar_url: user.avatar_url,
    id: user.id,
    name: user.name,
  };
}

export function maskEmail(email: string): string {
  const at = email.lastIndexOf('@');
  if (at <= 0) return '*******';
  return `${email[0]}*******${email.slice(at)}`;
}

function cookieOptions(c: Context<WorkerEnv>, maxAge: number) {
  return {
    httpOnly: true,
    maxAge,
    path: '/',
    sameSite: 'Lax' as const,
    secure: new URL(c.req.url).protocol === 'https:',
  };
}

async function createSession(c: Context<WorkerEnv>, userId: string) {
  const token = randomToken();
  const now = Date.now();
  await c.env.DB.prepare(
    'INSERT INTO sessions (token_hash, user_id, expires_at, created_at) VALUES (?, ?, ?, ?)',
  )
    .bind(await hashToken(token), userId, now + SESSION_SECONDS * 1000, now)
    .run();
  setCookie(c, SESSION_COOKIE, token, cookieOptions(c, SESSION_SECONDS));
}

async function currentUser(c: Context<WorkerEnv>): Promise<UserRow | null> {
  const token = getCookie(c, SESSION_COOKIE);
  if (!token) return null;

  return c.env.DB.prepare(
    `SELECT users.id, users.email, users.name, users.avatar_url,
            users.password_hash, users.password_salt, users.github_id
       FROM sessions
       JOIN users ON users.id = sessions.user_id
      WHERE sessions.token_hash = ? AND sessions.expires_at > ?`,
  )
    .bind(await hashToken(token), Date.now())
    .first<UserRow>();
}

const registerInput = validator('json', (value, c) => {
  if (!isRecord(value)) return c.json({ error: '请求格式错误' }, 400);

  const email =
    typeof value.email === 'string' ? value.email.trim().toLowerCase() : '';
  const password = typeof value.password === 'string' ? value.password : '';
  const name = typeof value.name === 'string' ? value.name.trim() : '';

  if (!EMAIL_PATTERN.test(email) || email.length > 254) {
    return c.json({ error: '邮箱格式错误' }, 400);
  }
  if (password.length < 8 || password.length > 128) {
    return c.json({ error: '密码长度必须为 8 到 128 位' }, 400);
  }
  if (name.length > 80) {
    return c.json({ error: '名称不能超过 80 个字符' }, 400);
  }

  return { email, name: name || email.split('@')[0], password };
});

const loginInput = validator('json', (value, c) => {
  if (!isRecord(value)) return c.json({ error: '请求格式错误' }, 400);

  const email =
    typeof value.email === 'string' ? value.email.trim().toLowerCase() : '';
  const password = typeof value.password === 'string' ? value.password : '';

  if (!EMAIL_PATTERN.test(email) || password.length > 128) {
    return c.json({ error: '邮箱或密码错误' }, 401);
  }
  return { email, password };
});

const passwordInput = validator('json', (value, c) => {
  if (!isRecord(value)) return c.json({ error: '请求格式错误' }, 400);

  const currentPassword =
    typeof value.currentPassword === 'string' ? value.currentPassword : '';
  const newPassword =
    typeof value.newPassword === 'string' ? value.newPassword : '';

  if (
    currentPassword.length > 128 ||
    newPassword.length < 8 ||
    newPassword.length > 128
  ) {
    return c.json({ error: '密码格式错误' }, 400);
  }
  return { currentPassword, newPassword };
});

const favoriteInput = validator('json', (value, c) => {
  if (
    !isRecord(value) ||
    !isToolPath(value.path) ||
    typeof value.favorite !== 'boolean'
  ) {
    return c.json({ error: '收藏参数错误' }, 400);
  }
  return { favorite: value.favorite, path: value.path };
});

const favoriteOrderInput = validator('json', (value, c) => {
  if (!isRecord(value) || !Array.isArray(value.paths)) {
    return c.json({ error: '收藏排序参数错误' }, 400);
  }

  const paths = value.paths;
  if (
    paths.length > 100 ||
    paths.some((path) => !isToolPath(path)) ||
    new Set(paths).size !== paths.length
  ) {
    return c.json({ error: '收藏排序参数错误' }, 400);
  }
  return { paths };
});

const routes = app
  .get('/health', (c) => c.json({ ok: true }))
  .post('/auth/register', registerInput, async (c) => {
    const input = c.req.valid('json');
    const existing = await c.env.DB.prepare(
      'SELECT id FROM users WHERE email = ?',
    )
      .bind(input.email)
      .first<{ id: string }>();
    if (existing) return c.json({ error: '该邮箱已注册' }, 409);

    const id = crypto.randomUUID();
    const now = Date.now();
    const password = await hashPassword(input.password);

    try {
      await c.env.DB.prepare(
        `INSERT INTO users
          (id, email, name, password_hash, password_salt, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      )
        .bind(
          id,
          input.email,
          input.name,
          password.hash,
          password.salt,
          now,
          now,
        )
        .run();
    } catch (error) {
      if (String(error).includes('UNIQUE')) {
        return c.json({ error: '该邮箱已注册' }, 409);
      }
      throw error;
    }

    await createSession(c, id);
    return c.json(
      {
        user: {
          avatar_url: null,
          id,
          name: input.name,
        },
      },
      201,
    );
  })
  .post('/auth/login', loginInput, async (c) => {
    const input = c.req.valid('json');
    const user = await c.env.DB.prepare(
      `SELECT id, email, name, avatar_url, password_hash, password_salt,
              github_id
         FROM users WHERE email = ?`,
    )
      .bind(input.email)
      .first<UserRow>();

    if (
      !user?.password_hash ||
      !user.password_salt ||
      !(await verifyPassword(
        input.password,
        user.password_hash,
        user.password_salt,
      ))
    ) {
      return c.json({ error: '邮箱或密码错误' }, 401);
    }

    await createSession(c, user.id);
    return c.json({ user: toPublicUser(user) });
  })
  .post('/auth/logout', async (c) => {
    const token = getCookie(c, SESSION_COOKIE);
    if (token) {
      await c.env.DB.prepare('DELETE FROM sessions WHERE token_hash = ?')
        .bind(await hashToken(token))
        .run();
    }
    deleteCookie(c, SESSION_COOKIE, { path: '/' });
    return c.json({ ok: true });
  })
  .get('/auth/me', async (c) => {
    const user = await currentUser(c);
    if (!user) return c.json({ error: '未登录' }, 401);
    return c.json({ user: toPublicUser(user) });
  })
  .get('/auth/settings', async (c) => {
    const user = await currentUser(c);
    if (!user) return c.json({ error: '未登录' }, 401);
    return c.json({
      account: {
        connections: { github: Boolean(user.github_id) },
        has_password: Boolean(user.password_hash && user.password_salt),
        masked_email: maskEmail(user.email),
      },
    });
  })
  .post('/auth/password', passwordInput, async (c) => {
    const user = await currentUser(c);
    if (!user) return c.json({ error: '未登录' }, 401);

    const input = c.req.valid('json');
    if (
      user.password_hash &&
      user.password_salt &&
      !(await verifyPassword(
        input.currentPassword,
        user.password_hash,
        user.password_salt,
      ))
    ) {
      return c.json({ error: '当前密码错误' }, 403);
    }

    const password = await hashPassword(input.newPassword);
    await c.env.DB.prepare(
      `UPDATE users
          SET password_hash = ?, password_salt = ?, updated_at = ?
        WHERE id = ?`,
    )
      .bind(password.hash, password.salt, Date.now(), user.id)
      .run();

    const token = getCookie(c, SESSION_COOKIE);
    if (token) {
      await c.env.DB.prepare(
        'DELETE FROM sessions WHERE user_id = ? AND token_hash <> ?',
      )
        .bind(user.id, await hashToken(token))
        .run();
    }
    return c.json({ ok: true });
  })
  .get('/favorites', async (c) => {
    const user = await currentUser(c);
    if (!user) return c.json({ error: '未登录' }, 401);

    const rows = await c.env.DB.prepare(
      `SELECT tool_path
         FROM favorites
        WHERE user_id = ?
        ORDER BY sort_order, created_at`,
    )
      .bind(user.id)
      .all<{ tool_path: string }>();
    return c.json({ favorites: rows.results.map((row) => row.tool_path) });
  })
  .post('/favorites', favoriteInput, async (c) => {
    const user = await currentUser(c);
    if (!user) return c.json({ error: '未登录' }, 401);

    const input = c.req.valid('json');
    if (input.favorite) {
      await c.env.DB.prepare(
        `INSERT INTO favorites (user_id, tool_path, sort_order, created_at)
         SELECT ?, ?, COALESCE(MAX(sort_order), -1) + 1, ?
           FROM favorites
          WHERE user_id = ?
         ON CONFLICT(user_id, tool_path) DO NOTHING`,
      )
        .bind(user.id, input.path, Date.now(), user.id)
        .run();
    } else {
      await c.env.DB.prepare(
        'DELETE FROM favorites WHERE user_id = ? AND tool_path = ?',
      )
        .bind(user.id, input.path)
        .run();
    }
    return c.json({ favorite: input.favorite });
  })
  .put('/favorites/order', favoriteOrderInput, async (c) => {
    const user = await currentUser(c);
    if (!user) return c.json({ error: '未登录' }, 401);

    const { paths } = c.req.valid('json');
    if (paths.length > 0) {
      await c.env.DB.batch(
        paths.map((path, sortOrder) =>
          c.env.DB.prepare(
            `UPDATE favorites
                SET sort_order = ?
              WHERE user_id = ? AND tool_path = ?`,
          ).bind(sortOrder, user.id, path),
        ),
      );
    }
    return c.json({ ok: true });
  })
  .get('/auth/github', (c) => {
    if (!c.env.GITHUB_CLIENT_ID || !c.env.GITHUB_CALLBACK_URL) {
      return c.json({ error: 'GitHub 登录未配置' }, 503);
    }

    const state = randomToken(24);
    setCookie(c, OAUTH_STATE_COOKIE, state, cookieOptions(c, 10 * 60));

    const query = new URLSearchParams({
      client_id: c.env.GITHUB_CLIENT_ID,
      redirect_uri: c.env.GITHUB_CALLBACK_URL,
      scope: 'read:user user:email',
      state,
    });
    return c.redirect(`https://github.com/login/oauth/authorize?${query}`);
  })
  .get('/auth/github/callback', async (c) => {
    const code = c.req.query('code');
    const state = c.req.query('state');
    const storedState = getCookie(c, OAUTH_STATE_COOKIE);
    deleteCookie(c, OAUTH_STATE_COOKIE, { path: '/' });

    if (!code || !state || !storedState || state !== storedState) {
      return c.json({ error: 'GitHub 登录状态无效' }, 400);
    }

    const tokenResponse = await fetch(
      'https://github.com/login/oauth/access_token',
      {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          client_id: c.env.GITHUB_CLIENT_ID,
          client_secret: c.env.GITHUB_CLIENT_SECRET,
          code,
          redirect_uri: c.env.GITHUB_CALLBACK_URL,
        }),
      },
    );
    const tokenPayload: unknown = await tokenResponse.json();
    if (
      !tokenResponse.ok ||
      !isRecord(tokenPayload) ||
      typeof tokenPayload.access_token !== 'string'
    ) {
      return c.json({ error: 'GitHub 授权失败' }, 401);
    }

    const githubHeaders = {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${tokenPayload.access_token}`,
      'User-Agent': 'tools-api',
      'X-GitHub-Api-Version': '2022-11-28',
    };
    const [profileResponse, emailsResponse] = await Promise.all([
      fetch('https://api.github.com/user', { headers: githubHeaders }),
      fetch('https://api.github.com/user/emails', { headers: githubHeaders }),
    ]);
    const profile: unknown = await profileResponse.json();
    const emails: unknown = await emailsResponse.json();

    if (
      !profileResponse.ok ||
      !emailsResponse.ok ||
      !isRecord(profile) ||
      typeof profile.id !== 'number' ||
      typeof profile.login !== 'string' ||
      !Array.isArray(emails)
    ) {
      return c.json({ error: '无法读取 GitHub 用户信息' }, 401);
    }

    const verifiedEmails = emails.filter(
      (entry): entry is GitHubEmail =>
        isRecord(entry) &&
        typeof entry.email === 'string' &&
        typeof entry.primary === 'boolean' &&
        entry.verified === true,
    );
    const email = (
      verifiedEmails.find((entry) => entry.primary) ?? verifiedEmails[0]
    )?.email.toLowerCase();
    if (!email) return c.json({ error: 'GitHub 账号没有已验证邮箱' }, 400);

    const githubId = String(profile.id);
    let user = await c.env.DB.prepare(
      `SELECT id, email, name, avatar_url, password_hash, password_salt,
              github_id
         FROM users WHERE github_id = ?`,
    )
      .bind(githubId)
      .first<UserRow>();

    if (!user) {
      user = await c.env.DB.prepare(
        `SELECT id, email, name, avatar_url, password_hash, password_salt,
                github_id
           FROM users WHERE email = ?`,
      )
        .bind(email)
        .first<UserRow>();

      if (user?.github_id && user.github_id !== githubId) {
        return c.json({ error: '该邮箱已绑定其他 GitHub 账号' }, 409);
      }

      const avatarUrl =
        typeof profile.avatar_url === 'string' ? profile.avatar_url : null;
      const displayName =
        typeof profile.name === 'string' && profile.name.trim()
          ? profile.name.trim()
          : profile.login;
      const now = Date.now();

      if (user) {
        await c.env.DB.prepare(
          `UPDATE users
              SET github_id = ?, avatar_url = COALESCE(avatar_url, ?),
                  updated_at = ?
            WHERE id = ?`,
        )
          .bind(githubId, avatarUrl, now, user.id)
          .run();
        user = {
          ...user,
          avatar_url: user.avatar_url ?? avatarUrl,
          github_id: githubId,
        };
      } else {
        const id = crypto.randomUUID();
        await c.env.DB.prepare(
          `INSERT INTO users
            (id, email, name, github_id, avatar_url, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
        )
          .bind(id, email, displayName, githubId, avatarUrl, now, now)
          .run();
        user = {
          avatar_url: avatarUrl,
          email,
          github_id: githubId,
          id,
          name: displayName,
          password_hash: null,
          password_salt: null,
        };
      }
    }

    await createSession(c, user.id);
    return c.redirect(new URL('/', c.env.APP_ORIGIN).toString());
  });

export type AppType = typeof routes;
export default app;
