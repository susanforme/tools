import { MonacoTextEditor } from '@/components/monaco-editor';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { StringParam, useQueryParam } from '@/hooks/useQueryParams';
import {
  decodeClientData,
  fromBase64Url,
  parseAuthenticatorData,
  randomBase64Url,
  toBase64Url,
} from '@/lib/webauthn';
import { createFileRoute } from '@tanstack/react-router';
import { Fingerprint } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

export const Route = createFileRoute('/webauthn-debugger')({
  component: WebAuthnDebuggerPage,
});
type Mode = 'create' | 'get';
type CreationJson = {
  challenge: string;
  rp: PublicKeyCredentialRpEntity;
  user: Omit<PublicKeyCredentialUserEntity, 'id'> & { id: string };
  pubKeyCredParams: PublicKeyCredentialParameters[];
  timeout?: number;
  authenticatorSelection?: AuthenticatorSelectionCriteria;
};
type RequestJson = {
  challenge: string;
  timeout?: number;
  rpId?: string;
  userVerification?: UserVerificationRequirement;
  allowCredentials?: Array<
    Omit<PublicKeyCredentialDescriptor, 'id'> & { id: string }
  >;
};

function creationSample(): CreationJson {
  return {
    challenge: randomBase64Url(),
    rp: { name: 'Breeze Tools', id: location.hostname },
    user: {
      id: randomBase64Url(16),
      name: 'demo@example.com',
      displayName: 'Demo User',
    },
    pubKeyCredParams: [
      { type: 'public-key', alg: -7 },
      { type: 'public-key', alg: -257 },
    ],
    timeout: 60000,
    authenticatorSelection: {
      residentKey: 'preferred',
      userVerification: 'preferred',
    },
  };
}
function requestSample(credentialId = ''): RequestJson {
  return {
    challenge: randomBase64Url(),
    rpId: location.hostname,
    timeout: 60000,
    userVerification: 'preferred',
    allowCredentials: credentialId
      ? [{ type: 'public-key', id: credentialId }]
      : undefined,
  };
}

function WebAuthnDebuggerPage() {
  const { t } = useTranslation();
  const [mode, setMode] = useQueryParam<Mode>('mode', StringParam, 'create');
  const [credentialId, setCredentialId] = useState('');
  const [options, setOptions] = useState(() =>
    JSON.stringify(creationSample(), null, 2),
  );
  const [output, setOutput] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(
    () =>
      setOptions(
        JSON.stringify(
          mode === 'create' ? creationSample() : requestSample(credentialId),
          null,
          2,
        ),
      ),
    [mode],
  );

  async function run() {
    setError(null);
    try {
      if (
        !window.isSecureContext ||
        !navigator.credentials ||
        typeof PublicKeyCredential === 'undefined'
      )
        throw new Error(t('webauthnDebugger.unsupported'));
      if (mode === 'create') {
        const parsed = JSON.parse(options) as CreationJson;
        const credential = (await navigator.credentials.create({
          publicKey: {
            ...parsed,
            challenge: fromBase64Url(parsed.challenge),
            user: { ...parsed.user, id: fromBase64Url(parsed.user.id) },
          },
        })) as PublicKeyCredential | null;
        if (!credential) throw new Error(t('webauthnDebugger.cancelled'));
        const response =
          credential.response as AuthenticatorAttestationResponse;
        const id = toBase64Url(credential.rawId);
        setCredentialId(id);
        setOutput(
          JSON.stringify(
            {
              id,
              type: credential.type,
              authenticatorAttachment: credential.authenticatorAttachment,
              clientExtensionResults: credential.getClientExtensionResults(),
              response: {
                clientDataJSON: decodeClientData(response.clientDataJSON),
                attestationObject: toBase64Url(response.attestationObject),
                transports: response.getTransports?.() ?? [],
                publicKeyAlgorithm: response.getPublicKeyAlgorithm?.() ?? null,
                publicKey: response.getPublicKey?.()
                  ? toBase64Url(response.getPublicKey()!)
                  : null,
              },
            },
            null,
            2,
          ),
        );
      } else {
        const parsed = JSON.parse(options) as RequestJson;
        const credential = (await navigator.credentials.get({
          publicKey: {
            ...parsed,
            challenge: fromBase64Url(parsed.challenge),
            allowCredentials: parsed.allowCredentials?.map((item) => ({
              ...item,
              id: fromBase64Url(item.id),
            })),
          },
        })) as PublicKeyCredential | null;
        if (!credential) throw new Error(t('webauthnDebugger.cancelled'));
        const response = credential.response as AuthenticatorAssertionResponse;
        setOutput(
          JSON.stringify(
            {
              id: credential.id,
              type: credential.type,
              clientExtensionResults: credential.getClientExtensionResults(),
              response: {
                clientDataJSON: decodeClientData(response.clientDataJSON),
                authenticatorData: parseAuthenticatorData(
                  response.authenticatorData,
                ),
                signature: toBase64Url(response.signature),
                userHandle: response.userHandle
                  ? toBase64Url(response.userHandle)
                  : null,
              },
            },
            null,
            2,
          ),
        );
      }
    } catch (cause) {
      setError(t('webauthnDebugger.failed', { msg: (cause as Error).message }));
    }
  }

  function regenerate() {
    setOptions(
      JSON.stringify(
        mode === 'create' ? creationSample() : requestSample(credentialId),
        null,
        2,
      ),
    );
    setOutput('');
  }

  return (
    <div className="mx-auto max-w-7xl space-y-4 px-4 py-6">
      <div className="flex items-center gap-2">
        <Fingerprint className="h-6 w-6" />
        <h1 className="text-2xl font-bold">{t('webauthnDebugger.title')}</h1>
      </div>
      <Tabs value={mode} onValueChange={(value) => setMode(value as Mode)}>
        <TabsList>
          <TabsTrigger value="create">
            {t('webauthnDebugger.create')}
          </TabsTrigger>
          <TabsTrigger value="get">{t('webauthnDebugger.get')}</TabsTrigger>
        </TabsList>
      </Tabs>
      <div className="flex gap-2">
        <Button onClick={() => void run()}>{t('webauthnDebugger.run')}</Button>
        <Button variant="outline" onClick={regenerate}>
          {t('webauthnDebugger.regenerate')}
        </Button>
      </div>
      {error && <div className="text-sm text-destructive">{error}</div>}
      <div className="grid gap-4 lg:grid-cols-2">
        <MonacoTextEditor
          label={t('webauthnDebugger.options')}
          language="json"
          height="620px"
          value={options}
          onChange={setOptions}
        />
        <MonacoTextEditor
          readOnly
          label={t('webauthnDebugger.result')}
          language="json"
          height="620px"
          value={output}
        />
      </div>
    </div>
  );
}
