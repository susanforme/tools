import type {
  IcuRequest,
  MqttRequest,
  SshRequest,
  ProtocolSource,
} from '../lib/community-protocols';
import type { ProtobufRequest } from '../lib/protobuf-schema';
export type CommunityRequest =
  | IcuRequest
  | MqttRequest
  | SshRequest
  | ProtobufRequest
  | { kind: 'feed'; input: ProtocolSource };
self.onmessage = async (
  event: MessageEvent<CommunityRequest>,
): Promise<void> => {
  try {
    const request = event.data;
    let result: unknown;
    if (request.kind === 'protobuf')
      result = await (
        await import('../lib/protobuf-schema')
      ).processProtobuf(request);
    else {
      const core = await import('../lib/community-protocols');
      if (request.kind === 'icu') result = await core.processIcu(request);
      else if (request.kind === 'mqtt') result = await core.parseMqtt(request);
      else if (request.kind === 'ssh')
        result = await core.inspectOpenSsh(
          await core.sourceText(request.input),
        );
      else
        result = await (
          await import('../lib/feed-inspector')
        ).inspectFeed(await core.sourceText(request.input));
    }
    self.postMessage({ result });
  } catch (error) {
    self.postMessage({ error: (error as Error).message });
  }
};
