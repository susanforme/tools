import { describe, expect, it } from 'vitest';
import {
  createSri,
  createWebhookSignature,
  detectToolSuggestions,
  inspectCompose,
  inspectSecurityHeaders,
  jsonToLanguageTypes,
  runPipeline,
  structuredQrValue,
  verifySri,
  verifyWebhookSignature,
} from './advanced-tools';

describe('advanced tools', () => {
  it('handles SRI, generated types, and pipelines', async () => {
    const bytes = new TextEncoder().encode('hello');
    const sri = await createSri(bytes, 'SHA-256');
    expect(sri).toMatch(/^sha256-/);
    await expect(verifySri(bytes, sri)).resolves.toBe(true);
    expect(jsonToLanguageTypes({ user: { id: 1 } }, 'go')).toContain(
      'type RootUser struct',
    );
    await expect(
      runPipeline('{"a":1}', ['json-format', 'base64-encode']),
    ).resolves.toMatch(/^ew/);
  });

  it('checks Compose, headers, QR payloads, and smart detection', () => {
    expect(
      inspectCompose(
        { services: { web: { image: 'nginx', ports: ['8080:80'] } } },
        'services:\n  web:\n    image: ${IMAGE}',
        '',
      ),
    ).toContainEqual({ code: 'missingEnv', level: 'warning', detail: 'IMAGE' });
    expect(
      inspectSecurityHeaders('X-Content-Type-Options: nosniff').find(
        ({ header }) => header === 'x-content-type-options',
      )?.state,
    ).toBe('present');
    expect(
      structuredQrValue('email', { email: 'a@example.com', subject: 'Hi' }),
    ).toBe('mailto:a@example.com?subject=Hi');
    expect(detectToolSuggestions('docker run nginx')[0]?.path).toBe(
      '/docker-compose',
    );
  });

  it('generates and verifies webhook signatures', async () => {
    const signature = await createWebhookSignature(
      'stripe',
      '{}',
      'secret',
      '123',
    );
    await expect(
      verifyWebhookSignature('stripe', '{}', 'secret', '123', signature),
    ).resolves.toBe(true);
  });
});
