import {test} from 'node:test';
import assert from 'node:assert/strict';
import {promises} from 'fs';
import os from 'os';
import path from 'path';
import {JSDOM} from 'jsdom';
import {inlineSvgInPage, loadMermaidConfig} from '../lib.js';

const configPath = '$.params.reveal_hugo.mermaid[0]';
const css = '.inline-mermaid-test { fill: #123456; }';

/**
 * Write a reveal-hugo toml configuration and a CSS file in a temp folder.
 * @return {Object} - The paths of the toml and CSS files.
 */
async function writeFixtures() {
  const dir = await promises.mkdtemp(path.join(os.tmpdir(), 'inline-mermaid-'));
  const tomlFile = path.join(dir, 'config.toml');
  const cssFile = path.join(dir, 'style.css');
  await promises.writeFile(tomlFile, `
[[params.reveal_hugo.mermaid]]
startOnLoad = false
theme = "forest"
`);
  await promises.writeFile(cssFile, css);
  return {tomlFile, cssFile};
}

test('the toml mermaid configuration is passed to mermaid', async () => {
  const {tomlFile, cssFile} = await writeFixtures();
  const config = await loadMermaidConfig(tomlFile, cssFile, configPath);
  assert.deepEqual(config.parseMMDOptions, {
    backgroundColor: 'transparent',
    mermaidConfig: {startOnLoad: false, theme: 'forest', themeCSS: css},
  });
  const noCss = await loadMermaidConfig(tomlFile, undefined, configPath);
  assert.deepEqual(
      noCss.parseMMDOptions.mermaidConfig,
      {startOnLoad: false, theme: 'forest'},
  );
});

test('a missing mermaid configuration falls back to the defaults', async () => {
  const {tomlFile} = await writeFixtures();
  const config = await loadMermaidConfig(tomlFile, undefined, '$.nope');
  assert.deepEqual(config.parseMMDOptions.mermaidConfig, {});
});

test('the theme and the CSS are applied to the rendered svg', async () => {
  const {tomlFile, cssFile} = await writeFixtures();
  const config = await loadMermaidConfig(tomlFile, cssFile, configPath);
  const page = new JSDOM(
      '<div class="mermaid">flowchart LR\n  A --> B\n</div>',
  );
  await inlineSvgInPage(page, config);
  const style = page.window.document.querySelector('svg style').textContent;
  // primary color of the forest theme
  assert.match(style, /#cde498/i);
  // the CSS is scoped to the svg (mermaid normalizes colors to rgb)
  const scoped = '#inline-mermaid-0 \\.inline-mermaid-test\\{fill:';
  assert.match(style, new RegExp(`${scoped}(#123456|rgb\\(18, 52, 86\\))`));
});
