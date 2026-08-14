import { importRuntimeModule, loadRuntimeWasm } from '../lib/runtime-assets';

type MinifyHtmlGlue = {
  __wbg_set_wasm(exports: WebAssembly.Exports): void;
  minify(input: Uint8Array, options: object): Uint8Array;
};

let minifyReady: Promise<MinifyHtmlGlue> | null = null;

function loadMinifyHtml() {
  minifyReady ??= Promise.all([
    importRuntimeModule<MinifyHtmlGlue>('minifyHtmlGlue'),
    loadRuntimeWasm('minifyHtmlWasm'),
  ]).then(async ([glue, bytes]) => {
    const module = await WebAssembly.compile(bytes);
    const instance = await WebAssembly.instantiate(module, {
      './index_bg.js': glue as WebAssembly.ModuleImports,
    });
    glue.__wbg_set_wasm(instance.exports);
    return glue;
  });
  return minifyReady;
}

export async function compressHTML(
  inputHtml: string,
  options?: {
    minify_css?: boolean;
    minify_js?: boolean;
    remove_processing_instructions?: boolean;
  },
) {
  const { minify } = await loadMinifyHtml();
  const encoder = new TextEncoder();
  const htmlBytes = encoder.encode(inputHtml);

  const minifiedBytes = minify(htmlBytes, options || {});

  // 将结果转回字符串
  const decoder = new TextDecoder();
  return decoder.decode(minifiedBytes);
}
