# BOMscope — SBOM Explorer

[Open the live viewer](https://sbom-explorer.bushyswan4.chatgpt.site/)

Static, browser-local SBOM viewer. Serve `dist/` using any static HTTP server. No login, backend, analytics, third-party scripts, or persisted SBOM data.

Supports CycloneDX JSON and SPDX 2.x JSON. Views: summary, searchable component inventory, package/runtime version search, dependency graph and reverse impact, licenses, supplied vulnerabilities and VEX, structural quality, release comparison, raw document. Export Markdown reports, CSV inventories and changes, and original JSON.

Limits: 32 MB input; graph displays up to 120 nodes; component tables paginate at 50 rows. XML and SPDX 3 JSON-LD are unsupported. No external vulnerability lookup, schema conformance validation, or artifact completeness verification. Comparison covers component identities, version sets and same-version licenses. It does not compare dependency edges or findings. Duplicate references resolve to the first occurrence. Example vulnerability IDs are deliberately illustrative.

Version search supports exact or partial package names, common runtime aliases, numeric dotted releases, and recognized SemVer prereleases. It groups matching, other, and uncomparable versions separately, shows dependency paths, and exports all query results as CSV. Runtime matching uses component names; package ecosystem metadata alone is not evidence of a runtime version. Missing runtime records do not establish absence from the application. Component versions take priority over package URL versions. Java runtime checks map legacy 1.x notation for Java 1 through 8; Go runtime checks accept a go prefix. Unsupported distro revisions and ecosystem-specific version formats require manual comparison.

## Run locally

Clone this repository and serve the `dist/` directory with a static HTTP server. For example, with Python 3:

```sh
git clone https://github.com/glnewton/sbom-poc.git
cd sbom-poc
python3 -m http.server 8080 --directory dist
```

Open <http://localhost:8080>. Select **Open SBOM** or drag a CycloneDX or SPDX JSON file onto the viewer. The initial inventory is clearly labeled sample data. Choose **Version search** to check a runtime or package against a version threshold.

There is no dependency installation or build step. An HTTP server is needed for the JavaScript modules.

## Check the code

With Node.js 18 or later:

```sh
npm test
npm run check
```

The tests cover SBOM normalization, dependency traversal, cycles, unresolved references, release comparisons, runtime aliases, version comparisons, and missing or unsupported versions.

## Project files

- `dist/index.html`, `dist/style.css`, and `dist/app.mjs`: the interface and browser interactions.
- `dist/engine.mjs`: SBOM normalization and dependency analysis.
- `dist/version-search.mjs`: runtime/package matching and version comparison.
- `checks.mjs` and `version-checks.mjs`: analysis tests.
- `.openai/hosting.json`: configuration for the existing hosted Site. Other static hosts can serve `dist/` directly.

