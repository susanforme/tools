import type { PDFDict, PDFDocument } from 'pdf-lib';
export type FormValue = string | string[] | boolean;
export type FormField = {
  name: string;
  kind: 'text' | 'checkbox' | 'radio' | 'select' | 'list' | 'unsupported';
  value: FormValue;
  options: string[];
  readonly: boolean;
  multiple: boolean;
};
export type PdfBookmark = {
  id: string;
  title: string;
  page: number | null;
  level: number;
};
const LIMIT = 20 * 1024 * 1024;
async function load(bytes: Uint8Array) {
  if (bytes.length > LIMIT) throw new Error('fileLimit');
  const { PDFDocument } = await import('pdf-lib');
  const doc = await PDFDocument.load(bytes);
  if (doc.getPageCount() > 500 || doc.getForm().getFields().length > 500)
    throw new Error('fileLimit');
  return doc;
}
async function fieldsOf(doc: PDFDocument): Promise<FormField[]> {
  const p = await import('pdf-lib');
  return doc
    .getForm()
    .getFields()
    .map((field) => {
      const common = {
        name: field.getName(),
        options: [] as string[],
        readonly: field.isReadOnly(),
        multiple: false,
      };
      if (field instanceof p.PDFTextField)
        return { ...common, kind: 'text', value: field.getText() ?? '' };
      if (field instanceof p.PDFCheckBox)
        return { ...common, kind: 'checkbox', value: field.isChecked() };
      if (field instanceof p.PDFRadioGroup)
        return {
          ...common,
          kind: 'radio',
          value: field.getSelected() ?? '',
          options: field.getOptions(),
        };
      if (field instanceof p.PDFDropdown)
        return {
          ...common,
          kind: 'select',
          multiple: field.isMultiselect(),
          value: field.getSelected(),
          options: field.getOptions(),
        };
      if (field instanceof p.PDFOptionList)
        return {
          ...common,
          kind: 'list',
          multiple: field.isMultiselect(),
          value: field.getSelected(),
          options: field.getOptions(),
        };
      return { ...common, kind: 'unsupported', value: '', readonly: true };
    });
}
async function outlinesOf(doc: PDFDocument) {
  const { PDFName, PDFDict, PDFArray, PDFRef, PDFString, PDFHexString } =
    await import('pdf-lib');
  const result: PdfBookmark[] = [],
    originals = new Map<string, PDFDict>(),
    visited = new Set<PDFDict>();
  const root = doc.catalog.lookupMaybe(PDFName.of('Outlines'), PDFDict);
  const pages = doc.getPages().map((p) => p.ref.toString());
  const walk = (first: unknown, level: number) => {
    let node = first;
    while (node instanceof PDFDict) {
      if (level > 16 || visited.has(node) || result.length >= 500)
        throw new Error('fileLimit');
      visited.add(node);
      const title = node.lookup(PDFName.of('Title'));
      const target = node.lookup(PDFName.of('Dest'));
      const action = node.lookup(PDFName.of('A'));
      const dest =
        target ??
        (action instanceof PDFDict ? action.lookup(PDFName.of('D')) : null);
      const pageRef = dest instanceof PDFArray ? dest.get(0) : null;
      const page =
        pageRef instanceof PDFRef ? pages.indexOf(pageRef.toString()) + 1 : 0;
      const id = `outline-${result.length}`;
      result.push({
        id,
        title:
          title instanceof PDFString || title instanceof PDFHexString
            ? title.decodeText()
            : '',
        page: page || null,
        level,
      });
      originals.set(id, node);
      walk(node.lookup(PDFName.of('First')), level + 1);
      node = node.lookup(PDFName.of('Next'));
    }
  };
  if (root) walk(root.lookup(PDFName.of('First')), 1);
  return { result, originals };
}
export async function inspectPdfAdvanced(bytes: Uint8Array) {
  const doc = await load(bytes);
  return {
    fields: await fieldsOf(doc),
    bookmarks: (await outlinesOf(doc)).result,
    pages: doc.getPageCount(),
  };
}
export function importFormData(
  source: string,
  fields: FormField[],
): FormField[] {
  if (source.length > 2 * 1024 * 1024) throw new Error('fileLimit');
  const parsed: unknown = JSON.parse(source);
  if (!Array.isArray(parsed) || parsed.length !== fields.length)
    throw new Error('formData');
  const values = new Map<string, FormValue>();
  for (const entry of parsed) {
    if (
      !entry ||
      typeof entry !== 'object' ||
      typeof entry.name !== 'string' ||
      values.has(entry.name) ||
      !(
        typeof entry.value === 'string' ||
        typeof entry.value === 'boolean' ||
        (Array.isArray(entry.value) &&
          entry.value.every((v: unknown) => typeof v === 'string'))
      )
    )
      throw new Error('formData');
    values.set(entry.name, entry.value);
  }
  return fields.map((field) => {
    const value = values.get(field.name);
    if (
      value === undefined ||
      typeof value !== typeof field.value ||
      Array.isArray(value) !== Array.isArray(field.value) ||
      (field.readonly && JSON.stringify(value) !== JSON.stringify(field.value))
    )
      throw new Error('formData');
    if (
      (field.kind === 'radio' &&
        value !== '' &&
        !field.options.includes(value as string)) ||
      (Array.isArray(value) &&
        ((!field.multiple && value.length > 1) ||
          value.some((v) => !field.options.includes(v))))
    )
      throw new Error('formData');
    return { ...field, value };
  });
}
export async function fillPdf(
  bytes: Uint8Array,
  values: FormField[],
  flatten: boolean,
  fontBytes?: Uint8Array,
) {
  const doc = await load(bytes);
  const p = await import('pdf-lib');
  const original = await fieldsOf(doc);
  const fields = importFormData(
    JSON.stringify(values.map(({ name, value }) => ({ name, value }))),
    original,
  );
  let font;
  if (fontBytes) {
    if (fontBytes.length > LIMIT) throw new Error('fileLimit');
    const fontkit = (await import('@pdf-lib/fontkit')).default;
    doc.registerFontkit(fontkit);
    font = await doc.embedFont(fontBytes, { subset: true });
  } else font = await doc.embedFont(p.StandardFonts.Helvetica);
  const supported = new Set(font.getCharacterSet());
  for (const field of fields) {
    if (field.readonly) continue;
    const text = Array.isArray(field.value)
      ? field.value.join('')
      : typeof field.value === 'string'
        ? field.value
        : '';
    if (
      [...text].some(
        (c) =>
          !['\n', '\r', '\t'].includes(c) && !supported.has(c.codePointAt(0)!),
      )
    )
      throw new Error(fontBytes ? 'fontMissing' : 'uploadFont');
    const actual = doc.getForm().getField(field.name);
    if (actual instanceof p.PDFTextField) actual.setText(field.value as string);
    else if (actual instanceof p.PDFCheckBox) {
      if (field.value) actual.check();
      else actual.uncheck();
    } else if (actual instanceof p.PDFRadioGroup) {
      if (field.value) actual.select(field.value as string);
      else actual.clear();
    } else if (
      actual instanceof p.PDFDropdown ||
      actual instanceof p.PDFOptionList
    ) {
      actual.clear();
      if ((field.value as string[]).length)
        actual.select(field.value as string[]);
    }
  }
  doc.getForm().updateFieldAppearances(font);
  if (flatten) doc.getForm().flatten({ updateFieldAppearances: false });
  return doc.save({ updateFieldAppearances: false });
}
export async function writePdfBookmarks(
  bytes: Uint8Array,
  bookmarks: PdfBookmark[],
) {
  const doc = await load(bytes);
  const { PDFName, PDFHexString } = await import('pdf-lib');
  const { originals } = await outlinesOf(doc);
  if (bookmarks.length > 500) throw new Error('fileLimit');
  let previous = 0;
  for (const mark of bookmarks) {
    if (
      !mark.title.trim() ||
      mark.title.length > 500 ||
      !Number.isInteger(mark.level) ||
      mark.level < 1 ||
      mark.level > 16 ||
      mark.level > previous + 1 ||
      (mark.page === null
        ? !originals.has(mark.id)
        : !Number.isInteger(mark.page) ||
          mark.page < 1 ||
          mark.page > doc.getPageCount())
    )
      throw new Error('bookmarkData');
    previous = mark.level;
  }
  if (!bookmarks.length) {
    doc.catalog.delete(PDFName.of('Outlines'));
    return doc.save({ updateFieldAppearances: false });
  }
  const context = doc.context,
    root = context.obj({ Type: 'Outlines' }),
    rootRef = context.register(root);
  const nodes = bookmarks.map((mark) => {
    const dict = context.obj({ Title: PDFHexString.fromText(mark.title) });
    if (mark.page !== null)
      dict.set(
        PDFName.of('Dest'),
        context.obj([doc.getPage(mark.page - 1).ref, 'Fit']),
      );
    else {
      const original = originals.get(mark.id)!;
      for (const key of ['Dest', 'A']) {
        const value = original.get(PDFName.of(key));
        if (value) dict.set(PDFName.of(key), value);
      }
    }
    return { dict, ref: context.register(dict), level: mark.level, parent: -1 };
  });
  const stack: number[] = [];
  nodes.forEach((node, i) => {
    while (stack.length >= node.level) stack.pop();
    node.parent = stack.at(-1) ?? -1;
    node.dict.set(
      PDFName.of('Parent'),
      node.parent === -1 ? rootRef : nodes[node.parent].ref,
    );
    stack.push(i);
  });
  const linkChildren = (parent: number) => {
    const children = nodes
      .map((node, i) => ({ node, i }))
      .filter(({ node }) => node.parent === parent);
    const target = parent === -1 ? root : nodes[parent].dict;
    if (!children.length) return 0;
    target.set(PDFName.of('First'), children[0].node.ref);
    target.set(PDFName.of('Last'), children.at(-1)!.node.ref);
    let count = 0;
    children.forEach(({ node, i }, index) => {
      if (index)
        node.dict.set(PDFName.of('Prev'), children[index - 1].node.ref);
      if (index + 1 < children.length)
        node.dict.set(PDFName.of('Next'), children[index + 1].node.ref);
      count += 1 + linkChildren(i);
    });
    target.set(PDFName.of('Count'), context.obj(count));
    return count;
  };
  linkChildren(-1);
  doc.catalog.set(PDFName.of('Outlines'), rootRef);
  return doc.save({ updateFieldAppearances: false });
}
