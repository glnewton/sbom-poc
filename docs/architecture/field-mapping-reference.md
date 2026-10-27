# Native-to-canonical field mappings

Generated from the catalog used in the POC's **Field mappings** view. The current implementation uses two configured ServiceNow ownership/tag profiles. Read [adapter profiles](adapter-profiles.md) for the exact contract, precedence and failure behavior.

| Provider | Native field | Canonical destination | Transformation | Rule | Field ownership |
| --- | --- | --- | --- | --- | --- |
| ServiceNow | cmdb_ci_business_app.sys_id | application.id | Prefix ServiceNow instance; retain native sys_id | MAP-02 | native |
| ServiceNow | cmdb_ci_business_app.number/name | application.label | Display only; never a cross-system key | MAP-02 | native |
| ServiceNow | cmdb_ci_business_app.application_manager | application.owner | Retain reference value and display value separately | MAP-02 | native |
| ServiceNow | cmdb_ci_service_auto.sys_id/sys_class_name | application_service.id/class | Instance scope; configurable application-service subclass | MAP-01 | native |
| ServiceNow | cmdb_rel_ci.sys_id | relationship assertion native ID | Retain instance and relation record identity | MAP-02 | native |
| ServiceNow | cmdb_rel_ci.parent/child/type | application → application_service | Resolve value of references; configured type ID and direction | MAP-02 | native + configured semantics |
| ServiceNow | cmdb_rel_type.sys_id/name | relationship type | Type ID is authority; display labels are informative | MAP-02 | native |
| ServiceNow | application_service.u_business_application | application ownership | Alternate profile reads configured reference field | MAP-02 | custom demo field |
| ServiceNow | application_service.u_deployable_service_id | service.id | Lookup integration registry; reject absent or ambiguous values | MAP-03 | custom demo field |
| ServiceNow | application_service.u_environment | environment.name | Apply selected profile aliases; compare AWS claim | MAP-04 | custom demo field |
| Registry | sourceBindings.service_id/project_id/gitlab_instance | service ↔ project | Approved binding, scoped project ID and validity interval | MAP-03 | integration-owned |
| Registry | sourceBindings.path/build_target/role | source_binding build scope | Retain monorepo path and primary/auxiliary purpose | MAP-03 | integration-owned |
| Registry | ownershipDecisions.primary_application_id | operating application | Must be one of the CMDB-related applications; preserve other consumers | MAP-02 | integration-owned |
| GitLab | Project.id/path_with_namespace | project.id/label | Numeric ID scoped to GitLab instance; path is mutable display | MAP-03 | native |
| GitLab | Pipeline.id/project_id/sha | pipeline.id → commit | Attach project context; retain complete SHA | BUILD-01 | native |
| GitLab | Job.id/pipeline.id/commit.id | job.id → pipeline/commit | Validate all identities against manifest; retain retry job ID | BUILD-01 | native |
| GitLab | Environment.id/name/tier | gitlab_environment → environment | Project-scoped ID; configured aliases; tier descriptive | DEPLOY-01 | native |
| GitLab | Deployment.id/status/sha/environment.id | deployment target | Retain project, status, environment and target commit | DEPLOY-01 | native |
| GitLab | Repository tree path/type/mode/id | source_file discovery | Filter allowed blobs; skip symlinks/submodules; immutable ref on every page | REPO-01 | native |
| GitLab | Repository file commit_id/last_commit_id | source revision/file history | Requested revision differs from file last-change revision | REPO-01 | native |
| GitLab | Repository file content/encoding/content_sha256 | source_file evidence | Bounded base64 decode, preserve hash and locator; never execute | REPO-01 | native |
| GitLab | Job Artifacts exact job ID + artifact path | sbom captured body | Download by numeric job ID; never latest successful branch shortcut | SBOM-01 | native |
| Build manifest | project_id/pipeline_id/commit_sha/sbom_job_id/sbom_path | build ↔ SBOM | Cross-check job/pipeline metadata before trusting bridge | BUILD-01 | integration-owned |
| Build manifest | subject.type/subject.digest | artifact.id | Typed immutable identity; duplicate project/digest bindings are ambiguous | BUILD-02 | integration-owned |
| AWS | STS Account/Arn | account.id / collector provenance | Use selected account/partition; credentials stay server-side | AWS-01 | native |
| AWS | ECS Task.taskArn/clusterArn | workload.id / cluster.id | ARN scope plus container name; only running task/container inventory | AWS-02 | native |
| AWS | ECS Task.group | ecs_service relationship | service: prefix + exact cluster-scoped service name | AWS-02 | native |
| AWS | ECS Task.taskDefinitionArn | task_definition.id | Retain exact revision; do not replace with latest revision | AWS-02 | native |
| AWS | ECS Container.name/image/imageDigest | workload artifact observation | Container name qualifies workload; image is display, digest is identity | BUILD-02 | native |
| AWS | ECS Service.taskDefinition | desired task definition | Desired state remains distinct from observed task revision | AWS-02 | native |
| AWS | AWS tags.ApplicationServiceId or CMDBService | workload → application_service | Selected profile controls tag; exact sys_id lookup | MAP-01 | customer tag convention |
| AWS | AWS tags.BusinessApplicationId/GitLabProjectId | independent mapping claims | Contradictions block resolved ownership/project rather than overriding CMDB | MAP-02 | customer tag convention |
| AWS | AWS tags.Environment | environment claim | Normalize aliases; disagreement with CMDB blocks mapping | MAP-04 | customer tag convention |
| AWS | ECR registryId/repositoryName/imageDigest | ecr_image → artifact | Registry location scoped by account/region; imageTags mutable | AWS-03 | native |
| AWS | Lambda Configuration.FunctionArn/Version | function / qualified workload | Keep unqualified function and immutable published version separately | AWS-04 | native |
| AWS | Lambda Configuration.CodeSha256 | artifact.digest | ZIP hash is base64 SHA-256, not an ECR image digest | BUILD-02 | native |
| AWS | Lambda Configuration.Runtime | runtime family observation | python3.11 does not disclose patch; never promote to 3.11.0 | AWS-04 | native |
| AWS | Lambda Alias.FunctionVersion/AdditionalVersionWeights | alias → versions | Include all weighted target versions; collect each qualified version | AWS-04 | native |
| AWS | EC2 InstanceId/State/Placement | workload host identity | Account/region from collector; only running instances in inventory | AWS-01 | native |
| AWS | SSM InstanceId/TypeName/CaptureTime/Entries | inventory → observations | Native ListInventoryEntries mapped into demo envelope; installed scope | AWS-05 | native → adapter envelope |
| SBOM | CycloneDX bom-ref / SPDX SPDXID | component.id | Scope to captured document; duplicate/unresolved IDs are data-quality issues | SBOM-02 | standard |
| SBOM | component name/version/purl | observation version | Explicit version preferred; versioned purl fallback; retain exact recorded string | SBOM-02 | standard |
| SBOM | dependencies / SPDX DEPENDS_ON | component dependency edges | Use same-document identities; do not invent missing nodes | SBOM-02 | standard |
| Repository | file path + line/JSON pointer + expression | observation source location | Preserve source revision and original declaration separately from comparison value | REPO-01 | derived |
| Repository | pin / lock entry / range / Docker FROM | observation precision/scope | Exact, family, constraint, hint, unresolved; no deployed-version promotion | REPO-01 | derived |

