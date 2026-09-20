import { useCallback, useEffect, useRef } from 'react';

/** 按操作启动 worker，完成或离开页面即释放。 */
export function useTaskWorker<Request, Result>(createWorker: () => Worker) {
  const mounted = useRef(true);
  const active = useRef<{
    worker: Worker;
    reject: (reason: Error) => void;
  } | null>(null);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      active.current?.worker.terminate();
      active.current?.reject(new Error('任务已取消'));
      active.current = null;
    };
  }, []);

  return useCallback(
    (request: Request): Promise<Result> =>
      new Promise((resolve, reject) => {
        if (!mounted.current) {
          reject(new Error('任务已取消'));
          return;
        }
        active.current?.worker.terminate();
        active.current?.reject(new Error('任务已取消'));
        const worker = createWorker();
        active.current = { worker, reject };
        const finish = (): void => {
          worker.terminate();
          active.current = null;
        };
        worker.onmessage = (
          event: MessageEvent<{ result: Result } | { error: string }>,
        ): void => {
          finish();
          if ('error' in event.data) reject(new Error(event.data.error));
          else resolve(event.data.result);
        };
        worker.onerror = (event): void => {
          finish();
          reject(new Error(event.message || 'Worker 执行失败'));
        };
        worker.onmessageerror = (): void => {
          finish();
          reject(new Error('Worker 数据读取失败'));
        };
        try {
          worker.postMessage(request);
        } catch (cause) {
          finish();
          reject(cause);
        }
      }),
    [createWorker],
  );
}
