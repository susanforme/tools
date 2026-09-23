import { expect, it } from 'vitest';
import { PDFDocument, PDFName, PDFString } from 'pdf-lib';
import {
  fillPdf,
  inspectPdfAdvanced,
  importFormData,
  writePdfBookmarks,
} from './pdf-advanced';
it('reads and fills forms, checks data shape and flattens a saved PDF', async () => {
  const doc = await PDFDocument.create();
  const page = doc.addPage();
  const form = doc.getForm();
  const name = form.createTextField('name');
  name.addToPage(page, { x: 10, y: 20, width: 100, height: 20 });
  const check = form.createCheckBox('accept');
  check.addToPage(page, { x: 10, y: 50, width: 20, height: 20 });
  const dropdown = form.createDropdown('color');
  dropdown.addOptions(['red', 'blue']);
  dropdown.addToPage(page, { x: 10, y: 80, width: 100, height: 20 });
  const bytes = await doc.save();
  const input = await inspectPdfAdvanced(bytes);
  const fields = importFormData(
    JSON.stringify([
      { name: 'name', value: 'Ada' },
      { name: 'accept', value: true },
      { name: 'color', value: ['blue'] },
    ]),
    input.fields,
  );
  const saved = await fillPdf(bytes, fields, false);
  const read = await inspectPdfAdvanced(saved);
  expect(read.fields.map((f) => f.value)).toEqual(['Ada', true, ['blue']]);
  expect(
    (await inspectPdfAdvanced(await fillPdf(bytes, fields, true))).fields,
  ).toEqual([]);
  expect(() => importFormData('[{"name":"name","value":3}]', fields)).toThrow();
  await expect(
    fillPdf(
      bytes,
      fields.map((f) => (f.name === 'name' ? { ...f, value: '中文' } : f)),
      false,
    ),
  ).rejects.toThrow('uploadFont');
});
it('roundtrips hierarchical bookmarks and preserves unresolved actions', async () => {
  const doc = await PDFDocument.create();
  doc.addPage();
  doc.addPage();
  const bytes = await doc.save();
  const marks = [
    { id: '', title: '第一章', page: 1, level: 1 },
    { id: '', title: 'Details', page: 2, level: 2 },
    { id: '', title: 'Next', page: 2, level: 1 },
  ];
  const saved = await writePdfBookmarks(bytes, marks);
  expect(
    (await inspectPdfAdvanced(saved)).bookmarks.map(
      ({ id: _, ...rest }) => rest,
    ),
  ).toEqual(marks.map(({ id: _, ...rest }) => rest));
  await expect(
    writePdfBookmarks(bytes, [{ ...marks[0], level: 2 }]),
  ).rejects.toThrow('bookmarkData');
  expect(
    (await inspectPdfAdvanced(await writePdfBookmarks(saved, []))).bookmarks,
  ).toEqual([]);
  const linked = await PDFDocument.load(saved);
  const root = linked.context.obj({ Type: 'Outlines' }),
    rootRef = linked.context.register(root);
  const mark = linked.context.obj({
      Title: PDFString.of('Site'),
      Parent: rootRef,
      A: { S: 'URI', URI: PDFString.of('https://example.com') },
    }),
    markRef = linked.context.register(mark);
  root.set(PDFName.of('First'), markRef);
  root.set(PDFName.of('Last'), markRef);
  linked.catalog.set(PDFName.of('Outlines'), rootRef);
  const linkedBytes = await linked.save();
  const model = (await inspectPdfAdvanced(linkedBytes)).bookmarks;
  expect(model[0].page).toBeNull();
  const updated = await writePdfBookmarks(linkedBytes, [
    { ...model[0], title: 'Renamed' },
  ]);
  expect((await inspectPdfAdvanced(updated)).bookmarks[0]).toMatchObject({
    title: 'Renamed',
    page: null,
  });
});
