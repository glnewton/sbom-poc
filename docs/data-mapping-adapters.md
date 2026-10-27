# Data mapping adapter design

Current implementation reference: [comprehensive architecture, ERDs, native field mappings and executable profiles](architecture/README.md). The Mapping workbench now applies the configured ownership/tag profiles to the portfolio and exports a canonical graph. Earlier design examples below remain illustrative where they exceed that implemented contract.

For concrete authentication, endpoints, requests, and cross-system joins, see [Connecting through official APIs](official-api-integration-guide.md).

This is technical design guidance for moving from the simulation to organization-specific integrations. The executable ownership/tag profiles, canonical graph and SQLite exporter are documented in [the current architecture](architecture/README.md). The broader generic adapter contract and YAML example below are design guidance; they are not an implemented arbitrary-expression configuration engine. Live API collectors remain integration work. The current resolver is [`dist/mapping/resolve.mjs`](../dist/mapping/resolve.mjs), followed by artifact correlation in [`dist/enterprise/model.js`](../dist/enterprise/model.js).

Read [Data mapping concepts](data-mapping-concepts.md) for entity meanings, cardinalities, evidence limits, and identity rules.

## Integration boundary

```mermaid
flowchart LR
  API[Native APIs] --> C[Source collectors]
  C --> R[Versioned source captures]
  R --> A[Adapters with mapping profiles]
  A --> N[Canonical entities and assertions]
  N --> J[Relationship resolver]
  J --> Q[Version query and coverage results]
  Q --> UI[Views and exports]
```

Collectors should preserve native API meaning. Adapters handle schema variations. The resolver determines whether the evidence supports a relationship. Queries operate on normalized observations and retain unresolved evidence. The UI should not need to know a customer's CMDB field names or tag conventions.

A live collector would run in an appropriately authenticated service or trusted collection process. The present public browser-only site is not an implementation of that collector. Do not put enterprise API credentials in the static bundle. A versioned, sanitized capture can remain the boundary for offline demos and tests.

## Native fields and local choices

| Concept | Native/API evidence to use where available | Organization-specific mapping choices |
| --- | --- | --- |
| Application | ServiceNow Table API records, scoped CI references | CMDB class, ownership fields, lifecycle values, external application key |
| Application to service | CMDB relationship records or an approved service catalog | Relationship type, direction, traversal depth, allowed classes and shared-service behavior |
| Service to project | GitLab project identity plus explicit catalog/build metadata | Custom CI field, association table, catalog entry, monorepo path or build target |
| Build | GitLab pipeline and job records with project and commit context | Which job produces the deployable artifact and which job publishes its SBOM |
| Intended deployment | GitLab environment and deployment records | Environment naming and relation to accounts, clusters, or application service instances |
| ECS observed artifact | `DescribeTasks` container `imageDigest` | Container selection, resource tags, build-manifest location, multi-platform subject resolution |
| Lambda observed code | Qualified function configuration, ZIP `CodeSha256`, or container-image subject appropriate to package type | Alias/version routing and code artifact binding; layers require their own inventory linkage |
| EC2 observed software | EC2 identity and SSM `AWS:Application` inventory | Application association, inventory scope, package identity and version semantics |
| SBOM | GitLab job artifact response containing CycloneDX/SPDX | Artifact path, scanner coverage, subject binding, retention, duplicate-document policy |

The existing `u_gitlab_project_ids` field, AWS tags, and `buildManifests` are demo conventions. Real deployments can satisfy the same conceptual edges through different fields and relationship sources. Do not invent native API fields to fit the demo envelope.

## Proposed adapter output contract

The following contract is conceptual and is not the schema consumed by today's `buildPortfolio` function.

| Output | Required meaning |
| --- | --- |
| Entity | Canonical type/key, source identity, original label, normalized attributes, and source capture reference |
| Relationship assertion | Typed endpoints, relation name, source evidence, mapping rule/version, resolution state, and applicable scope/time |
| Component observation | Component identity, original version, comparable version if supported, version precision, subject, evidence scope, observed time, collection time |
| Collection coverage | Source scope, endpoints requested, completed pages, failures/denials, capture interval, and whether the capture is complete |
| Resolution issue | Machine-readable reason, affected records/edges, candidate identities, and review or remediation context |

Preserve raw values alongside normalized ones. Missing fields are null/unknown, not empty strings interpreted as valid identity. Store source references or appropriate retained evidence rather than exposing unrestricted raw enterprise payloads to every viewer.

Suggested resolution states are `resolved`, `unresolved`, `ambiguous`, and `conflicting`. Freshness (`current`, `stale`, or unknown) is independent. Suggested version precision is `exact`, `family`, `range`, `missing`, or `unsupported`. Suggested evidence scope includes `artifact-inventory`, `host-installed`, `managed-runtime-config`, and a future `process-observation` if actually collected.

## Illustrative mapping profile

This YAML is a design example only. No YAML parser, profile loader, or rule interpreter is implemented in this repository.

```yaml
profile_id: example-enterprise
profile_version: 1
source_instances:
  servicenow: snow-primary
  gitlab: gitlab-primary
application:
  table: cmdb_ci_business_app
  native_key: sys_id
  external_key: u_application_code       # illustrative custom field
  display_name: name
  service_relation:
    source: cmdb_rel_ci
    type_id: "<organization-approved-relationship-type-id>"
    direction: parent_to_child
    target_classes: [cmdb_ci_service_auto]
project_association:
  source: approved_service_project_registry
  keys: [service_identity, gitlab_instance, project_id, repository_path]
aws_association:
  application_tag: AppCode
  application_tag_matches: application.external_key
  environment_tag: Stage
  project_tag: GitLabProjectId
  missing_identifier: unresolved
  multiple_candidates: ambiguous
  disagreeing_authoritative_sources: conflicting
environments:
  scope: example-enterprise
  aliases:
    development: dev
    acceptance: uat
    production: prod
  unknown_value: preserve_unmapped
artifact_binding:
  require_immutable_subject: true
  manifest_source: gitlab_job_artifact
  sbom_path: reports/sbom.cdx.json
```

Do not blindly copy the relationship direction or class names: verify them against the target CMDB configuration. Resolve actual relationship type IDs instead of depending on display text. The approved registry is an example integration-owned association source, not a GitLab or ServiceNow standard endpoint.

## Deterministic mapping procedure

1. Identify the connector instance and source scope before interpreting record IDs.
2. Extract configured identities; preserve raw values and API capture references.
3. Normalize only known representations: reference-object vs scalar IDs, documented tag casing, digest encoding, and approved environment aliases.
4. Resolve explicit associations using scoped identifiers and declared cardinalities. Zero candidates produce `unresolved`; multiple incompatible candidates produce `ambiguous`.
5. Apply documented field-specific authority rules. For example, a CMDB may own business ownership while AWS owns observed workload state. Keep disagreements visible; do not let a generic fallback chain overwrite conflicting valid values.
6. Match immutable artifact subjects and validate the build/SBOM binding. Keep the original AWS observation and GitLab target as separate facts.
7. Normalize component identity/version without inventing precision. Preserve ecosystem-specific version formats when the comparator cannot interpret them.
8. Attach coverage, timestamps, profile version, and issues to query results and exports.

Human-approved mappings should record who approved them, why, their source scope, validity interval, and revision. Heuristic name similarity may suggest a candidate, but should not silently establish application ownership or a build-to-artifact association.

## Real API collection concerns

- Complete and track pagination; preserve API version, query filters, account/region/project scope, capture start/end, and failed pages. A partial or access-denied response is not evidence of an empty inventory.
- Honor documented throttling and retry guidance. Deduplicate retries with scoped identities while retaining observations from different times.
- For ServiceNow, handle configured display-value/reference formats and relationship direction explicitly. An API user may have access to a CI but not all referenced records.
- For GitLab, collect project-scoped identities and the exact build/job artifact, including retention/expiration failures. The most recent pipeline on a branch is not a substitute for an observed artifact binding.
- For AWS, collect the configured accounts and regions, resource tags where separate API calls are required, and the resource instance/version actually observed. `DescribeInstances` does not supply account identity in each instance object; keep it from collector context.
- For Lambda aliases and weighted routing, represent every routed published version. For image functions, use the image artifact identity rather than assuming ZIP code-hash semantics. Include layers as separate subjects when needed.
- Capture SSM inventory time independently from the EC2 enumeration time. Installed packages and running processes are distinct observations.
- Preserve deletion/stopped state and observation time so stale resources do not remain indefinitely in the current inventory. Reconcile eventual consistency rather than assuming a transaction across all three systems.

These behaviors require collector and adapter implementation; the fixture is not a complete conformance test for all API versions or configurations.

## Onboarding an organization

1. Obtain representative, appropriately sanitized responses from the approved APIs and document their versions and coverage.
2. Agree on the meanings of application, service, environment, deployed asset, and exact version with the relevant owners.
3. Create a mapping worksheet covering source fields, transformations, identity scope, relation direction, cardinality, authority, freshness, and failure behavior for each conceptual edge.
4. Define explicit environment aliases and shared-service/monorepo rules; keep unknown cases visible.
5. Version the mapping profile and build fixtures for both ordinary and failure cases before enabling collection.
6. Compare resolved relationships with known deployments. Review unexplained matches as well as unresolved records.
7. Retain the profile version with every capture and result. Run old/new mappings against the same fixture when changing schemas and review differences before adopting the new revision.

An acceptance fixture should include renamed fields, scalar and reference-object IDs, duplicate display names, identical numeric IDs on different source instances, missing tags, conflicting ownership, shared services, multiple artifacts per project, environment collisions, stopped assets, expired SBOM artifacts, missing pages, mixed rollouts, stale captures, Lambda runtime families, and EC2 installed versions without process evidence.

## Current implementation versus proposed design

| Area | Implemented in the proof of concept | Additional integration work |
| --- | --- | --- |
| Collection | Bundled synthetic JSON snapshot | Authenticated native API collectors, pagination and coverage tracking |
| Source identities | Scoped canonical keys; one simulated ServiceNow/GitLab context; AWS account/region context | Live multi-instance collection and reconciliation |
| Mapping | Two executable CMDB relationship/reference and AWS-tag profiles; approved service/source registry | Arbitrary customer profile authoring and production approval workflow |
| Correlation | Project + typed observed digest; build/job consistency and captured SBOM path checks | Native artifact retrieval, subject attestations where available, platform/layer bindings |
| Evidence | Digest-linked SBOM, Lambda family, EC2 installed scope, explicit gaps | Configurable freshness and richer provenance/coverage dimensions |
| Relationships | Shared consumers, explicit primary operator, source/build targets and typed many-to-many graph assertions | More than one primary build target per deployable-service instance |
| Environments | Profile-controlled aliases and conflict checking; matrix columns dev/UAT/prod | Dynamic matrix columns and organization-wide environment catalog |
| Validation | Model/version checks, mutation-based mapping tests and SQLite constraint tests | Live integration verification and temporal reconciliation tests |

The Mapping workbench now drives the existing portfolio through the configured resolver. The architecture coverage matrix identifies the remaining platform, collection and historical-storage extensions.

## Related code and references

- [Current adapter and query logic](../dist/enterprise/model.js)
- [Simulation generator](../scripts/generate-demo.mjs)
- [Current enterprise checks](../enterprise-checks.mjs)
- [Source API references and fixture details](simulated-data-model.md#api-references-used-for-the-shapes)

## Repository evidence adapter extension

Add a source-files adapter after build correlation, using GitLab Repository Tree and Repository Files APIs at the full build commit. Its profile should specify source instance/project, service build targets and subdirectories, allowlisted files, inherited-config rules, supported parsers, byte/count limits, and missing/denied-file handling. Preserve native blob IDs/content hashes, requested revision, file-last-change revision, capture time, parser revision and collection completeness. Keep unsupported files visible.

Normalize findings into version observations with `precision`, `scope`, `path`, and `locator`; keep source pins separate from SBOM, host and process observations. The POC implements local parsing, simulated build-commit association and the ownership/tag profiles documented in the architecture reference. Live collection remains integration work. See [the repository collection and derivation guide](repository-version-evidence.md) for official requests and the exact implementation boundary.
