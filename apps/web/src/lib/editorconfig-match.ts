export type VirtualEditorConfig = { path: string; content: string };
export type EditorConfigMatch = {
  properties: { key: string; value: string; source: string }[];
  history: { key: string; value: string; source: string }[];
};
function normalizePath(value: string): string {
  if (
    !value.startsWith('/') ||
    value.includes('\\') ||
    value.split('/').some((p) => p === '..' || p === '.')
  )
    throw new Error('editorPath');
  return value.replace(/\/{2,}/g, '/');
}
export async function matchEditorConfig(
  target: string,
  input: string,
): Promise<EditorConfigMatch> {
  if (input.length > 1024 * 1024) throw new Error('sizeLimit');
  const path = normalizePath(target);
  const files: unknown = JSON.parse(input);
  if (!Array.isArray(files) || files.length > 100)
    throw new Error('editorFormat');
  const match = (await import('picomatch')).default;
  const seen = new Set<string>();
  const relevant = files
    .map((raw: unknown) => {
      if (!raw || typeof raw !== 'object') throw new Error('editorFormat');
      const file = raw as Record<string, unknown>;
      if (typeof file.path !== 'string' || typeof file.content !== 'string')
        throw new Error('editorFormat');
      const filePath = normalizePath(file.path);
      if (!filePath.endsWith('/.editorconfig') || seen.has(filePath))
        throw new Error('editorFormat');
      seen.add(filePath);
      let section: string | null = null,
        root = false;
      const rules: {
        section: string;
        key: string;
        value: string;
        line: number;
      }[] = [];
      file.content
        .replace(/^\uFEFF/, '')
        .split(/\r?\n/)
        .forEach((rawLine, index) => {
          const line = rawLine.trim();
          if (!line || /^[#;]/.test(line)) return;
          if (line.startsWith('[') && line.endsWith(']')) {
            section = line.slice(1, -1);
            if (section.length > 1024) throw new Error('editorFormat');
            return;
          }
          const equal = line.indexOf('=');
          if (equal < 1) throw new Error('editorFormat');
          const key = line.slice(0, equal).trim().toLowerCase();
          let value = line.slice(equal + 1).trim();
          if (section === null) {
            if (key === 'root') root = value.toLowerCase() === 'true';
            return;
          }
          if (
            [
              'indent_style',
              'indent_size',
              'tab_width',
              'end_of_line',
              'charset',
              'trim_trailing_whitespace',
              'insert_final_newline',
            ].includes(key) ||
            value.toLowerCase() === 'unset'
          )
            value = value.toLowerCase();
          rules.push({ section, key, value, line: index + 1 });
        });
      return {
        filePath,
        directory: filePath.slice(0, -'.editorconfig'.length),
        root,
        rules,
      };
    })
    .filter((file) => path.startsWith(file.directory))
    .sort((a, b) => a.directory.length - b.directory.length);
  let rootIndex = -1;
  relevant.forEach((file, index) => {
    if (file.root) rootIndex = index;
  });
  const history: EditorConfigMatch['history'] = [],
    properties = new Map<
      string,
      { key: string; value: string; source: string }
    >();
  for (const file of relevant.slice(Math.max(0, rootIndex)))
    for (const rule of file.rules) {
      const relative = path.slice(file.directory.length);
      const glob = rule.section.startsWith('/')
        ? rule.section.slice(1)
        : rule.section;
      // 禁止 glob 扩展语法；EditorConfig 的无斜杠规则匹配任意深度文件名。
      const pattern = rule.section.includes('/') ? glob : `**/${glob}`;
      if (
        !match(pattern, {
          dot: true,
          noext: true,
          nonegate: true,
          posix: true,
          expandRange: (from: string, to: string) => {
            const start = Number(from),
              end = Number(to);
            if (
              !Number.isSafeInteger(start) ||
              !Number.isSafeInteger(end) ||
              start >= end ||
              end - start > 10000
            )
              throw new Error('editorRange');
            return `(${Array.from({ length: end - start + 1 }, (_, i) => String(start + i)).join('|')})`;
          },
        })(relative)
      )
        continue;
      const row = {
        key: rule.key,
        value: rule.value,
        source: `${file.filePath}:${rule.line} [${rule.section}]`,
      };
      history.push(row);
      if (rule.value === 'unset') properties.delete(rule.key);
      else properties.set(rule.key, row);
    }
  const style = properties.get('indent_style'),
    indent = properties.get('indent_size'),
    width = properties.get('tab_width');
  if (!indent && style?.value === 'tab')
    properties.set('indent_size', {
      key: 'indent_size',
      value: width?.value ?? 'tab',
      source: style.source,
    });
  if (indent && !width && /^\d+$/.test(indent.value))
    properties.set('tab_width', {
      key: 'tab_width',
      value: indent.value,
      source: indent.source,
    });
  if (indent?.value === 'tab' && width)
    properties.set('indent_size', {
      ...indent,
      value: width.value,
      source: width.source,
    });
  return { history, properties: [...properties.values()] };
}
