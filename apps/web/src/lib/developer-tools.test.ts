import { JSDOM } from 'jsdom';
import { describe, expect, it } from 'vitest';
import { aggregateIpv4Range, expandIpv4Range, parseCidr } from './cidr';
import { findMimeTypes } from './binary-inspector';
import {
  base64ToBytes,
  bytesToBase64,
  compareVersions,
  compressIpv6,
  decodeBasicAuth,
  diffEnv,
  dockerRunToCompose,
  encodeBasicAuth,
  expandIpv6,
  extractOpenApiEndpoints,
  formatEnv,
  inferJsonSchema,
  mergeGitignore,
  parseCreateTable,
  inspectRobotsTxt,
  inspectSitemapXml,
  inspectIpv6,
  inspectMacAddress,
  parseUnixMode,
  wifiQrValue,
} from './developer-tools';

describe('developer tools', () => {
  it('covers schema, env, OpenAPI, SQL, and version helpers', () => {
    expect(inferJsonSchema({ id: 1, tags: ['a'] })).toMatchObject({
      type: 'object',
      required: ['id', 'tags'],
    });
    expect(formatEnv('TOKEN=x\nA=1\nA=2', false)).toBe('A=2\nTOKEN=********');
    expect(diffEnv('A=1', 'A=2\nB=3').map(({ status }) => status)).toEqual([
      'changed',
      'right-only',
    ]);
    expect(
      extractOpenApiEndpoints({ paths: { '/users': { get: {} } } })[0]?.id,
    ).toBe('GET /users');
    expect(
      parseCreateTable('CREATE TABLE users (id INTEGER, name TEXT)').columns,
    ).toHaveLength(2);
    expect(compareVersions('1.0.0', '1.0.0-beta.1')).toBe(1);
    expect(compareVersions('1.0.0-beta.2', '1.0.0-beta.11')).toBe(-1);
    expect(compareVersions('1.0.0+build.1', '1.0.0+build.2')).toBe(0);
    expect(mergeGitignore(['dist\n!dist/keep', 'dist\n.env'])).toBe(
      'dist\n!dist/keep\n.env',
    );
  });

  it('calculates IPv4 subnets and Unix permissions', () => {
    expect(parseCidr('192.168.1.42/24')).toMatchObject({
      broadcast: '192.168.1.255',
      firstHost: '192.168.1.1',
      usableHosts: 254,
      lastHost: '192.168.1.254',
      netmask: '255.255.255.0',
      network: '192.168.1.0',
    });
    expect(parseCidr('10.0.0.0/31').usableHosts).toBe(2);
    expect(parseUnixMode('4755')).toEqual({
      octal: '4755',
      symbolic: 'rwsr-xr-x',
    });
    expect(parseUnixMode('rwxr-xr-x').octal).toBe('755');
    expect(expandIpv4Range('192.168.1.1 - 192.168.1.3')).toEqual([
      '192.168.1.1',
      '192.168.1.2',
      '192.168.1.3',
    ]);
    expect(aggregateIpv4Range('192.168.1.0-192.168.1.255')).toEqual([
      '192.168.1.0/24',
    ]);
  });

  it('covers network, auth, file, Docker, and MIME helpers', () => {
    expect(compressIpv6('2001:0db8:0:0:0:0:0:1')).toBe('2001:db8::1');
    expect(expandIpv6('2001:db8::1')).toBe(
      '2001:0db8:0000:0000:0000:0000:0000:0001',
    );
    expect(inspectIpv6('2001:db8::1234/64')).toMatchObject({
      network: '2001:db8::/64',
      lastAddress: '2001:db8::ffff:ffff:ffff:ffff',
    });
    expect(inspectMacAddress('02-00-00-00-00-01')).toMatchObject({
      colon: '02:00:00:00:00:01',
      locallyAdministered: true,
      multicast: false,
    });
    const auth = encodeBasicAuth('用户', 'p:a');
    expect(decodeBasicAuth(auth)).toEqual({
      username: '用户',
      password: 'p:a',
    });
    const bytes = new TextEncoder().encode('file');
    expect(base64ToBytes(bytesToBase64(bytes))).toEqual(bytes);
    expect(wifiQrValue('a;b', 'p:1', 'WPA', false)).toBe(
      'WIFI:T:WPA;S:a\\;b;P:p\\:1;H:false;;',
    );
    expect(
      dockerRunToCompose(
        "docker run --name web -p 8080:80 -e 'A=1' nginx:alpine nginx -g 'daemon off;'",
      ),
    ).toContain('command: ["nginx", "-g", "daemon off;"]');
    expect(findMimeTypes('.json')[0]?.mime).toBe('application/json');
  });

  it('checks robots.txt and sitemap.xml content', () => {
    globalThis.DOMParser = new JSDOM().window.DOMParser as typeof DOMParser;
    expect(
      inspectRobotsTxt('User-agent: *\nDisallow: /private\nSitemap: /map.xml'),
    ).toMatchObject({
      entries: 1,
      issues: [{ code: 'invalidUrl', level: 'error', line: 3 }],
      sitemaps: 1,
    });
    expect(
      inspectSitemapXml(
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>https://example.com/</loc></url></urlset>',
      ),
    ).toMatchObject({ entries: 1, issues: [], sitemaps: 0 });
  });
});
