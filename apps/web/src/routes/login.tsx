import { StringParam, useQueryParam } from '@/hooks/useQueryParams';
import { setAuthAuthenticated } from '@/hooks/useAuthSession';
import { api } from '@/lib/api';
import { createFileRoute } from '@tanstack/react-router';
import { Github, LoaderCircle, LogIn, UserPlus } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '../components/ui/button';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Separator } from '../components/ui/separator';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '../components/ui/tabs';

export const Route = createFileRoute('/login')({ component: LoginPage });

type AuthTab = 'login' | 'register';

function LoginPage() {
  const { t } = useTranslation();
  const [tab, setTab] = useQueryParam<AuthTab>('tab', StringParam, 'login');
  const [redirect] = useQueryParam('redirect', StringParam, '/');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const safeRedirect =
    redirect.startsWith('/') && !redirect.startsWith('//') ? redirect : '/';

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const response =
        tab === 'login'
          ? await api.auth.login.$post({ json: { email, password } })
          : await api.auth.register.$post({
              json: { email, name, password },
            });

      if (!response.ok) {
        const key =
          response.status === 409
            ? 'auth.emailExists'
            : response.status === 401
              ? 'auth.invalidCredentials'
              : response.status === 400
                ? 'auth.invalidInput'
                : 'auth.errorDefault';
        setError(t(key));
        return;
      }

      const body = await response.json();
      setAuthAuthenticated(body.user);
      window.location.assign(safeRedirect);
    } catch {
      setError(t('auth.errorDefault'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-3.5rem)] flex items-center justify-center px-4 py-10">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">{t('auth.title')}</CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs
            value={tab}
            onValueChange={(value) => {
              setTab(value as AuthTab);
              setError(null);
            }}
          >
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="login">{t('auth.loginTab')}</TabsTrigger>
              <TabsTrigger value="register">
                {t('auth.registerTab')}
              </TabsTrigger>
            </TabsList>

            <form onSubmit={submit} className="mt-6 space-y-4">
              <TabsContent value="register" className="mt-0">
                <div className="space-y-2">
                  <Label htmlFor="auth-name">{t('auth.name')}</Label>
                  <Input
                    id="auth-name"
                    name="name"
                    autoComplete="name"
                    maxLength={80}
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    placeholder={t('auth.namePlaceholder')}
                  />
                </div>
              </TabsContent>

              <div className="space-y-2">
                <Label htmlFor="auth-email">{t('auth.email')}</Label>
                <Input
                  id="auth-email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  maxLength={254}
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="you@example.com"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="auth-password">{t('auth.password')}</Label>
                <Input
                  id="auth-password"
                  name="password"
                  type="password"
                  autoComplete={
                    tab === 'login' ? 'current-password' : 'new-password'
                  }
                  required
                  minLength={8}
                  maxLength={128}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder={t('auth.passwordPlaceholder')}
                />
              </div>

              {error && (
                <div
                  role="alert"
                  className="text-destructive text-sm bg-destructive/10 border border-destructive/30 rounded-md px-3 py-2"
                >
                  {error}
                </div>
              )}

              <Button className="w-full" type="submit" disabled={loading}>
                {loading ? (
                  <LoaderCircle className="animate-spin" />
                ) : tab === 'login' ? (
                  <LogIn />
                ) : (
                  <UserPlus />
                )}
                {t(
                  tab === 'login' ? 'auth.loginButton' : 'auth.registerButton',
                )}
              </Button>
            </form>
          </Tabs>

          <div className="my-6 flex items-center gap-3">
            <Separator className="flex-1" />
            <span className="text-xs text-muted-foreground">
              {t('auth.or')}
            </span>
            <Separator className="flex-1" />
          </div>

          <Button
            type="button"
            variant="outline"
            className="w-full"
            onClick={() => window.location.assign(api.auth.github.$path())}
          >
            <Github />
            {t('auth.githubButton')}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
