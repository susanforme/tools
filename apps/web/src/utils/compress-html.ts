export async function compressHTML(
  inputHtml: string,
  options?: {
    minify_css?: boolean;
    minify_js?: boolean;
    remove_processing_instructions?: boolean;
  },
) {
  const { minify } = await import('@minify-html/wasm');
  const encoder = new TextEncoder();
  const htmlBytes = encoder.encode(inputHtml);

  const minifiedBytes = minify(htmlBytes, options || {});

  // 将结果转回字符串
  const decoder = new TextDecoder();
  return decoder.decode(minifiedBytes);
}
