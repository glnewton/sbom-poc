# Simulated application deployment model

For concrete authentication, endpoints, requests, and cross-system joins, see [Connecting through official APIs](official-api-integration-guide.md).

This proof of concept uses only fictional data. There are no ServiceNow, GitLab, or AWS account connections. The browser fetches a bundled JSON fixture from the same static host. All joins and version queries run locally.

The fixture contains four business applications, nine GitLab projects, 31 running workloads across dev/UAT/prod, 29 build manifests, and 28 synthetic CycloneDX SBOMs. A stopped ECS task is included in the source snapshot and excluded from deployed inventory.

For the vendor-independent concepts and organization-specific variations, read [Data mapping concepts](data-mapping-concepts.md) and [Data mapping adapter design](data-mapping-adapters.md). The fields below describe the current fixture, not mandatory production schemas.

## Source responsibilities

| Source | API model | Evidence supplied |
| --- | --- | --- |
| ServiceNow | Table API, `cmdb_ci_business_app` | Business application identity, owner, criticality, and a custom GitLab project mapping |
| GitLab | Projects, Pipelines, Jobs, Environments, Deployments, Job Artifacts | Project and build identities, commit SHA, environment deployment target, and captured SBOM artifact |
| AWS ECS | `DescribeTasks` task and container records | Running container identity, observed `imageDigest`, resource tags |
| AWS Lambda | `GetFunction` configuration and tags | Published function identity, `CodeSha256`, managed runtime family |
| AWS EC2 / SSM | `DescribeInstances`, `GetInventory` with `AWS:Application` | Running host identity and installed software versions |

These are projections and aggregates of API-shaped responses, not complete vendor response schemas. GitLab project-scoped responses carry `project_id` context in the capture bundle. The fixture intentionally excludes credentials, signed artifact URLs, and actual customer records.

## Explicit correlation conventions

- ServiceNow `u_gitlab_project_ids` is a custom demo field containing associated project IDs. It is not an out-of-the-box vendor relationship.
- AWS tags `BusinessApplicationId`, `GitLabProjectId`, `Environment`, and `Service` are demo conventions.
- `buildManifests` are synthetic build-produced artifacts, not a native GitLab API response. Each binds project, pipeline, commit, SBOM job/path, and immutable artifact subject.
- `sbomArtifacts` contain the response bodies captured from the identified GitLab job artifact path.
- `development` maps to `dev`, `user-acceptance` maps to `uat`, and `production` maps to `prod`. The adapter includes further explicit aliases in `normalizeEnvironment`.

For ECS, the join uses `(project_id, container-image, imageDigest)`. For Lambda ZIP code, it uses `(project_id, lambda-code-sha256, CodeSha256)`. The code validates application/project ownership, pipeline commit, job commit and pipeline, and exact SBOM job/path. Missing or ambiguous evidence produces an Unknown observation. A latest pipeline, image tag, commit target, or environment name alone never supplies a deployed version.

## Meaning of a version result

**Digest-linked SBOM:** the observed AWS artifact identity matches the captured manifest and build SBOM. Its component version is recorded exactly, but this is inventory correlation, not a signed attestation or live process measurement.

**Managed runtime family:** Lambda may report `python3.11`, which does not establish an exact patch such as `3.11.10`. It remains Unknown for exact version searches, even when a library SBOM is linked by code hash. Libraries can still have exact recorded versions.

**Installed on EC2 host:** SSM records installed package versions. Application tags establish association with the host, not which binary the application executes. The UI and CSV retain this scope explicitly.

**Component not recorded:** inventory exists but has no matching name. This does not establish that the software is absent, because inventories can be incomplete.

## Scenarios to try

1. Atlas Customer Platform → prod → customer-api → Python below 3.11. Two running tasks record **3.10.14** and **3.10.15**. UAT records **3.11.10** and dev **3.12.7**.
2. Atlas → prod → customer-web → Node.js below 20. Two old runtime versions coexist during a simulated rollout.
3. Atlas → notification-handler → Python. The managed runtime family is visible but the exact patch remains Unknown. Searching the library `requests` returns exact code-library versions.
4. Meridian → `log4j-core` → any version. Compare libraries across services and environments.
5. Beacon → report-builder. Prod includes a missing SBOM and an unrecognized image digest; UAT includes NumPy without a recorded version.
6. Harbor → UAT. The portal image has a mutable tag but no observed digest, so no version is inferred.
7. Harbor → legacy-batch. Runtime and library versions come from SSM installed software, with application usage unverified.
8. Unassigned assets. A task without application/project tags is retained as a mapping gap.

## Regenerate and extend

```sh
npm run demo:generate
npm test
npm run check
```

Edit `scripts/generate-demo.mjs` to change application definitions, service/runtime/library versions, environments, and edge cases. Generation is deterministic with a fixed simulated snapshot timestamp. Generated hashes are synthetic identifiers, not hashes of real software binaries. The viewer uses `dist/data/simulated-enterprise.json`; the editable generator is committed alongside it.

The source adapters and joins are in `dist/enterprise/model.js`. The UI is in `dist/enterprise/ui.js` and `style.css`. No application compilation step is required.

## API references used for the shapes

- [ServiceNow Table API](https://developer.servicenow.com/print_page.do?category=null&identifier=c_TableAPI&module=api&release=zurich)
- [ServiceNow CSDM table mapping](https://www.servicenow.com/docs/r/servicenow-platform/common-service-data-model-csdm/csdm-to-cmdb-mapping.html)
- [GitLab Deployments API](https://docs.gitlab.com/api/deployments/)
- [GitLab Job Artifacts API](https://docs.gitlab.com/api/job_artifacts/)
- [AWS ECS Container](https://docs.aws.amazon.com/AmazonECS/latest/APIReference/API_Container.html)
- [AWS Lambda GetFunction](https://docs.aws.amazon.com/lambda/latest/api/API_GetFunction.html)
- [AWS Systems Manager inventory schema](https://docs.aws.amazon.com/systems-manager/latest/userguide/inventory-schema.html)

## Supplemental repository snapshots

`dist/data/simulated-repositories.json` contains four synthetic source snapshots. `scripts/generate-repository-demo.mjs` derives three snapshot identities from the existing validated build commits; a fourth has a deliberately unbound newer revision. Files are analyzed at runtime by `dist/repository/analyzer.mjs`, rather than storing precomputed findings. The source findings never modify the enterprise snapshot or its deployed-version results. See [repository version evidence](repository-version-evidence.md) for scenarios, file formats, and correlation rules.
