export type VideoOutputFormat = 'mp4' | 'webm';

export type VideoTrimmerRequest =
  | { type: 'inspect'; file: File }
  | {
      type: 'trim';
      file: File;
      start: number;
      end: number;
      format: VideoOutputFormat;
    };

export type VideoTrimmerResponse =
  | { type: 'progress'; progress: number }
  | {
      type: 'inspected';
      duration: number;
      mimeType: string;
    }
  | {
      type: 'trimmed';
      fileName: string;
      size: number;
      mimeType: string;
    }
  | { type: 'error'; error: string };

export const VIDEO_TRIMMER_DIRECTORY = 'video-trimmer';
