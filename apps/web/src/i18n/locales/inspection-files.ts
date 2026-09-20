export const zh = {
  ocr: {
    title: '图片 / PDF 文字识别',
    limits:
      '可上传或粘贴图片；文件最大 20 MiB，图片最多 1600 万像素，PDF 最多 50 页。首次识别需下载语言模型。',
    file: '选择图片或 PDF',
    language: '识别语言',
    bilingual: '简体中文 + 英文',
    chinese: '简体中文',
    english: '英文',
    run: '开始识别',
    running: '识别中',
    cancel: '取消',
    progress: '第 {{page}} / {{pages}} 页 · {{percent}}%',
    output: '识别文字',
    copy: '复制',
    download: '下载 TXT',
    error: '识别失败：{{message}}',
    copyError: '复制失败：{{message}}',
  },
  parquetViewer: {
    title: 'Parquet 文件查看',
    limits:
      '文件最大 50 MiB，单个行组解压后最大 256 MiB。预览前 10,000 行，筛选和导出仅针对预览数据。',
    file: '选择 Parquet 文件',
    loading: '读取中…',
    cancel: '取消',
    tooLarge: '读取失败：文件不能超过 50 MiB',
    error: '读取失败：{{message}}',
    summary:
      '文件共 {{total}} 行 · 已预览 {{loaded}} 行 · 筛选匹配 {{filtered}} 行',
    schema: '字段与类型',
    filter: '筛选预览数据',
    download: '导出筛选结果 CSV',
    empty: '没有匹配的行',
    previous: '上一页',
    next: '下一页',
  },
};

export const en = {
  ocr: {
    title: 'Image / PDF OCR',
    limits:
      'Upload or paste an image. Maximum: 20 MiB per file, 16 megapixels per image, 50 PDF pages. Language models download on first use.',
    file: 'Choose image or PDF',
    language: 'Language',
    bilingual: 'Simplified Chinese + English',
    chinese: 'Simplified Chinese',
    english: 'English',
    run: 'Recognize',
    running: 'Recognizing',
    cancel: 'Cancel',
    progress: 'Page {{page}} / {{pages}} · {{percent}}%',
    output: 'Recognized text',
    copy: 'Copy',
    download: 'Download TXT',
    error: 'Recognition failed: {{message}}',
    copyError: 'Copy failed: {{message}}',
  },
  parquetViewer: {
    title: 'Parquet Viewer',
    limits:
      'Maximum file size: 50 MiB; decompressed row group: 256 MiB. Preview the first 10,000 rows. Filters and exports apply only to the preview.',
    file: 'Choose Parquet file',
    loading: 'Reading…',
    cancel: 'Cancel',
    tooLarge: 'Read failed: file exceeds 50 MiB',
    error: 'Read failed: {{message}}',
    summary:
      '{{total}} total rows · {{loaded}} preview rows · {{filtered}} matching rows',
    schema: 'Fields and types',
    filter: 'Filter preview',
    download: 'Export filtered CSV',
    empty: 'No matching rows',
    previous: 'Previous',
    next: 'Next',
  },
};
