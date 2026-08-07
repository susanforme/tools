export function svgToDataUri(svg: string): string {
  return `data:image/svg+xml,${encodeURIComponent(svg)
    .replace(/'/g, '%27')
    .replace(/"/g, '%22')}`;
}

function parseSafeSvg(source: string): XMLDocument {
  const document = new DOMParser().parseFromString(source, 'image/svg+xml');
  if (document.querySelector('parsererror')) throw new Error('SVG 格式无效');
  document
    .querySelectorAll('script, foreignObject')
    .forEach((node) => node.remove());
  document.querySelectorAll('*').forEach((element) => {
    [...element.attributes].forEach((attribute) => {
      if (
        /^on/i.test(attribute.name) ||
        ((attribute.name === 'href' || attribute.name === 'xlink:href') &&
          /^(?:https?:|javascript:)/i.test(attribute.value.trim()))
      ) {
        element.removeAttribute(attribute.name);
      }
    });
  });
  return document;
}

export function sanitizeSvg(source: string): string {
  return new XMLSerializer().serializeToString(parseSafeSvg(source));
}

export function createSvgSprite(
  files: Array<{ name: string; source: string }>,
): string {
  const symbols = files.map(({ name, source }, index) => {
    let document: XMLDocument;
    try {
      document = parseSafeSvg(source);
    } catch {
      throw new Error(`${name} 不是有效 SVG`);
    }
    const svg = document.documentElement;
    const viewBox =
      svg.getAttribute('viewBox') ??
      `0 0 ${svg.getAttribute('width') ?? 24} ${svg.getAttribute('height') ?? 24}`;
    const id = (
      name.replace(/\.svg$/i, '').replace(/[^a-z0-9_-]/gi, '-') ||
      `icon-${index + 1}`
    ).toLowerCase();
    return `<symbol id="${id}" viewBox="${viewBox}">${svg.innerHTML}</symbol>`;
  });
  return `<svg xmlns="http://www.w3.org/2000/svg"><defs>${symbols.join('')}</defs></svg>`;
}

const JSX_ATTRIBUTE_NAMES: Record<string, string> = {
  class: 'className',
  for: 'htmlFor',
  tabindex: 'tabIndex',
  'xlink:href': 'xlinkHref',
};

function jsxAttributeName(name: string): string {
  return (
    JSX_ATTRIBUTE_NAMES[name] ??
    name.replace(/[-:]([a-z])/g, (_, letter: string) => letter.toUpperCase())
  );
}

function quote(value: string): string {
  return JSON.stringify(value).replace(/</g, '\\u003c');
}

function elementToJsx(element: Element): string {
  const attributes = [...element.attributes]
    .filter((attribute) => !/^on/i.test(attribute.name))
    .map((attribute) => {
      if (attribute.name === 'style') {
        const entries = attribute.value
          .split(';')
          .map((item) => item.split(':', 2).map((part) => part.trim()))
          .filter((item): item is [string, string] =>
            Boolean(item[0] && item[1]),
          )
          .map(([name, value]) => `${jsxAttributeName(name)}: ${quote(value)}`);
        return `style={{ ${entries.join(', ')} }}`;
      }
      return `${jsxAttributeName(attribute.name)}=${quote(attribute.value)}`;
    });
  if (element.tagName.toLowerCase() === 'svg') attributes.push('{...props}');
  const children = [...element.childNodes]
    .map((node) => {
      if (node.nodeType === Node.ELEMENT_NODE) {
        const child = node as Element;
        if (['script', 'foreignobject'].includes(child.tagName.toLowerCase())) {
          return '';
        }
        return elementToJsx(child);
      }
      if (node.nodeType !== Node.TEXT_NODE || !node.textContent?.trim())
        return '';
      return `{${quote(node.textContent)}}`;
    })
    .join('');
  const opening = `<${element.tagName.toLowerCase()}${attributes.length ? ` ${attributes.join(' ')}` : ''}`;
  return children
    ? `${opening}>${children}</${element.tagName.toLowerCase()}>`
    : `${opening} />`;
}

export function svgToReactComponent(svg: string): string {
  const document = parseSafeSvg(svg);
  return `import type { SVGProps } from 'react';\n\nexport function SvgIcon(props: SVGProps<SVGSVGElement>) {\n  return (${elementToJsx(document.documentElement)});\n}\n`;
}
