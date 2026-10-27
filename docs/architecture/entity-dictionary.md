# Canonical entity dictionary

Generated from `dist/mapping/catalog.mjs`. IDs use the entity type plus URL-encoded native identity parts. Source instance, account, region, project and document scope are retained where required.

| Entity | Meaning | Unique native identity | Native source | Scope |
| --- | --- | --- | --- | --- |
| application | Business application | ServiceNow instance + sys_id | cmdb_ci_business_app | Business ownership and lifecycle; never a version authority. |
| application_service | Application service | ServiceNow instance + sys_id | cmdb_ci_service_auto or configured subclass | Environment-specific operational service CI; mapping profile chooses its class/fields. |
| service | Deployable service | Registry namespace + service ID | Integration-owned registry | Stable build/deploy boundary across repositories and environments. |
| source_binding | Service/source binding | Registry namespace + binding ID | Integration-owned registry | Project, source path, build target, role and validity; supports many-to-many repositories/services. |
| project | Source project | GitLab instance + numeric project ID | GET /projects/:id | Repository location; names/default branch are descriptive. |
| commit | Source commit | GitLab instance + project ID + full SHA | Pipeline/job SHA; Commits API | Immutable source revision, not a reproducible artifact identity. |
| source_file | Source file | Project + commit + path | Repository Files API | Content at a revision, separate from its last-change revision. |
| pipeline | Build pipeline | GitLab instance + project ID + pipeline ID | Pipelines API | An execution at a commit; one commit can have many executions. |
| job | Build/SBOM job | GitLab instance + project ID + job ID | Jobs API | Job identity and its owning pipeline; artifacts may expire. |
| artifact | Immutable artifact | Subject type + digest | Integration-owned build manifest | Container manifest digest or Lambda ZIP code hash; never compare across subject types. |
| sbom | SBOM document | GitLab instance + project + job + artifact path | Job Artifacts API | A captured document bound to one build subject by the manifest. |
| component | Component identity | Document + component reference | CycloneDX / SPDX | Document-local identity prevents accidental cross-document merging. |
| observation | Version observation | Evidence source + subject + locator | SBOM / repository / AWS / SSM | Version, precision, scope and provenance; absence is not a version. |
| environment | Environment | Organization namespace + canonical name | Configured environment aliases | dev/UAT/prod are business conventions, not AWS-native environments. |
| gitlab_environment | GitLab environment | GitLab instance + project + environment ID | Environments API | Project-scoped intended deployment context. |
| deployment | GitLab deployment | GitLab instance + project + deployment ID | Deployments API | Intended rollout target and status, distinct from observed workload. |
| account | AWS account | Partition + account ID | STS GetCallerIdentity | Capture authority; an account can host several environments. |
| region | AWS region | Partition + region name | Collector region context | Same resource names may exist in multiple regions/accounts. |
| cluster | ECS cluster | Cluster ARN | DescribeClusters | Placement boundary, not an application identity. |
| ecs_service | ECS service | Service ARN | DescribeServices | Desired tasks/deployment controller state. |
| task_definition | ECS task definition revision | Task definition ARN with revision | DescribeTaskDefinition | Desired container configuration; tags do not pin actual bytes. |
| ecr_image | ECR image occurrence | Account + region + repository + imageDigest | ECR DescribeImages | A registry location for immutable image identity; tags are mutable aliases. |
| lambda_function | Lambda function | Unqualified function ARN | ListFunctions / GetFunction | Logical function; qualify a version for deployed code identity. |
| lambda_alias | Lambda alias | Alias ARN | ListAliases / GetAlias | Routing intent; weights can reference multiple versions. |
| workload | Observed workload | Scoped ARN + container, or account/region/instance | DescribeTasks / GetFunction / DescribeInstances | Running task container, qualified Lambda version, or EC2 host at capture time. |
| inventory | Host inventory snapshot | Account + region + instance + CaptureTime + TypeName | SSM ListInventoryEntries | Installed software, not application process usage. |

Every entity also has `label`, `attributes`, and `provenance[]`. Labels are display-only. Provenance includes source bundle, JSON pointer, captured time and simulated indicator. A capture is an observation at a time, not a timeless assertion.

