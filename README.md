# Inline Mermaid Action :rocket:
Transform and Inline [Mermaid](https://mermaid-js.github.io/mermaid/#/) charts in SVG images in your static HTML pages using [Mermaid CLI](https://github.com/mermaid-js/mermaid-cli)!

## Getting Started
If you wanna inline your charts in a bunch of HTML pages, you just need to add this step in your GHA action configuration:

```yaml
name: Action Example

on:
  push:
    branches: [ "master" ]

jobs:
  build:

    runs-on: ubuntu-latest

    steps:
    - uses: actions/checkout@v3
    - name: Setup Node
      uses: actions/setup-node@v4.1.0
        with:
          # Set a version compatible with the Node version described in this package.json
          node-version: 20.18
    # ... Do whatever you want to generate you HTML pages
    - name: Inline!
      uses: cric96/inline-mermaid@v1.8.0
    # ... Do whatever you want with new HTML pages with the SVG inlined :)
```
With this configuration, the action will inline each mermaid code found in `build/*` in each `index.html` file found in `build/` (or in its subdirectories) using the configuration `config.toml` file selecting the mermaid configuration through `params.reveal_hugo.mermaid[0]` and using, as a CSS file, the first match of this regex: `css\\/.*\\\.css$`. 

Repository examples:
- [Inline HTML pages and deploy them in GHA pages](https://github.com/cric96/example-inline-mermaid)
- [Building your site with Hugo and Inline the mermaid charts](https://github.com/cric96/Template-Hugo-Reveal-Slides)
## Configuration

| Key | Value Information | Default |
| --- | --- | --- |
|`file-regex` | the regex used to match the file in which the bot will find mermaid graph and will inline it | `index\\.html?$` |
|`root-folder` | the folder in which the bot will start the search for files that match the `file-regex` selected | `build` |
|`config-file` | the file path in which the the mermaid configuration is stored. Currently it accepts only `toml` file. | `config.toml` |
|`css-file-regex` | the regex used to find the css file style associated with the mermaid graph | `css\\/.*\\\.css$` |
|`config-path-regex` | the [json-path](https://jsonpath-plus.github.io/JSONPath/docs/ts/) regex in which the mermaid configuration is stored | `$.params.reveal_hugo.mermaid[0]` |

