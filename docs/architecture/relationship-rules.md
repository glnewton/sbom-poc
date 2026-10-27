# Relationship rules and cardinalities

Generated from the POC catalog. The implementation is in `dist/mapping/resolve.mjs`, `dist/mapping/model.mjs` and `dist/enterprise/model.js`. All accepted graph edges carry a rule ID; source-backed edges retain evidence references. Cross-source ownership conflicts block portfolio attribution.

| Rule | Purpose | Policy |
| --- | --- | --- |
| MAP-01 | Workload → application service | AWS configured tag = ServiceNow scoped sys_id. Missing, duplicate or unknown IDs remain unresolved. No display-name fallback. |
| MAP-02 | Application ownership | Configured CMDB relationship type + direction, or configured reference field. Multiple consumers need a documented primary-ownership decision; preserve all consumer links. |
| MAP-03 | Service → repository/build target | One active primary registry binding for this service/target, with GitLab instance, project, path and validity. Auxiliary sources remain separate. |
| MAP-04 | Environment agreement | Normalize explicit aliases and compare independent CMDB/AWS claims. A conflict blocks mapping; do not infer PROD from an account or branch name. |
| BUILD-01 | Build provenance consistency | Project, pipeline ID/SHA, job pipeline ID and job commit must agree. Repeated builds of one commit remain separate. |
| BUILD-02 | Observed artifact → build | Match typed digest with project scope to exactly one manifest, then validate build provenance. Tags/latest pipelines never resolve a missing digest. |
| SBOM-01 | Artifact → exact SBOM | Use manifest project/job/path. Missing or duplicate captures remain gaps. An SBOM from another build cannot substitute. |
| SBOM-02 | Components and dependencies | Document-local references, versions and dependency edges. Preserve unresolved references and missing versions. |
| DEPLOY-01 | Intent versus observation | GitLab environment/deployment indicates target SHA. The running AWS artifact wins for observed inventory; keep rollout discrepancies visible. |
| AWS-01 | AWS identity scope | Partition/account/region + resource identity, qualified container/version where required. EC2 account comes from capture context. |
| AWS-02 | ECS placement/configuration | Cluster, service and task-definition revision explain placement and desired state; the running container digest supplies artifact identity. |
| AWS-03 | Registry identity | Store registry location and tags separately from digest. OCI multi-platform index/child-manifest mappings require additional evidence; do not equate differing digests. |
| AWS-04 | Lambda qualification | CodeSha256 binds a ZIP artifact. Qualified version and alias routing remain separate. Runtime configuration supplies a family, not an exact runtime patch. |
| AWS-05 | EC2/SSM scope | Installed package observations scoped to host and CaptureTime. No inference of app process usage from application tags. |
| REPO-01 | Repository fallback | Fetch files at exact build commit. Local files remain unverified; source pins/constraints do not overwrite artifact inventory. |
| VERSION-01 | Answer semantics | Return matches, other versions and Unknowns with source precision, scope, identity linkage and coverage. No evidence does not establish absence. |

## Relationship inventory

| Relationship | From | To | Cardinality | Join predicate | Rule |
| --- | --- | --- | --- | --- | --- |
| application_uses_service | application | application_service | many-to-many | Configured cmdb_rel_ci type/direction or reference field | MAP-02 |
| service_instance | application_service | service | many-to-one | Configured deployable-service key | MAP-03 |
| service_environment | application_service | environment | many-to-one | Configured environment field and aliases | MAP-04 |
| service_source | service | source_binding | one-to-many | Approved source registry membership | MAP-03 |
| binding_project | source_binding | project | many-to-one | Scoped GitLab instance/project ID | MAP-03 |
| project_commit | project | commit | one-to-many | Exact project and full commit SHA | BUILD-01 |
| commit_file | commit | source_file | one-to-many | Repository file at the requested commit | REPO-01 |
| file_observation | source_file | observation | one-to-many | Parser path and line/JSON pointer | REPO-01 |
| commit_pipeline | commit | pipeline | one-to-many | Pipeline.sha equals commit SHA | BUILD-01 |
| pipeline_job | pipeline | job | one-to-many | Job.pipeline.id and project context agree | BUILD-01 |
| job_artifact | job | artifact | many-to-many | Manifest binds build/job to typed subject | BUILD-02 |
| job_sbom | job | sbom | one-to-many | Exact job artifact path and captured body | SBOM-01 |
| artifact_sbom | artifact | sbom | many-to-many | Validated manifest; no latest-job lookup | SBOM-01 |
| sbom_component | sbom | component | one-to-many | Document-local component reference | SBOM-02 |
| component_observation | component | observation | one-to-many | Recorded version/purl, precision and scope | SBOM-02 |
| component_dependency | component | component | many-to-many | Document dependency reference; missing refs retained as issues | SBOM-02 |
| project_environment | project | gitlab_environment | one-to-many | Project-scoped environment ID | DEPLOY-01 |
| environment_alias | gitlab_environment | environment | many-to-one | Configured alias, not a name equality join | MAP-04 |
| environment_deployment | gitlab_environment | deployment | one-to-many | Deployment.environment.id | DEPLOY-01 |
| deployment_commit | deployment | commit | many-to-one | Deployment.sha; intent only | DEPLOY-01 |
| account_workload | account | workload | one-to-many | ARN or explicit collector account context | AWS-01 |
| region_workload | region | workload | one-to-many | ARN or explicit collector region context | AWS-01 |
| cluster_service | cluster | ecs_service | one-to-many | DescribeServices.clusterArn | AWS-02 |
| ecs_desired_definition | ecs_service | task_definition | many-to-one | Service.taskDefinition at capture time; desired state | AWS-02 |
| cluster_workload | cluster | workload | one-to-many | Task.clusterArn | AWS-02 |
| ecs_service_workload | ecs_service | workload | one-to-many | Task.group service name + cluster scoped service identity | AWS-02 |
| workload_definition | workload | task_definition | many-to-one | Task.taskDefinitionArn, including revision | AWS-02 |
| registry_artifact | ecr_image | artifact | many-to-one | Typed image manifest digest; location retained separately | AWS-03 |
| function_version | lambda_function | workload | one-to-many | Qualified function ARN and Configuration.Version | AWS-04 |
| function_alias | lambda_function | lambda_alias | one-to-many | Alias belongs to unqualified function ARN | AWS-04 |
| alias_version | lambda_alias | workload | many-to-many | Primary FunctionVersion and AdditionalVersionWeights; routing intent | AWS-04 |
| workload_service | workload | application_service | many-to-one | Unique configured AWS application-service tag and validated ownership | MAP-01 |
| workload_environment | workload | environment | many-to-one | Resolved CMDB/AWS environment agreement | MAP-04 |
| workload_artifact | workload | artifact | many-to-one | Observed imageDigest or CodeSha256; never image tag | BUILD-02 |
| workload_inventory | workload | inventory | one-to-many | Account/region/instance and collection time | AWS-05 |
| inventory_observation | inventory | observation | one-to-many | Installed package Name/Version | AWS-05 |
| workload_observation | workload | observation | one-to-many | Lambda runtime family or artifact/host observation | VERSION-01 |

Cardinality is conceptual, not proof that the capture is complete. One-to-many permits zero captured children; many-to-one requires one resolved parent when a claim is accepted. The adapter rejects missing/ambiguous primary bindings. Graph validation exposes missing endpoints; SQL foreign keys reject persisting them as accepted relationships.

