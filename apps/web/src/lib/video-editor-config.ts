export const VIDEO_EDITOR_CONFIG = {
  sessionId: 'current',
  rootDirectory: 'video-editor',
  projectFile: 'project.json',
  thumbnailDirectory: 'thumbnails',
  microsecondsPerSecond: 1_000_000,
  videoAccept:
    'video/*,.3gp,.asf,.avi,.divx,.dv,.flv,.m2ts,.m4v,.mkv,.mov,.mpeg,.mpg,.mts,.mxf,.ogv,.rm,.rmvb,.ts,.vob,.webm,.wmv',
  mediaAccept:
    'video/*,audio/*,.3gp,.asf,.avi,.divx,.dv,.flv,.m2ts,.m4v,.mkv,.mov,.mpeg,.mpg,.mts,.mxf,.ogv,.rm,.rmvb,.ts,.vob,.webm,.wmv',
} as const;
