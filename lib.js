import {promises} from 'fs';
import temp from 'temp';
import path from 'path';
import toml from 'toml';
import {JSONPath} from 'jsonpath-plus';
import {run} from '@mermaid-js/mermaid-cli';

// Initialization
temp.track(); // manage clean of temporary file

// Prefix of the ids assigned to the generated SVGs
const svgIdPrefix = 'inline-mermaid-';

/**
 * Load the mermaid configuration from a reveal-hugo toml configuration.
 * @param {String} tomlFile - The toml file containing the configuration.
 * @param {String} cssFile - The CSS file used to style the diagrams (optional).
 * @param {String} configPath - The JSONPath of the mermaid configuration.
 * @return {Object} - The configuration for the mermaid CLI.
 */
export async function loadMermaidConfig(tomlFile, cssFile, configPath) {
  const config = await promises.readFile(tomlFile);
  const json = toml.parse(config.toString());
  // wrap: false returns the matched object rather than an array of matches
  const mermaidConfig = {
    ...JSONPath({path: configPath, json, wrap: false}),
  };
  if (cssFile) {
    // same as the --cssFile option of the mermaid CLI
    mermaidConfig.themeCSS = (await promises.readFile(cssFile)).toString();
  }
  return {
    parseMMDOptions: {
      backgroundColor: 'transparent',
      mermaidConfig,
    },
  };
}

/**
 * Given an HTML page, inline each mermaid code into an SVG.
 * Each SVG gets a unique id within the page: mermaid scopes the SVG styles
 * and markers (e.g., arrow heads) by id, so duplicated ids break the rendering.
 * @param {*} page - The JSDOM representation of the page, modified in place.
 * @param {Object} mermaidConfig - The configuration for the mermaid CLI.
 */
export async function inlineSvgInPage(page, mermaidConfig) {
  const document = page.window.document;
  // Find all mermaid code
  const mermaidContent = document.querySelectorAll('.mermaid');
  const elementsToUpdate = Array.from(mermaidContent)
  // transfrom only the class that are not already transformed
      .filter((element) => !element.hasAttribute('data-processed'));
  let counter = 0;
  for (const element of elementsToUpdate) {
    // find an id not already used in the page
    let svgId;
    do {
      svgId = `${svgIdPrefix}${counter++}`;
    } while (document.getElementById(svgId) !== null);
    // convert the mermaid code to svg code
    const svgContent = await getSvg(element.textContent, mermaidConfig, svgId);
    // put the svg code inside the mermaid div
    element.innerHTML = svgContent;
    // mark as already processed (mermaid.js will not process again)
    element.setAttribute('data-processed', 'true');
    // mark the div as pre-rendered
    element.setAttribute('pre-rendered', 'true');
  }
}

/**
 * Given mermaid code, extract the SVG representation using mermaid-cli.
 * @param {String} code - The mermaid code.
 * @param {Object} mermaidConfig - The configuration for the mermaid CLI.
 * @param {String} svgId - The id to assign to the generated SVG.
 * @return {String} - The SVG representation of the given mermaid code.
 */
export async function getSvg(code, mermaidConfig, svgId) {
  const config = {
    ...mermaidConfig,
    parseMMDOptions: {...mermaidConfig.parseMMDOptions, svgId},
    // Disable the Puppeteer sandbox
    puppeteerConfig: {args: ['--no-sandbox']},
  };
  // temp file for file input (mermaid code)
  const htmlTemp = await temp.open({prefix: 'html-append', suffix: '.md'});
  // temp file for file output (svg)
  const svgTemp = await temp.open({prefix: 'svg-temp', suffix: '.svg'});
  const svgFilePath = path.parse(svgTemp.path);
  // prepare mermaid md
  const mermaidContent = '```mermaid\n' + code + '\n```';
  try {
    // write the mermaid code inside the temp file
    await promises.writeFile(htmlTemp.path, mermaidContent);
    // call mermaid cli to transform mermaid code into svg
    await run(htmlTemp.path, svgTemp.path, config);
    // get the svg content
    const svgContent = await promises.readFile(
        path.join(svgFilePath.dir, svgFilePath.name + '-1.svg'),
    );
    return svgContent.toString();
  } catch (error) {
    throw Error(
        `Inline mermaid failed, mermaid content: \n` +
          `${mermaidContent} \n` +
          `cause: \n ${error}`,
        {cause: error},
    );
  }
}
