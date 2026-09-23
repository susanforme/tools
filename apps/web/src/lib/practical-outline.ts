export type OutlineNode = {
  id: number;
  parent: number | null;
  depth: number;
  label: string;
};
export function parseOutline(source: string): OutlineNode[] {
  const nodes: OutlineNode[] = [],
    stack: OutlineNode[] = [];
  let headingDepth = 0;
  for (const line of source.split('\n')) {
    if (!line.trim()) continue;
    const heading = /^(#{1,6})\s+(.+)$/.exec(line),
      list = /^(\s*)[-*+]\s+(.+)$/.exec(line);
    if (!heading && !list) continue;
    const depth = heading
      ? heading[1].length - 1
      : headingDepth + Math.floor(list![1].replace(/\t/g, '  ').length / 2);
    if (depth > 12) throw new Error('outlineLimit');
    if (heading) headingDepth = depth + 1;
    while (stack.length && stack.at(-1)!.depth >= depth) stack.pop();
    const node = {
      id: nodes.length,
      parent: stack.at(-1)?.id ?? null,
      depth,
      label: (heading?.[2] ?? list![2]).slice(0, 120),
    };
    nodes.push(node);
    stack.push(node);
    if (nodes.length > 300) throw new Error('outlineLimit');
  }
  if (!nodes.length) throw new Error('invalid');
  return nodes;
}
export function visibleOutline(nodes: OutlineNode[], collapsed: number[]) {
  const hidden = new Set<number>();
  return nodes
    .filter((node) => {
      if (
        node.parent !== null &&
        (hidden.has(node.parent) || collapsed.includes(node.parent))
      ) {
        hidden.add(node.id);
        return false;
      }
      return true;
    })
    .map((node, index) => ({
      ...node,
      x: 20 + node.depth * 240,
      y: 20 + index * 56,
    }));
}
export function escapeHtml(value: string): string {
  return value.replace(
    /[&<>"']/g,
    (char) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[
        char
      ]!,
  );
}
export function slideDocument(slides: string[], theme: string): string {
  const dark = theme === 'dark',
    blue = theme === 'blue';
  return `<!doctype html><html><meta charset="utf-8"><meta name="viewport" content="width=device-width"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; img-src data: https:; script-src 'unsafe-inline';"><title>Slides</title><style>body{margin:0;font:clamp(16px,3vw,38px)/1.5 system-ui;background:${dark ? '#111827' : blue ? '#eff6ff' : '#fff'};color:${dark ? '#f9fafb' : '#111827'}}section{box-sizing:border-box;min-height:100vh;padding:6vw;overflow-wrap:anywhere}img{max-width:100%;max-height:65vh}pre{overflow:auto}table{border-collapse:collapse}td,th{border:1px solid;padding:.3em}section:not(:target){display:none}section:first-of-type{display:block}body:has(section:target) section:first-of-type:not(:target){display:none}@media print{section,section:not(:target){display:block!important;break-after:page;height:100vh}a{color:inherit}}</style>${slides.map((slide, i) => `<section id="slide-${i}">${slide}</section>`).join('')}<script>let i=0;onkeydown=e=>{if(['ArrowRight','PageDown',' ','ArrowLeft','PageUp','Home','End'].includes(e.key)){e.preventDefault();i=e.key==='Home'?0:e.key==='End'?${slides.length - 1}:Math.max(0,Math.min(${slides.length - 1},i+(['ArrowLeft','PageUp'].includes(e.key)?-1:1)));location.hash='slide-'+i}};<\/script></html>`;
}
