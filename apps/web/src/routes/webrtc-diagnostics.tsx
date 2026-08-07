import { MonacoTextEditor } from '@/components/monaco-editor';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { StringParam, useQueryParam } from '@/hooks/useQueryParams';
import { createFileRoute } from '@tanstack/react-router';
import { LoaderCircle, Network } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

export const Route = createFileRoute('/webrtc-diagnostics')({
  component: WebRtcDiagnosticsPage,
});
type Mode = 'devices' | 'ice';

function statsToJson(report: RTCStatsReport): unknown[] {
  const values: unknown[] = [];
  report.forEach((value) => values.push(value));
  return values;
}

async function runIceTest(configuration: RTCConfiguration): Promise<unknown> {
  const first = new RTCPeerConnection(configuration);
  const second = new RTCPeerConnection(configuration);
  const candidates: Array<{ side: string; candidate: RTCIceCandidateInit }> =
    [];
  const channel = first.createDataChannel('diagnostics');
  first.onicecandidate = (event) => {
    if (event.candidate) {
      candidates.push({ side: 'offer', candidate: event.candidate.toJSON() });
      void second.addIceCandidate(event.candidate);
    }
  };
  second.onicecandidate = (event) => {
    if (event.candidate) {
      candidates.push({ side: 'answer', candidate: event.candidate.toJSON() });
      void first.addIceCandidate(event.candidate);
    }
  };
  second.ondatachannel = (event) =>
    event.channel.addEventListener('message', () => undefined);
  try {
    await first.setLocalDescription(await first.createOffer());
    await second.setRemoteDescription(first.localDescription!);
    await second.setLocalDescription(await second.createAnswer());
    await first.setRemoteDescription(second.localDescription!);
    await new Promise<void>((resolve, reject) => {
      const timeout = window.setTimeout(
        () => reject(new Error('ICE 连接超时')),
        12000,
      );
      channel.addEventListener(
        'open',
        () => {
          window.clearTimeout(timeout);
          resolve();
        },
        { once: true },
      );
    });
    return {
      iceConnectionState: first.iceConnectionState,
      candidates,
      stats: statsToJson(await first.getStats()),
    };
  } finally {
    channel.close();
    first.close();
    second.close();
  }
}

function WebRtcDiagnosticsPage() {
  const { t } = useTranslation();
  const [mode, setMode] = useQueryParam<Mode>('mode', StringParam, 'devices');
  const [server, setServer] = useQueryParam<string>(
    'server',
    StringParam,
    'stun:stun.l.google.com:19302',
  );
  const [username, setUsername] = useState('');
  const [credential, setCredential] = useState('');
  const [output, setOutput] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const previewRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(
    () => () => streamRef.current?.getTracks().forEach((track) => track.stop()),
    [],
  );

  async function testDevices() {
    setLoading(true);
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: true,
      });
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = stream;
      if (previewRef.current) previewRef.current.srcObject = stream;
      const devices = await navigator.mediaDevices.enumerateDevices();
      setOutput(
        JSON.stringify(
          {
            devices: devices.map(({ deviceId, groupId, kind, label }) => ({
              deviceId,
              groupId,
              kind,
              label,
            })),
            videoTrack: stream.getVideoTracks()[0]?.getSettings(),
            audioTrack: stream.getAudioTracks()[0]?.getSettings(),
            videoCodecs: RTCRtpSender.getCapabilities?.('video')?.codecs ?? [],
            audioCodecs: RTCRtpSender.getCapabilities?.('audio')?.codecs ?? [],
          },
          null,
          2,
        ),
      );
    } catch (cause) {
      setError(
        t('webrtcDiagnostics.failed', { msg: (cause as Error).message }),
      );
    } finally {
      setLoading(false);
    }
  }

  async function testIce() {
    setLoading(true);
    setError(null);
    try {
      if (typeof RTCPeerConnection === 'undefined')
        throw new Error(t('webrtcDiagnostics.unsupported'));
      const iceServers: RTCIceServer[] = server.trim()
        ? [
            {
              urls: server.trim(),
              username: username || undefined,
              credential: credential || undefined,
            },
          ]
        : [];
      setOutput(JSON.stringify(await runIceTest({ iceServers }), null, 2));
    } catch (cause) {
      setError(
        t('webrtcDiagnostics.failed', { msg: (cause as Error).message }),
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-7xl space-y-4 px-4 py-6">
      <div className="flex items-center gap-2">
        <Network className="h-6 w-6" />
        <h1 className="text-2xl font-bold">{t('webrtcDiagnostics.title')}</h1>
      </div>
      <Tabs value={mode} onValueChange={(value) => setMode(value as Mode)}>
        <TabsList>
          <TabsTrigger value="devices">
            {t('webrtcDiagnostics.devices')}
          </TabsTrigger>
          <TabsTrigger value="ice">ICE</TabsTrigger>
        </TabsList>
      </Tabs>
      {mode === 'devices' ? (
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="space-y-3">
            <div className="flex aspect-video items-center justify-center overflow-hidden rounded-xl border bg-black">
              <video
                ref={previewRef}
                autoPlay
                muted
                playsInline
                aria-label={t('webrtcDiagnostics.devices')}
                className="h-full w-full object-contain"
              />
            </div>
            <Button disabled={loading} onClick={() => void testDevices()}>
              {loading && <LoaderCircle className="h-4 w-4 animate-spin" />}
              {t('webrtcDiagnostics.testDevices')}
            </Button>
          </div>
          <MonacoTextEditor
            readOnly
            label={t('webrtcDiagnostics.result')}
            language="json"
            height="520px"
            value={output}
          />
        </div>
      ) : (
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-2">
              <Label>STUN / TURN URL</Label>
              <Input
                value={server ?? ''}
                onChange={(event) => setServer(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>{t('webrtcDiagnostics.username')}</Label>
              <Input
                value={username}
                onChange={(event) => setUsername(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>{t('webrtcDiagnostics.credential')}</Label>
              <Input
                type="password"
                value={credential}
                onChange={(event) => setCredential(event.target.value)}
              />
            </div>
          </div>
          <Button disabled={loading} onClick={() => void testIce()}>
            {loading && <LoaderCircle className="h-4 w-4 animate-spin" />}
            {t('webrtcDiagnostics.testIce')}
          </Button>
          <MonacoTextEditor
            readOnly
            label={t('webrtcDiagnostics.result')}
            language="json"
            height="520px"
            value={output}
          />
        </div>
      )}
      {error && <div className="text-sm text-destructive">{error}</div>}
    </div>
  );
}
