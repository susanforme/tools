import { base64ToBytes, bytesToBase64 } from './developer-tools';
import {
  checkFormatSize,
  formatOutput,
  type FormatResult,
} from './format-input';
export type WasmRequest = {
  kind: 'wasm';
  mode: 'wat' | 'binary';
  input: string;
};
export async function processWasm(request: WasmRequest): Promise<FormatResult> {
  checkFormatSize(request.input);
  const wabt = await (await import('wabt')).default();
  const module =
    request.mode === 'wat'
      ? wabt.parseWat('input.wat', request.input)
      : wabt.readWasm(base64ToBytes(request.input), {
          readDebugNames: true,
          check: true,
        });
  try {
    module.resolveNames();
    module.validate();
    const binary = Uint8Array.from(
      module.toBinary({ write_debug_names: true }).buffer,
    );
    if (binary.byteLength > 5 * 1024 * 1024)
      throw new Error('OUTPUT_TOO_LARGE');
    const output =
      request.mode === 'wat'
        ? bytesToBase64(binary)
        : module.toText({ foldExprs: false, inlineExport: false });
    if (output.length > 5 * 1024 * 1024) throw new Error('OUTPUT_TOO_LARGE');
    let inspection: object;
    try {
      // 仅编译和读取元信息，绝不实例化用户模块或执行 start 函数。
      const compiled = await WebAssembly.compile(binary);
      inspection = {
        runtimeValid: true,
        imports: WebAssembly.Module.imports(compiled),
        exports: WebAssembly.Module.exports(compiled),
      };
    } catch (error) {
      inspection = { runtimeValid: false, reason: (error as Error).message };
    }
    return {
      output,
      binary,
      info: formatOutput({
        wabtValid: true,
        bytes: binary.byteLength,
        ...inspection,
      }),
    };
  } finally {
    module.destroy();
  }
}
