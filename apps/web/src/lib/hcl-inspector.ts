import type { Language, Node } from 'web-tree-sitter';
let languagePromise: Promise<Language> | null = null;
export async function inspectHcl(input: string, grammarBytes?: Uint8Array) {
  if (!input.trim() || input.length > 200_000)
    throw new Error('请输入 200 KB 以内的 HCL');
  const { Parser, Language } = await import('web-tree-sitter');
  await Parser.init(
    typeof __TREE_SITTER_WASM_URL__ === 'undefined'
      ? undefined
      : { locateFile: () => __TREE_SITTER_WASM_URL__ },
  );
  if (!languagePromise || grammarBytes) {
    // 显式传入字节，避免语言加载器将浏览器中的 process.env shim 误判为 Node。
    languagePromise = (async () => {
      if (grammarBytes) return Language.load(grammarBytes);
      const response = await fetch(__HCL_WASM_URL__);
      if (!response.ok)
        throw new Error(`HCL 语法加载失败：HTTP ${response.status}`);
      return Language.load(new Uint8Array(await response.arrayBuffer()));
    })().catch((cause) => {
      languagePromise = null;
      throw cause;
    });
  }
  const parser = new Parser();
  let tree: ReturnType<typeof parser.parse> = null;
  try {
    parser.setLanguage(await languagePromise);
    tree = parser.parse(input);
    if (!tree) throw new Error('解析未完成');
    const errors: {
      line: number;
      column: number;
      text: string;
      missing: boolean;
    }[] = [];
    const stack: Node[] = [tree.rootNode];
    let count = 0;
    while (stack.length) {
      const node = stack.pop()!;
      if (++count > 50_000) throw new Error('语法节点超过 50000 个');
      if (node.isError || node.isMissing)
        errors.push({
          line: node.startPosition.row + 1,
          column: node.startPosition.column + 1,
          text: node.text.slice(0, 120),
          missing: node.isMissing,
        });
      stack.push(...node.children);
    }
    const blocks = tree.rootNode.descendantsOfType('block').map((node) => {
      const children = node.namedChildren;
      return {
        type: children[0]?.text ?? '',
        labels: children
          .slice(1)
          .filter(
            (child) =>
              child.type === 'string_lit' || child.type === 'identifier',
          )
          .map((child) =>
            child.type === 'string_lit' ? child.text.slice(1, -1) : child.text,
          ),
        line: node.startPosition.row + 1,
        attributes: (
          children.find((child) => child.type === 'body')?.namedChildren ?? []
        )
          .filter((child) => child.type === 'attribute')
          .map((child) => child.namedChildren[0]?.text ?? ''),
      };
    });
    return {
      valid: !tree.rootNode.hasError,
      errors,
      inventory: blocks.filter((block) =>
        [
          'resource',
          'data',
          'module',
          'variable',
          'output',
          'provider',
        ].includes(block.type),
      ),
      blocks,
      tree: tree.rootNode.toString(),
    };
  } finally {
    tree?.delete();
    parser.delete();
  }
}
