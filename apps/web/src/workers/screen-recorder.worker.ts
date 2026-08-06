/// <reference lib="webworker" />

import {
  getRecordingCleanupPlan,
  type ScreenRecordingWorkerRequest,
  type ScreenRecordingWorkerResponse,
} from '../lib/screen-recordings';

const DIRECTORY_NAME = 'screen-recordings';
let writable: FileSystemWritableFileStream | null = null;
let currentFileName: string | null = null;

async function getDirectory(): Promise<FileSystemDirectoryHandle> {
  const root = await navigator.storage.getDirectory();
  return root.getDirectoryHandle(DIRECTORY_NAME, { create: true });
}

async function removeFile(fileName: string): Promise<void> {
  const directory = await getDirectory();
  await directory.removeEntry(fileName).catch((cause: unknown) => {
    if (!(cause instanceof DOMException && cause.name === 'NotFoundError')) {
      throw cause;
    }
  });
}

async function handleRequest(
  request: ScreenRecordingWorkerRequest,
): Promise<unknown> {
  switch (request.type) {
    case 'open': {
      if (writable) throw new Error('A recording file is already open');
      const directory = await getDirectory();
      const handle = await directory.getFileHandle(request.fileName, {
        create: true,
      });
      writable = await handle.createWritable();
      currentFileName = request.fileName;
      return undefined;
    }
    case 'write':
      if (!writable) throw new Error('No recording file is open');
      await writable.write(request.chunk);
      return undefined;
    case 'close': {
      if (!writable || !currentFileName) {
        throw new Error('No recording file is open');
      }
      const fileName = currentFileName;
      await writable.close();
      writable = null;
      currentFileName = null;
      const directory = await getDirectory();
      const file = await (await directory.getFileHandle(fileName)).getFile();
      return { size: file.size };
    }
    case 'abort': {
      const fileName = currentFileName;
      await writable?.abort().catch(() => undefined);
      writable = null;
      currentFileName = null;
      if (fileName) await removeFile(fileName);
      return undefined;
    }
    case 'read': {
      const directory = await getDirectory();
      return (await directory.getFileHandle(request.fileName)).getFile();
    }
    case 'delete':
      await removeFile(request.fileName);
      return undefined;
    case 'cleanup': {
      const directory = await getDirectory();
      const fileNames: string[] = [];
      for await (const [name] of directory.entries()) fileNames.push(name);
      // ponytail: 假设同一时刻只有一个录屏标签页；支持多标签录制时改用 Web Locks。
      const { orphanFiles, missingRecordIds } = getRecordingCleanupPlan(
        request.records,
        fileNames,
      );
      await Promise.all(
        orphanFiles.map((name) =>
          directory.removeEntry(name, { recursive: true }),
        ),
      );
      return missingRecordIds;
    }
  }
}

self.addEventListener(
  'message',
  (event: MessageEvent<ScreenRecordingWorkerRequest>) => {
    const request = event.data;
    void handleRequest(request)
      .then((result) => {
        const response: ScreenRecordingWorkerResponse = {
          id: request.id,
          ok: true,
          result,
        };
        self.postMessage(response);
      })
      .catch((cause: unknown) => {
        const response: ScreenRecordingWorkerResponse = {
          id: request.id,
          ok: false,
          error: String(cause),
        };
        self.postMessage(response);
      });
  },
);
