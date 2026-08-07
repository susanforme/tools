import { jwkInfo, jwkToPem, verifyJwtWithJwk, type PublicJwk } from '@/lib/jwk';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from './ui/button';
import { Textarea } from './ui/textarea';

export function JwkPanel() {
  const { t } = useTranslation();
  const [jwkText, setJwkText] = useState('');
  const [token, setToken] = useState('');
  const [output, setOutput] = useState('');
  const [error, setError] = useState<string | null>(null);

  const readJwk = (): PublicJwk => JSON.parse(jwkText) as PublicJwk;
  const run = async (action: 'info' | 'pem' | 'verify') => {
    setError(null);
    try {
      const jwk = readJwk();
      if (action === 'info') setOutput(JSON.stringify(jwkInfo(jwk), null, 2));
      if (action === 'pem') setOutput(await jwkToPem(jwk));
      if (action === 'verify')
        setOutput(
          (await verifyJwtWithJwk(token, jwk))
            ? t('jwt.verifyValid')
            : t('jwt.verifyInvalid'),
        );
    } catch (cause) {
      setError(t('jwt.jwkFailed', { msg: (cause as Error).message }));
    }
  };

  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-2">
        <Textarea
          value={jwkText}
          onChange={(event) => setJwkText(event.target.value)}
          className="min-h-80 font-mono text-xs"
          placeholder="JWK"
        />
        <Textarea
          readOnly
          value={output}
          className="min-h-80 font-mono text-xs"
        />
      </div>
      <Textarea
        value={token}
        onChange={(event) => setToken(event.target.value)}
        className="min-h-28 font-mono text-xs"
        placeholder="JWT"
      />
      <div className="flex flex-wrap gap-2">
        <Button onClick={() => void run('info')}>{t('jwt.publicInfo')}</Button>
        <Button variant="outline" onClick={() => void run('pem')}>
          {t('jwt.toPem')}
        </Button>
        <Button
          variant="outline"
          disabled={!token.trim()}
          onClick={() => void run('verify')}
        >
          {t('jwt.verifySignature')}
        </Button>
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
