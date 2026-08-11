import { Button } from '@/components/ui/button';
import { SamlPanel } from '@/components/tool-expansion-panels';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { StringParam, useQueryParam } from '@/hooks/useQueryParams';
import { generatePkce, parseOAuthCallback } from '@/lib/next-tools';
import { createFileRoute } from '@tanstack/react-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

export const Route = createFileRoute('/oauth')({ component: OAuthPage });

function OAuthPage() {
  const { t } = useTranslation();
  const [tab, setTab] = useQueryParam<'pkce' | 'callback' | 'saml'>(
    'tab',
    StringParam,
    'pkce',
  );
  const [authorizationEndpoint, setAuthorizationEndpoint] = useState(
    'https://example.com/oauth/authorize',
  );
  const [clientId, setClientId] = useState('');
  const [redirectUri, setRedirectUri] = useState('https://localhost/callback');
  const [scope, setScope] = useState('openid profile email');
  const [output, setOutput] = useState('');
  const [callback, setCallback] = useState(
    'https://localhost/callback?code=example&state=state',
  );
  const [error, setError] = useState<string | null>(null);

  const create = async () => {
    setError(null);
    try {
      const pkce = await generatePkce();
      const url = new URL(authorizationEndpoint);
      url.search = new URLSearchParams({
        response_type: 'code',
        client_id: clientId,
        redirect_uri: redirectUri,
        scope,
        code_challenge: pkce.challenge,
        code_challenge_method: 'S256',
        state: pkce.state,
        nonce: pkce.nonce,
      }).toString();
      setOutput(
        JSON.stringify({ authorizationUrl: url.toString(), ...pkce }, null, 2),
      );
    } catch (cause) {
      setError(t('oauth.failed', { msg: (cause as Error).message }));
    }
  };
  const parse = () => {
    setError(null);
    try {
      setOutput(JSON.stringify(parseOAuthCallback(callback), null, 2));
    } catch (cause) {
      setError(t('oauth.failed', { msg: (cause as Error).message }));
    }
  };

  return (
    <div className="mx-auto max-w-5xl space-y-5 px-4 py-6">
      <h1 className="text-2xl font-bold">{t('oauth.title')}</h1>
      <Tabs
        value={tab}
        onValueChange={(value) => setTab(value as 'pkce' | 'callback' | 'saml')}
      >
        <TabsList>
          <TabsTrigger value="pkce">PKCE</TabsTrigger>
          <TabsTrigger value="callback">{t('oauth.callback')}</TabsTrigger>
          <TabsTrigger value="saml">SAML 2.0</TabsTrigger>
        </TabsList>
      </Tabs>
      {tab === 'pkce' ? (
        <div className="space-y-3">
          <Input
            value={authorizationEndpoint}
            onChange={(event) => setAuthorizationEndpoint(event.target.value)}
            placeholder={t('oauth.endpoint')}
          />
          <Input
            value={clientId}
            onChange={(event) => setClientId(event.target.value)}
            placeholder="Client ID"
          />
          <Input
            value={redirectUri}
            onChange={(event) => setRedirectUri(event.target.value)}
            placeholder="Redirect URI"
          />
          <Input
            value={scope}
            onChange={(event) => setScope(event.target.value)}
            placeholder="Scope"
          />
          <Button
            disabled={!authorizationEndpoint || !clientId}
            onClick={() => void create()}
          >
            {t('oauth.generate')}
          </Button>
        </div>
      ) : tab === 'callback' ? (
        <div className="space-y-3">
          <Textarea
            value={callback}
            onChange={(event) => setCallback(event.target.value)}
            className="min-h-28 font-mono text-xs"
          />
          <Button onClick={parse}>{t('oauth.parse')}</Button>
        </div>
      ) : (
        <SamlPanel />
      )}
      {tab !== 'saml' && (
        <>
          <Textarea
            readOnly
            value={output}
            className="min-h-80 font-mono text-xs"
          />
          {error && <p className="text-sm text-destructive">{error}</p>}
        </>
      )}
    </div>
  );
}
