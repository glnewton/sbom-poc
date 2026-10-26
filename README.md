# BOMscope — SBOM Explorer

[Open the live viewer](https://sbom-explorer.bushyswan4.chatgpt.site/)

Browser-local application deployment explorer and SBOM viewer. The landing page uses simulated ServiceNow business applications, GitLab builds, and AWS assets to explore exact runtime and library versions across dev, UAT, and prod. Serve `dist/` using any static HTTP server. No login, backend, analytics, third-party scripts, or persisted SBOM data.

Supports CycloneDX JSON and SPDX 2.x JSON. Views: summary, searchable component inventory, package/runtime version search, dependency graph and reverse impact, licenses, supplied vulnerabilities and VEX, structural quality, release comparison, raw document. Export Markdown reports, CSV inventories and changes, and original JSON.

Limits: 32 MB input; graph displays up to 120 nodes; component tables paginate at 50 rows. XML and SPDX 3 JSON-LD are unsupported. No external vulnerability lookup, schema conformance validation, or artifact completeness verification. Comparison covers component identities, version sets and same-version licenses. It does not compare dependency edges or findings. Duplicate references resolve to the first occurrence. Example vulnerability IDs are deliberately illustrative.

Version search supports exact or partial package names, common runtime aliases, numeric dotted releases, and recognized SemVer prereleases. It groups matching, other, and uncomparable versions separately, shows dependency paths, and exports all query results as CSV. Runtime matching uses component names; package ecosystem metadata alone is not evidence of a runtime version. Missing runtime records do not establish absence from the application. Component versions take priority over package URL versions. Java runtime checks map legacy 1.x notation for Java 1 through 8; Go runtime checks accept a go prefix. Unsupported distro revisions and ecosystem-specific version formats require manual comparison.

## Simulated application portfolio

- **Applications:** four business applications, nine GitLab projects, and 31 running AWS workloads.
- **Deployed versions:** filter by application, environment, service, runtime/library, and version condition. Inspect the underlying asset, build, and SBOM evidence or export it to CSV.
- **Environment matrix:** compare versions across dev, UAT, and prod, including coexisting versions during a rollout.
- **Data sources:** inspect and download the fictional API snapshots, build manifests, and SBOMs.

Try **Atlas Customer Platform → prod → customer-api → Python < 3.11**. The simulated running tasks record 3.10.14 and 3.10.15; UAT uses 3.11.10.

All records are synthetic. Missing artifact evidence, partial Lambda runtime versions, and EC2 installed-software observations are explicitly labeled. See [the data model and correlation rules](docs/simulated-data-model.md) for source schemas, limitations, and instructions to extend the simulation. Regenerate the fixture with `npm run demo:generate`.

## Connect the real systems using official APIs

Start with [the official API integration guide](docs/official-api-integration-guide.md). It provides authentication and read permissions, ServiceNow application/relationship requests, GitLab build and exact-job SBOM downloads, AWS ECS/Lambda/EC2/SSM commands, and a field-by-field join from a deployed asset to its component versions. It explains the build-manifest bridge and the organization-specific mappings that the vendors do not supply automatically.

The site remains a synthetic proof of concept. The guide is an implementation walkthrough; live credentials, collectors, and a real-data loading mode have not been added.

## Data mapping and integration concepts

The stable connection is **business application → deployable service → source/build → immutable artifact → observed workload/environment → SBOM component version**. Real organizations can express each relationship through different CMDB classes, custom fields, association tables, tags, repository layouts, and environment names.

Use native ServiceNow, GitLab, and AWS API evidence where available, with organization-specific adapters translating it into these shared concepts. A mapping must preserve identity scope, provenance, time, and unresolved or conflicting evidence; matching a display name alone does not establish an exact deployed version.

- [Data mapping concepts](docs/data-mapping-concepts.md): conceptual diagram, entities, cardinalities, scoped identities, environment meaning, and what version evidence can establish.
- [Data mapping adapter design](docs/data-mapping-adapters.md): native fields versus local conventions, proposed adapter contract, illustrative mapping profile, collection concerns, and onboarding/validation guidance.
- [Current simulation model](docs/simulated-data-model.md): the exact hard-coded conventions and scenarios implemented today.

The documentation distinguishes current behavior from proposed integration capabilities. Configurable mapping profiles, live API collectors, and a persistent canonical model are design guidance, not implemented features of this proof of concept.

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

The tests cover application/build/asset correlation, environment isolation, mixed rollouts, missing or ambiguous evidence, Lambda runtime precision, EC2 inventory scope, SBOM normalization, dependency traversal, cycles, unresolved references, release comparisons, runtime aliases, version comparisons, and missing or unsupported versions.

## Project files

- `dist/index.html`, `dist/style.css`, and `dist/app.mjs`: the interface and browser interactions.
- `dist/engine.mjs`: SBOM normalization and dependency analysis.
- `dist/version-search.mjs`: runtime/package matching and version comparison.
- `dist/enterprise/`: editable application-portfolio UI, adapters, and correlation logic.
- `scripts/generate-demo.mjs`: deterministic simulated source-data generator.
- `dist/data/simulated-enterprise.json`: generated simulation fixture.
- `checks.mjs`, `version-checks.mjs`, and `enterprise-checks.mjs`: analysis tests.
- `.openai/hosting.json`: configuration for the existing hosted Site. Other static hosts can serve `dist/` directly.

