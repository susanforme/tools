import type { Worker as OcrWorker } from 'tesseract.js';
import type { OcrLanguage } from '../lib/ocr';

let engine: OcrWorker | null = null;

// 外层 worker 拥有 OCR 子 worker，取消时连初始化中的模型下载一起终止。
self.onmessage = async (
  event: MessageEvent<{ language: OcrLanguage } | { image: Blob }>,
) => {
  try {
    if ('language' in event.data) {
      const [{ createWorker }, { default: workerPath }] = await Promise.all([
        import('tesseract.js'),
        import('tesseract.js/dist/worker.min.js?url'),
      ]);
      engine = await createWorker(event.data.language, 1, {
        workerPath: new URL(workerPath, self.location.href).href,
        workerBlobURL: import.meta.env.PROD,
        logger: (message) =>
          self.postMessage({
            progress:
              message.status === 'recognizing text' ? message.progress : 0,
          }),
        errorHandler: (error) => self.postMessage({ error: String(error) }),
      });
      self.postMessage({ text: '' });
    } else {
      if (!engine) throw new Error('OCR 引擎尚未初始化');
      const { data } = await engine.recognize(event.data.image);
      self.postMessage({ text: data.text });
    }
  } catch (error) {
    self.postMessage({
      error: error instanceof Error ? error.message : String(error),
    });
  }
};
