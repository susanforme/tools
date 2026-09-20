import { describe, it, expect } from 'vitest';
import { processIcu, inspectOpenSsh, parseMqtt } from './community-protocols';
import { processProtobuf, type ProtobufRequest } from './protobuf-schema';
import { inspectFeed, safeFeedUrl } from './feed-inspector';
import { bytesToBase64 } from './developer-tools';
function ssh(algorithm: string, fields: Uint8Array[]): string {
  const arrays = [new TextEncoder().encode(algorithm), ...fields];
  const all: number[] = [];
  for (const field of arrays) {
    all.push(
      ...new Uint8Array(new Uint32Array([field.length]).buffer).reverse(),
      ...field,
    );
  }
  return `${algorithm} ${bytesToBase64(Uint8Array.from(all))}`;
}
describe('community protocol boundaries', () => {
  it('formats ICU plural, ordinal, select and dates with the selected zone', async () => {
    const result = await processIcu({
      kind: 'icu',
      message:
        '{n, plural, one {# file} other {# files}} / {n, selectordinal, one {#st} two {#nd} few {#rd} other {#th}} / {role, select, admin {Admin} other {User}} / {date, date, short}',
      params: '{"n":2,"role":"admin","date":0}',
      locale: 'en-US',
      timeZone: 'UTC',
    });
    expect(result.output).toContain('2 files / 2nd / Admin / 1/1/70');
    await expect(
      processIcu({
        kind: 'icu',
        message: '{missing}',
        params: '{}',
        locale: 'en',
        timeZone: 'UTC',
      }),
    ).rejects.toThrow();
  });
  it('validates SSH wire lengths, RSA integers and uses standard fingerprint Base64', async () => {
    const key = ssh('ssh-ed25519', [new Uint8Array(32).fill(1)]);
    const result = await inspectOpenSsh(key);
    expect(result.bits).toBe(256);
    expect(result.fingerprint).toBe(
      'SHA256:RXm/ruZ0eTzRXKwi1AQEDynB0VgHQ2ac9KPSFdf/YnA',
    );
    await expect(
      inspectOpenSsh(ssh('ssh-ed25519', [new Uint8Array(31)])),
    ).rejects.toThrow('SSH_LENGTH');
    await expect(
      inspectOpenSsh(
        ssh('ssh-ed25519', [new Uint8Array(32), new Uint8Array(1)]),
      ),
    ).rejects.toThrow('SSH_TRAILING');
    expect(
      (
        await inspectOpenSsh(
          ssh('ssh-rsa', [new Uint8Array([3]), new Uint8Array([0, 0x81])]),
        )
      ).bits,
    ).toBe(8);
    await expect(
      inspectOpenSsh(
        ssh('ssh-rsa', [new Uint8Array([3]), new Uint8Array([0x81])]),
      ),
    ).rejects.toThrow('SSH_MPINT');
  });
  it('validates ECDSA points on their declared curve', async () => {
    const pair = await crypto.subtle.generateKey(
      { name: 'ECDSA', namedCurve: 'P-256' },
      true,
      ['sign', 'verify'],
    );
    const point = new Uint8Array(
      await crypto.subtle.exportKey('raw', pair.publicKey),
    );
    const curve = new TextEncoder().encode('nistp256');
    expect(
      (await inspectOpenSsh(ssh('ecdsa-sha2-nistp256', [curve, point]))).bits,
    ).toBe(256);
    point.fill(0);
    point[0] = 4;
    await expect(
      inspectOpenSsh(ssh('ecdsa-sha2-nistp256', [curve, point])),
    ).rejects.toThrow();
  });
  it('parses multiple MQTT frames and rejects partial streams/version mismatch', async () => {
    const frames = await parseMqtt({
      kind: 'mqtt',
      input: '30 07 00 01 61 74 65 73 74 c0 00',
      encoding: 'hex',
      version: 4,
    });
    expect(frames.map((item) => item.command)).toEqual(['publish', 'pingreq']);
    expect(frames[0]?.length).toBe(9);
    expect(JSON.stringify(frames[0])).toContain('test');
    await expect(
      parseMqtt({
        kind: 'mqtt',
        input: '30 07 00 01 61',
        encoding: 'hex',
        version: 4,
      }),
    ).rejects.toThrow('MQTT_TRUNCATED');
    await expect(
      parseMqtt({
        kind: 'mqtt',
        input: 'c0 80 00',
        encoding: 'hex',
        version: 4,
      }),
    ).rejects.toThrow('MQTT_LENGTH');
    expect(
      (
        await parseMqtt({
          kind: 'mqtt',
          input: '30 08 00 01 61 00 74 65 73 74',
          encoding: 'hex',
          version: 5,
        })
      )[0]?.command,
    ).toBe('publish');
  });
  const request: ProtobufRequest = {
    kind: 'protobuf',
    schema:
      'syntax="proto3"; import "child.proto"; message Parent { Child child=1; int64 id=2; uint32 count=3; }',
    imports: [
      {
        path: 'child.proto',
        source: 'syntax="proto3"; message Child { string name=1; }',
      },
    ],
    mode: 'encode',
    message: 'Parent',
    input: '{"child":{"name":"Ada"},"id":"9007199254740993","count":1}',
    encoding: 'base64',
  };
  it('resolves only local protobuf imports and preserves 64-bit values', async () => {
    const encoded = await processProtobuf(request);
    const decoded = await processProtobuf({
      ...request,
      mode: 'decode',
      input: encoded.output,
    });
    expect(JSON.parse(decoded.output)).toEqual({
      child: { name: 'Ada' },
      id: '9007199254740993',
      count: 1,
    });
    await expect(processProtobuf({ ...request, imports: [] })).rejects.toThrow(
      'PROTO_IMPORT',
    );
    await expect(
      processProtobuf({ ...request, input: '{"count":4294967296}' }),
    ).rejects.toThrow('PROTO_RANGE');
    await expect(
      processProtobuf({ ...request, input: '{"count":"1"}' }),
    ).rejects.toThrow('PROTO_INTEGER');
    await expect(
      processProtobuf({ ...request, input: '{"missing":1}' }),
    ).rejects.toThrow('PROTO_FIELD');
  });
  it('retains RSS duplicate items, reports required fields and never promotes unsafe links', async () => {
    const feed = await inspectFeed(
      '<rss version="2.0"><channel><title>A &amp; B</title><link>https://example.com</link><description>News</description><item><guid>x</guid><title>One</title><link>javascript:alert(1)</link><description><![CDATA[<img src=x onerror=alert(1)>]]></description></item><item><guid>x</guid></item></channel></rss>',
    );
    expect(feed.title).toBe('A & B');
    expect(feed.items).toHaveLength(2);
    expect(feed.items[0]?.link).toBeNull();
    expect(feed.items[0]?.summary).toContain('<img');
    expect(feed.issues.map((item) => item.code)).toEqual(
      expect.arrayContaining(['unsafeLink', 'duplicate', 'itemContent']),
    );
    expect(safeFeedUrl('data:text/html,x')).toBeNull();
  });
  it('preserves mixed XHTML content order without rendering markup', async () => {
    const feed = await inspectFeed(
      '<feed xmlns="http://www.w3.org/2005/Atom"><entry><content type="xhtml"><div xmlns="http://www.w3.org/1999/xhtml">before <b>bold</b> after</div></content></entry></feed>',
    );
    expect(feed.items[0]?.summary).toBe('before bold after');
  });
  it('recognizes namespaced Atom, resolves xml:base and blocks entities', async () => {
    const feed = await inspectFeed(
      '<a:feed xmlns:a="http://www.w3.org/2005/Atom" xml:base="https://example.com/blog/"><a:id>urn:feed</a:id><a:title>News</a:title><a:updated>2026-09-17T00:00:00Z</a:updated><a:author><a:name>Ada</a:name></a:author><a:entry><a:id>urn:item</a:id><a:title>Post</a:title><a:updated>2026-09-17T00:00:00Z</a:updated><a:link href="post"/></a:entry></a:feed>',
    );
    expect(feed.items[0]?.link).toBe('https://example.com/blog/post');
    expect(feed.issues).toEqual([]);
    await expect(
      inspectFeed('<!DOCTYPE rss [<!ENTITY x "boom">]><rss version="2.0"/>'),
    ).rejects.toThrow('XML_ENTITIES');
    await expect(
      inspectFeed('<feed xmlns="https://not-atom"/>'),
    ).rejects.toThrow('FEED_FORMAT');
  });
});
