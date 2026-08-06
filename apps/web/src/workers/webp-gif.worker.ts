/// <reference lib="webworker" />

import {
  convertAnimation,
  type AnimationConversionRequest,
} from '@/lib/webp-gif';

type WorkerResponse =
  | {
      ok: true;
      source: ArrayBuffer;
      frameCount: number;
      duration: number;
    }
  | {
      ok: false;
      error: 'too-large' | 'conversion-failed';
      detail: string;
    };

const context = self as DedicatedWorkerGlobalScope;

context.onmessage = async (event: MessageEvent<AnimationConversionRequest>) => {
  try {
    const result = await convertAnimation(event.data);
    context.postMessage({ ok: true, ...result } satisfies WorkerResponse, [
      result.source,
    ]);
  } catch (cause) {
    const error =
      cause instanceof Error && cause.message === 'ANIMATION_TOO_LARGE'
        ? 'too-large'
        : 'conversion-failed';
    const detail = cause instanceof Error ? cause.message : String(cause);
    context.postMessage({ ok: false, error, detail } satisfies WorkerResponse);
  }
};

export {};
