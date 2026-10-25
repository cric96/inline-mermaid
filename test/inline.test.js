import {test} from 'node:test';
import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
import {parse, generate, walk} from 'css-tree';
import {inlineSvgInPage, scopeCss} from '../lib.js';

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

test('inlined diagram styles do not leak into the page', async () => {
  const page = new JSDOM(`<!DOCTYPE html><html><body>
    <div class="mermaid">
flowchart LR
  A -- "fas:fa-link" --> B["fab:fa-github"]
    </div>
  </body></html>`);
  await inlineSvgInPage(page, mermaidConfig);
  const svg = page.window.document.querySelector('.mermaid > svg');
  const styles = Array.from(svg.querySelectorAll('style'));
  // mermaid-cli embeds the Font Awesome stylesheets used by the diagram
  assert.ok(styles.some((style) => style.textContent.includes('Font Awesome')));
  for (const style of styles) {
    walk(parse(style.textContent), {
      visit: 'Rule',
      enter(rule) {
        if (!this.atrule?.name.endsWith('keyframes')) {
          for (const selector of rule.prelude.children) {
            assert.match(generate(selector), new RegExp(`^#${svg.id}\\b`));
          }
        }
      },
    });
  }
});

test('stylesheets are scoped to the given id', () => {
  const css = `/* license */
@font-face { font-family: "Icons"; src: url(icons.woff2); }
:root, :host { --icons: "Icons"; }
.icon, .icon-bold::before { font-family: var(--icons); }
body .icon { color: red; }
#scope .node { fill: blue; }
@keyframes spin { from { rotate: 0deg; } to { rotate: 360deg; } }
@media (min-width: 10px) { :is(.a, .b) > .c { color: green; } }`;
  const scoped = scopeCss(css, 'scope');
  // licenses are preserved
  assert.match(scoped, /\/\* license \*\//);
  // at-rules that cannot be scoped are untouched
  assert.match(scoped, /@font-face\{font-family:"Icons"/);
  assert.match(scoped, /@keyframes spin\{from\{rotate:0deg\}to\{/);
  // the document root becomes the scope
  assert.match(scoped, /#scope,#scope\{--icons: ?"Icons"\}/);
  assert.match(scoped, /#scope \.icon\{color:red\}/);
  // the other selectors are restricted to the scope descendants
  assert.match(scoped, /#scope \.icon,#scope \.icon-bold::before\{/);
  assert.match(
      scoped,
      /@media \(min-width:10px\)\{#scope :is\(\.a,\.b\)>\.c\{/,
  );
  // already scoped selectors are left as they are
  assert.match(scoped, /\}#scope \.node\{fill:blue\}/);
  // stylesheets that need no scoping are not rewritten
  const alreadyScoped = '#scope .node {\n  fill: blue;\n}';
  assert.equal(scopeCss(alreadyScoped, 'scope'), alreadyScoped);
});
