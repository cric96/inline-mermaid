import { fdatasync, promises } from 'fs'
import { JSDOM } from 'jsdom'
import temp from 'temp'
import path from 'path'
import toml from 'toml'
import core from '@actions/core'
import { run } from "@mermaid-js/mermaid-cli"

// Initialization
temp.track() // manage clean of temporary file

// Utility functions
const readdir = promises.readdir
const zip = (a, b) => a.map((k, i) => [k, b[i]]);

/** Load the mermaid configuration from a reveal-hugo toml configuration */
async function getMarmaidFromToml(dirName) {
  const config = await promises.readFile(dirName)
  const data = await toml.parse(config.toString())
  return { 
    parseMMDOptions: { 
      backgroundColor: "trasparent", 
      mermaidConfig : data.params.reveal_hugo.mermaid[0] 
    }
  }
}

// Constants 
const baseRegex = core.getInput('file-regex', {required : true})
const extensionAccepted = ".html"
const baseFolder = core.getInput('root-folder', {required : true})
const tomlFile = core.getInput('config-file', {required : true})
core.info(`Configuration: \n regex = ${baseRegex}; \n base folder = ${baseFolder}; \n toml configuration file = ${await tomlFile}`)

const tomlConfiguration = getMarmaidFromToml(tomlFile)
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
 const fileLoaded = await Promise.all(files.map(file => JSDOM.fromFile(file)))
 // for each index, convert mermaid specification into plain svg code
 const transformations = zip(files, fileLoaded).map(async element => await inlineSvgInPage(...element))
 await Promise.all(transformations)
}

/**
* Retrieve all index.html (starting from `dirName`) 
* @param {String} dirName - the root dir in which the search will happen
* @returns {Array} a list of all index.html 
*/
async function getHtmlIndexes(dirName) {
 // All local file starting from dirName
 const files = await readdir(dirName, { withFileTypes: true });
 // For each directory, another search starts
 let indexesPromises = files.filter(file => file.isDirectory())
   .flatMap(file => getHtmlIndexes(`${dirName}/${file.name}`))
 // Get all the indexes found in the subdirs
 let indexes = await (await Promise.all(indexesPromises)).flat();
 // Get all local index.html
 let localIndexes = files
   .filter(file => file.name.includes(baseRegex))
   .filter(file => file.name.includes(extensionAccepted)) // todo: probably it is better to use a regex here
   .map(file => `${dirName}/${file.name}`)
 return await localIndexes.concat(indexes)
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
 const updates = Array.from(mermaidContent)
   // transfrom only the class that are not already transformed
   .filter(element => element.attributes["data-processed"] === undefined)
   .map(async element => {
     let svgContent = await getSvg(element) // convert the mermaid code to svg code
     element.innerHTML = svgContent // put the svg code inside the mermaid div
     element.setAttribute("data-processed", "true") // mark as already processed (mermaid.js will not process again)
     element.setAttribute("pre-rendered", "true") // mark the div as pre-rendered
   })
 await Promise.all(updates) // waiting all the transformation
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
