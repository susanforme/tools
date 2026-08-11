import { describe, expect, it } from 'vitest';
import {
  buildGraphqlRequest,
  calculateCssSpecificity,
  inspectSaml,
  inspectStreamingManifest,
  parseKubernetesQuantity,
} from './tool-expansions';

describe('tool expansions', () => {
  it('inspects SAML and streaming manifests', () => {
    expect(
      inspectSaml(
        '<samlp:Response Destination="https://sp.example/acs"><saml:Issuer>https://idp.example</saml:Issuer><saml:Assertion /></samlp:Response>',
      ),
    ).toMatchObject({
      root: 'Response',
      issuer: 'https://idp.example',
      destination: 'https://sp.example/acs',
      assertions: 1,
    });
    expect(
      inspectStreamingManifest(`#EXTM3U
#EXT-X-STREAM-INF:BANDWIDTH=8000000,RESOLUTION=1920x1080,CODECS="avc1.640028,mp4a.40.2"
1080p.m3u8
#EXT-X-STREAM-INF:BANDWIDTH=16000000,RESOLUTION=2560x1440
1440p.m3u8`),
    ).toMatchObject({
      kind: 'hls',
      variants: [
        { bandwidth: 8_000_000, resolution: '1920x1080' },
        { bandwidth: 16_000_000, resolution: '2560x1440' },
      ],
    });
  });

  it('calculates selector specificity', () => {
    expect(calculateCssSpecificity('.card:is(#hero, .active) > span')).toEqual([
      1, 1, 1,
    ]);
    expect(calculateCssSpecificity(':where(#app) article[data-kind]')).toEqual([
      0, 1, 1,
    ]);
  });

  it('builds GraphQL requests and parses Kubernetes quantities', () => {
    const request = buildGraphqlRequest({
      endpoint: 'https://api.example/graphql',
      query: 'query User($id: ID!) { user(id: $id) { id } }',
      variables: '{"id":"42"}',
      operationName: 'User',
      bearerToken: 'token',
    });
    expect(request.body).toMatchObject({
      operationName: 'User',
      variables: { id: '42' },
    });
    expect(request.curl).toContain('Authorization: Bearer token');
    expect(parseKubernetesQuantity('500m', 'cpu')).toEqual({
      cores: 0.5,
      millicores: 500,
    });
    expect(parseKubernetesQuantity('1Gi', 'memory')).toMatchObject({
      bytes: 1_073_741_824,
      gibibytes: 1,
    });
  });
});
