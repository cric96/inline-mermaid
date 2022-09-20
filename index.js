import { fdatasync, promises } from 'fs'
import { JSDOM } from 'jsdom'
import temp from 'temp'
import path from 'path'
import toml from 'toml'
import core from '@actions/core'
import { run } from "@mermaid-js/mermaid-cli"
import find from 'recursive-path-finder-regexp'
// Initialization
temp.track() // manage clean of temporary file

// Utility functions
const readdir = promises.readdir
const zip = (a, b) => a.map((k, i) => [k, b[i]]);

/** Load the mermaid configuration from a reveal-hugo toml configuration */
async function getMarmaidFromToml(dirName, cssFile) {
  const config = await promises.readFile(dirName)
  const data = await toml.parse(config.toString())
  return { 
    parseMMDOptions: { 
      backgroundColor: "trasparent", 
      mermaidConfig : data.params.reveal_hugo.mermaid[0],
      myCss : cssFile
    }
  }
}

// Constants
const baseRegex = process.env.fileRegex //core.getInput('file-regex', {required : true})
const cssRegex = process.env.cssRegex
const baseFolder = process.env.rootFolder //core.getInput('root-folder', {required : true})
const tomlFile = process.env.configFile //process.env.configFilecore.getInput('config-file', {required : true})
core.info(
  "Configuration:\n" +
  `file-regex = ${baseRegex}\n` +
  `css-regex = ${cssRegex}\n` +
  `base folder = ${baseFolder}\n` +
  `toml configuration file = ${tomlFile}`
)

const cssFile = find(new RegExp(cssRegex), { basePath: baseFolder, isAbsoluteResultsPath: true })
if(cssFile && cssFile.length > 2) {
  core.setFailed(`The regex: ${cssRegex} match more then one file: \n ${cssFile.join("\n")}`)
}
const tomlConfiguration = getMarmaidFromToml(tomlFile, cssFile && cssFile.length == 1 ? cssFile[0] : undefined)
// Main functions
/**
 * Retrieve all index.html (starting from `dirName`) 
 * and convert each mermaid code into svg code
 * (NB! rewrite the index that it find!)
 * @param {String} dirName - the root dir in which the search will happen
 */
async function rewritePages(dirName) {
  // get all index.html (in all sub directories)
  const files = await getHtmlIndexes(dirName)
  // load the js dom environment to find every .mermaid instances
  const fileLoaded = await Promise.all(files.map(file => {
    console.log(file)
    return JSDOM.fromFile(file)
  }))
  // for each index, convert mermaid specification into plain svg code
  for (const element of zip(files, fileLoaded)) {
    await inlineSvgInPage(...element)
  }
}

/**
* Retrieve all index.html (starting from `dirName`) 
* @param {String} dirName - the root dir in which the search will happen
* @returns {Array} a list of all index.html 
*/
async function getHtmlIndexes(dirName) {
  return find(new RegExp(baseRegex), { basePath: dirName, isAbsoluteResultsPath: true });
}
/**
* Giving an html page, inline each mermaid code into an svg
* NB! It produces a side effect (i.e., it rewrites the `fileName` passed)
* @param {String} fileName - the file that will be transformed
* @param {*} page - the js dom representation of the file passed
*/
async function inlineSvgInPage(fileName, page) {
 // Find all mermaid code
  const mermaidContent = page.window.document.querySelectorAll(".mermaid")
  const elementsToUpdate = Array.from(mermaidContent)
   // transfrom only the class that are not already transformed
   .filter(element => element.attributes["data-processed"] === undefined)
  
  for(const element of elementsToUpdate) {
    let svgContent = await getSvg(element) // convert the mermaid code to svg code
    element.innerHTML = svgContent // put the svg code inside the mermaid div
    element.setAttribute("data-processed", "true") // mark as already processed (mermaid.js will not process again)
    element.setAttribute("pre-rendered", "true") // mark the div as pre-rendered
  }
  promises.writeFile(fileName, page.serialize()) // produce the side effect, i.e., writing the page with the svg inlined
}

/**
* Giving a div with a mermaid code, extract the svg representation using mermaid-cli
* @param {HTMLElement} element - the div tag with the mermaid code
* @returns {String} - the svg representation of the given mermaid code
*/
async function getSvg(element) {
 const mermaidConfig = await tomlConfiguration // get the configuration from hugo toml
 const htmlTemp = await temp.open({prefix: "html-append", suffix: ".md"}) // temp file for file input (mermaid code)
 const svgTemp = await temp.open({prefix: "svg-temp", suffix: ".svg"}) // temp file for file output (svg)
 const svgFilePath = path.parse(svgTemp.path)
 const mermaidContent = "```mermaid\n" + element.textContent + "```"  // prepare mermaid md
 const svgContent = await promises.writeFile(htmlTemp.path, mermaidContent) // write the mermaid code inside the temp file
   .then(() => run(htmlTemp.path, svgTemp.path, mermaidConfig )) // call mermaid cli to transform mermaid code into svg
   .then(() => promises.readFile(svgFilePath.dir + "/" + svgFilePath.name + "-1.svg")) // get the svg content
 return svgContent.toString()
}

rewritePages(baseFolder).then(value => console.log("Page rewriting complete!"))
