import {test} from 'node:test';
import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
import {inlineSvgInPage} from '../lib.js';

const flowchart = (name) => `
flowchart LR
  ${name}A --> ${name}B
  ${name}B --> ${name}C
`;

const mermaidConfig = {parseMMDOptions: {backgroundColor: 'transparent'}};

test('every inlined diagram gets unique ids', async () => {
  const page = new JSDOM(`<!DOCTYPE html><html><body>
    <div id="inline-mermaid-0">already taken</div>
    <div class="mermaid">${flowchart('x')}</div>
    <div class="mermaid">${flowchart('y')}</div>
    <div class="mermaid" data-processed="true">untouched</div>
  </body></html>`);
  await inlineSvgInPage(page, mermaidConfig);
  const document = page.window.document;
  const svgs = Array.from(document.querySelectorAll('.mermaid > svg'));
  assert.equal(svgs.length, 2);
  // no id in the whole page is duplicated
  const ids = Array.from(document.querySelectorAll('[id]')).map((e) => e.id);
  const duplicates = ids.filter((id, i) => ids.indexOf(id) !== i);
  assert.deepEqual(duplicates, []);
  // the svgs do not clash with pre-existing ids
  assert.ok(svgs.every((svg) => svg.id !== 'inline-mermaid-0'));
  // each svg's style is scoped to its own id
  for (const svg of svgs) {
    const style = svg.querySelector('style').textContent;
    assert.match(style, new RegExp(`#${svg.id}\\b`));
    const otherIds = svgs.filter((s) => s !== svg).map((s) => s.id);
    for (const other of otherIds) {
      assert.doesNotMatch(style, new RegExp(`#${other}\\b`));
    }
  }
  // already processed diagrams are left as they are
  assert.equal(
      document.querySelector('[data-processed="true"]:not([pre-rendered])')
          .textContent,
      'untouched',
  );
});
