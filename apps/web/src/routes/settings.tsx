import { setAuthGuest, useAuthSession } from '@/hooks/useAuthSession';
import { api } from '@/lib/api';
import { useQuery } from '@tanstack/react-query';
import { createFileRoute, Link } from '@tanstack/react-router';
import {
  AtSign,
  CheckCircle2,
  Github,
  KeyRound,
  LoaderCircle,
  ShieldCheck,
} from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '../components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';

export const Route = createFileRoute('/settings')({ component: SettingsPage });

type AccountSettings = {
  connections: { github: boolean };
  has_password: boolean;
  masked_email: string;
};

function SettingsPage() {
  const { t } = useTranslation();
  const session = useAuthSession();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const settings = useQuery({
    queryKey: ['auth', 'settings'],
    enabled: session.status === 'authenticated',
    retry: false,
    queryFn: async (): Promise<AccountSettings> => {
      const response = await api.auth.settings.$get();
      if (response.status === 401) {
        setAuthGuest();
        throw new Error('unauthorized');
      }
      if (!response.ok) throw new Error('settings failed');
      return (await response.json()).account;
    },
  });

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setSuccess(false);

    if (newPassword !== confirmPassword) {
      setError(t('settingsPage.passwordMismatch'));
      return;
    }

    setSaving(true);
    try {
      const response = await api.auth.password.$post({
        json: {
          currentPassword,
          newPassword,
        },
      });
      if (!response.ok) {
        setError(
          t(
            response.status === 403
              ? 'settingsPage.currentPasswordError'
              : response.status === 400
                ? 'settingsPage.passwordInvalid'
                : 'settingsPage.saveError',
          ),
        );
        return;
      }

      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setSuccess(true);
      await settings.refetch();
    } catch {
      setError(t('settingsPage.saveError'));
    } finally {
      setSaving(false);
    }
  };

  if (session.status === 'loading') {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <LoaderCircle className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (session.status === 'guest') {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center">
        <ShieldCheck className="mx-auto h-10 w-10 text-blue-600" />
        <h1 className="mt-4 text-2xl font-bold">
          {t('settingsPage.loginRequired')}
        </h1>
        <Button asChild className="mt-6">
          <Link to="/login" search={{ redirect: '/settings' }}>
            {t('auth.navLogin')}
          </Link>
        </Button>
      </div>
    );
  }

  const account = settings.data;

  return (
    <div className="mx-auto max-w-4xl space-y-6 px-4 py-8 sm:px-6 lg:px-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">
          {t('settingsPage.title')}
        </h1>
        <p className="mt-2 text-muted-foreground">
          {t('settingsPage.description')}
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>{t('settingsPage.accountTitle')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="flex items-center gap-3 rounded-xl border p-4">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-500/10 text-blue-600">
                <AtSign className="h-5 w-5" />
              </span>
              <div>
                <p className="text-xs text-muted-foreground">
                  {t('settingsPage.email')}
                </p>
                <p className="font-medium">
                  {account?.masked_email ?? t('settingsPage.loading')}
                </p>
              </div>
            </div>

            <div>
              <p className="mb-3 text-sm font-medium">
                {t('settingsPage.connections')}
              </p>
              <div className="flex items-center gap-3 rounded-xl border p-4">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-foreground/5">
                  <Github className="h-5 w-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-medium">GitHub</p>
                  <p className="text-xs text-muted-foreground">
                    {account?.connections.github
                      ? t('settingsPage.connected')
                      : t('settingsPage.notConnected')}
                  </p>
                </div>
                {account?.connections.github && (
                  <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t('settingsPage.passwordTitle')}</CardTitle>
            <CardDescription>
              {account?.has_password
                ? t('settingsPage.changePasswordDescription')
                : t('settingsPage.setPasswordDescription')}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={submit} className="space-y-4">
              {account?.has_password && (
                <div className="space-y-2">
                  <Label htmlFor="current-password">
                    {t('settingsPage.currentPassword')}
                  </Label>
                  <Input
                    id="current-password"
                    type="password"
                    autoComplete="current-password"
                    required
                    maxLength={128}
                    value={currentPassword}
                    onChange={(event) => setCurrentPassword(event.target.value)}
                  />
                </div>
              )}
              <div className="space-y-2">
                <Label htmlFor="new-password">
                  {t('settingsPage.newPassword')}
                </Label>
                <Input
                  id="new-password"
                  type="password"
                  autoComplete="new-password"
                  required
                  minLength={8}
                  maxLength={128}
                  value={newPassword}
                  onChange={(event) => setNewPassword(event.target.value)}
                  placeholder={t('auth.passwordPlaceholder')}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirm-password">
                  {t('settingsPage.confirmPassword')}
                </Label>
                <Input
                  id="confirm-password"
                  type="password"
                  autoComplete="new-password"
                  required
                  minLength={8}
                  maxLength={128}
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                />
              </div>

              {error && (
                <div
                  role="alert"
                  className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
                >
                  {error}
                </div>
              )}
              {success && (
                <div className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-600">
                  {t('settingsPage.saveSuccess')}
                </div>
              )}

              <Button
                type="submit"
                className="w-full"
                disabled={saving || !account}
              >
                {saving ? (
                  <LoaderCircle className="animate-spin" />
                ) : (
                  <KeyRound />
                )}
                {account?.has_password
                  ? t('settingsPage.changePassword')
                  : t('settingsPage.setPassword')}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
