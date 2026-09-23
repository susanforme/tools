// @vitest-environment jsdom
import { it, expect } from 'vitest';
import { zipSync, strToU8 } from 'fflate';
import { extractSearchDocument } from './document-search-extraction';
it('extracts DOCX body, headers and footnotes without executing XML', async () => {
  const bytes = zipSync({
    'word/document.xml': strToU8(
      '<w:document xmlns:w="word"><w:p><w:r><w:t>Hello</w:t></w:r><w:r><w:t> world</w:t></w:r></w:p></w:document>',
    ),
    'word/header1.xml': strToU8(
      '<w:hdr xmlns:w="word"><w:p><w:r><w:t>Header</w:t></w:r></w:p></w:hdr>',
    ),
  });
  const file = new File([bytes], 'test.docx');
  Object.defineProperty(file, 'arrayBuffer', {
    value: async () => bytes.buffer,
  });
  const result = await extractSearchDocument(file);
  expect(result.sections).toEqual([
    { label: 'document.xml', text: 'Hello world' },
    { label: 'header1.xml', text: 'Header' },
  ]);
});
