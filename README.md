# reference-archive

Extract reference URLs and DOIs from an 
[IEEE-style](https://ieeeauthorcenter.ieee.org/wp-content/uploads/IEEE-Reference-Guide.pdf)
reference list and download the references to the filesystem.

## Features

- downloads webpages as a single file in [MHTML](https://www.rfc-editor.org/rfc/rfc2557) format
  - including client-rendered content
  - uses [puppeteer-extra-plugin-stealth](https://github.com/berstend/puppeteer-extra/tree/master/packages/puppeteer-extra-plugin-stealth) to evade anti-bot measures
- downloads PDF files and other file types from URLs
- downloads papers with a DOI from [sci-hub](https://sci-hub.st)
  - if you make use of this feature, consider [donating to sci-hub](https://sci-hub.st/donate)

## Usage 

This software requires [node.js](https://nodejs.org), version 18 or newer.

Before you use, install the dependencies:

```shell
npm install  # or pnpm install, or yarn install, etc.
```

### Use from the command line

- Put your references in a plaintext file, e.g. `references.txt`
- Create a target directory, e.g. `./archive`
- Run: 
```shell
node index.js references.txt ./archive
```

### Use as a library

```javascript
import { extractAndSaveAllURLs } from "./lib.js";

await extractAndSaveAllURLs(
    '[1] First reference. [Online]. Available: https://jfhr.de/reference-archive/example.pdf (Accessed: 2023-07-23)\n' +
    '[2] Second reference. [Online]. Available: https://jfhr.de/reference-archive/example.html (Accessed: 2023-07-23)\n' +
    '[3] Third reference. [Online]. Available: https://jfhr.de/reference-archive/cr.html (Accessed: 2023-07-23)\n' +
    '[4] S. DeRisi, R. Kennison and N. Twyman, The What and Whys of DOIs. doi: 10.1371/journal.pbio.0000057\n' +
    '[5] N. Paskin, "Digital Object Identifier (DOI) System", Encyclopedia of Library and Information Sciences (3rd ed.)\n',
    './archive/'
);
```

## Example

Say you have the following reference list:

```text
[1] First reference. [Online]. Available: https://jfhr.de/reference-archive/example.pdf (Accessed: 2023-07-23)
[2] Second reference. [Online]. Available: https://jfhr.de/reference-archive/example.html (Accessed: 2023-07-23)
[3] Third reference. [Online]. Available: https://jfhr.de/reference-archive/cr.html (Accessed: 2023-07-23)
[4] S. DeRisi, R. Kennison and N. Twyman, The What and Whys of DOIs. doi: 10.1371/journal.pbio.0000057
[5] N. Paskin, "Digital Object Identifier (DOI) System", Encyclopedia of Library and Information Sciences (3rd ed.)
```

`reference-archive` would download the following files to your filesystem:

```text
1.pdf    # PDF file from URL
2.mhtml  # Single file web page from URL
3.mhtml  # Single file web page from URL, including client-rendered content
4.pdf    # PDF file with DOI from sci-hub
         # no 5.* - reference 5 has no URL and no DOI
```

## Test

To run tests:
```shell
node --test
```
