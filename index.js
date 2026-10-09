import {promises} from 'fs';
import {JSDOM} from 'jsdom';
import {JSONPath} from 'jsonpath-plus';
import toml from 'toml';
import core from '@actions/core';
import find from 'recursive-path-finder-regexp';
import {inlineSvgInPage} from './lib.js';

// Utility functions
const zip = (a, b) => a.map((k, i) => [k, b[i]]);

/**
 * Load the mermaid configuration from a reveal-hugo toml configuration.
 * @param {String} dirName - The folder in which the configuration is located.
 * @param {String} cssFile - The CSS file used for the mermaid configuration.
 * @param {String} configPath - The regex path of json-path-all to retrieve the mermaid configuration.
 * @return {Object} - The configuration for the mermaid CLI.
 */
async function getMarmaidFromToml(dirName, cssFile, configPath) {
  const config = await promises.readFile(dirName);
  const data = await toml.parse(config.toString());
  const json = JSON.parse(JSON.stringify(data));
  const mermaidJson = new JSONPath({path: configPath, json});
  return {
    parseMMDOptions: {
      backgroundColor: 'trasparent',
      mermaidConfig: mermaidJson,
      myCss: cssFile,
    },
  };
}

// Constants
const baseRegex = process.env.fileRegex;
const cssRegex = process.env.cssRegex;
const baseFolder = process.env.rootFolder;
const tomlFile = process.env.configFile;
const configPath = process.env.configPath;

core.info(
    'Configuration:\n' +
  `file-regex = ${baseRegex}\n` +
  `css-regex = ${cssRegex}\n` +
  `base folder = ${baseFolder}\n` +
  `toml configuration file = ${tomlFile}`,
);

const cssFile = find(
    new RegExp(cssRegex),
    {
      basePath: baseFolder,
      isAbsoluteResultsPath: true,
    },
);
if (cssFile && cssFile.length > 2) {
  core.setFailed(`
    The regex: ${cssRegex} match more then one file: \n  ${cssFile.join('\n')}`,
  );
}

const cssFilePassed = cssFile && cssFile.length == 1 ? cssFile[0] : undefined;
const tomlConfiguration =
  getMarmaidFromToml(tomlFile, cssFilePassed, configPath);
// Main functions
/**
 * Retrieve all index.html files starting from `dirName` and convert each mermaid code into SVG code.
 * NB! Rewrites the index files it finds!
 * @param {String} dirName - The root directory in which the search will occur.
 */
async function rewritePages(dirName) {
  // get all index.html (in all sub directories)
  const files = await getHtmlIndexes(dirName);
  // load the js dom environment to find every .mermaid instances
  const fileLoaded = await Promise.all(files.map((file) => {
    console.log(file);
    return JSDOM.fromFile(file);
  }));
  // for each index, convert mermaid specification into plain svg code
  const mermaidConfig = await tomlConfiguration;
  for (const [file, page] of zip(files, fileLoaded)) {
    await inlineSvgInPage(page, mermaidConfig);
    // produce the side effect, i.e., writing the page with the svg inlined
    await promises.writeFile(file, page.serialize());
  }
}

/**
 * Retrieve all index.html files starting from `dirName`.
 * @param {String} dirName - The root directory in which the search will occur.
 * @return {Array} - A list of all index.html files.
 */
async function getHtmlIndexes(dirName) {
  return find(
      new RegExp(baseRegex),
      {
        basePath: dirName,
        isAbsoluteResultsPath: true,
      },
  );
}
rewritePages(baseFolder)
    .then((value) => console.log('Page rewriting complete!'));
