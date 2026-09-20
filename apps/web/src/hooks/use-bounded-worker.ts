import { useCallback, useEffect, useRef, useState } from 'react';

/** 交互式工具共用：超时、取消、卸载均真正终止计算。 */
export function useBoundedWorker<Request, Result>(
  createWorker: () => Worker,
  timeout = 5000,
) {
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const active = useRef<{
    worker: Worker;
    timer: ReturnType<typeof setTimeout>;
  } | null>(null);
  const mounted = useRef(true);
  const stop = useCallback((): void => {
    if (active.current) {
      active.current.worker.terminate();
      clearTimeout(active.current.timer);
      active.current = null;
    }
  }, []);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      stop();
    };
  }, [stop]);
  const clear = useCallback((): void => {
    stop();
    setBusy(false);
    setResult(null);
    setError(null);
  }, [stop]);
  const cancel = useCallback((): void => {
    stop();
    setBusy(false);
    setError('CANCELLED');
  }, [stop]);
  const run = useCallback(
    (request: Request): void => {
      if (!mounted.current) return;
      clear();
      setBusy(true);
      try {
        const worker = createWorker();
        const finish = (): boolean => {
          if (active.current?.worker !== worker) return false;
          stop();
          setBusy(false);
          return true;
        };
        const timer = setTimeout(() => {
          if (finish()) setError('TIMEOUT');
        }, timeout);
        active.current = { worker, timer };
        worker.onmessage = (
          event: MessageEvent<{ result: Result } | { error: string }>,
        ): void => {
          if (!finish()) return;
          if ('error' in event.data) setError(event.data.error);
          else setResult(event.data.result);
        };
        worker.onerror = (event): void => {
          if (finish()) setError(event.message || 'WORKER_ERROR');
        };
        worker.onmessageerror = (): void => {
          if (finish()) setError('WORKER_ERROR');
        };
        worker.postMessage(request);
      } catch (cause) {
        stop();
        setBusy(false);
        setError((cause as Error).message);
      }
    },
    [clear, createWorker, stop, timeout],
  );
  return { result, error, busy, run, clear, cancel };
}
