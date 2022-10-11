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
    # ... Do whatever you want to generate you HTML pages
    - name: Inline!
      uses: cric96/inline-mermaid@v1.8.0
    # ... Do whatever you want with new HTML pages with the SVG inlined :)
```
With this configuration, the action will inline each mermaid code found in `build/*` in each `index.html` file found in `build/` (or in its subdirectories) using the configuration `config.toml` file selecting the mermaid configuration through `params.reveal_hugo.mermaid[0]` and used as a CSS file the first match of this regex `css\\/.*\\\.css$`. 

Repository examples:
- [Inline HTML pages and deploy them in GHA pages](https://github.com/cric96/example-inline-mermaid)
- [Building your site with Hugo and Inline the mermaid charts](https://github.com/cric96/Template-Hugo-Reveal-Slides)
## Configuration

| Key | Value Information | Default |
| --- | --- | --- |
|`file-regex` | ... | ... |
|`root-folder` | ... | ... |
|`config-file` | ... | ... |
|`css-file-regex` | ... | ... |
|`config-path-regex` | ... | ... |

