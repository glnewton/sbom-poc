# Connecting ServiceNow, GitLab, and AWS through official APIs

Current implementation reference: [comprehensive architecture, ERDs, native field mappings and executable profiles](architecture/README.md). The Mapping workbench now applies the configured ownership/tag profiles to the portfolio and exports a canonical graph. Earlier design examples below remain illustrative where they exceed that implemented contract.

This guide explains how to collect and connect real source records to answer: **Which runtime/library version is recorded for this business application's deployed workloads in dev, UAT, or prod?**

The commands are integration examples for an authorized collector. They have not been executed against customer accounts. The published proof of concept still uses synthetic data; it does not have live connectors or a mapping-profile interpreter. Follow the native APIs below, then adapt their responses using [the mapping concepts](data-mapping-concepts.md) and [adapter design](data-mapping-adapters.md).

## 1. Connection setup and permissions

Run collection in a trusted service, scheduled job, or local integration process. Use an approved secret store or workload identity. Publish only the intended normalized/sanitized inventory to the viewer; do not embed credentials in this public static site.

| System | Connection/authentication | Read access needed |
| --- | --- | --- |
| ServiceNow | Instance HTTPS origin; inbound OAuth integration and bearer token | Table and field ACL access for configured application/service classes, `cmdb_rel_ci`, and any mapping tables; referenced owner/type records if collected. Table web-service access and applicable REST API access policy must allow the collector. There is no universal role that grants every customer's custom CMDB schema. |
| GitLab | GitLab HTTPS origin plus `/api/v4`; approved personal/project/group access token, or OAuth | Start with `read_api` scope and a role that can read the selected projects, pipelines, deployments, jobs, and artifacts. Artifact access restrictions and licensing can impose further requirements. `read_repository` alone is not general REST inventory access; CI job tokens support only selected endpoints. |
| AWS | AWS SDK/CLI default credential chain, workload role or IAM Identity Center profile; SigV4 handled by SDK | Read operations in the table below, scoped where the operation supports it. Enumerate explicitly approved accounts and regions. Cross-account collection also needs the target role trust and permission to assume it. |

AWS operations used in this guide:

| Area | IAM actions |
| --- | --- |
| ECS discovery and observed containers | `ecs:ListClusters`, `ecs:ListTasks`, `ecs:DescribeTasks`; `ecs:ListTagsForResource` when separately fetching tags |
| Lambda discovery and routing | `lambda:ListFunctions`, `lambda:ListAliases`, `lambda:GetAlias`, `lambda:GetFunction`, `lambda:ListTags` |
| EC2 hosts and installed software | `ec2:DescribeInstances`, `ssm:ListInventoryEntries` |
| Optional cross-account collection | `sts:AssumeRole` on the approved role, with corresponding trust policy |

`sts:GetCallerIdentity` identifies the current account/principal and does not require an allow permission. Optional ECR manifest resolution, Lambda layer retrieval, other CMDB tables, or GitLab registry queries need additional permissions. Build IAM policy resources and conditions for the actual scope; this table is an operation inventory, not a ready-to-attach policy.

ServiceNow OAuth configuration differs by instance release and installed capabilities. Configure the supported inbound grant with the administrator. For a client-credentials integration that has been enabled, the token request is:

```bash
# SN_BASE is the approved instance origin, with no trailing slash.
# Credentials are supplied by the collector's secret-management mechanism.
curl --fail --silent --show-error \
  --request POST "$SN_BASE/oauth_token.do" \
  --data-urlencode 'grant_type=client_credentials' \
  --data-urlencode "client_id=$SN_CLIENT_ID" \
  --data-urlencode "client_secret=$SN_CLIENT_SECRET"
```

Keep the returned `access_token` in collector memory, respect its lifetime, and refresh/reacquire through the configured grant. Do not log the token response. If client credentials are unavailable, use the instance's approved supported OAuth flow; changing the grant parameter alone does not enable it.

Official references: [ServiceNow client credentials](https://www.servicenow.com/docs/r/platform-security/authentication/client-credentials.html), [configuration](https://www.servicenow.com/docs/r/platform-security/authentication/configure-an-oauth-client-credential-grant.html), [GitLab REST authentication](https://docs.gitlab.com/api/rest/authentication/), [AWS SDK credentials](https://boto3.amazonaws.com/v1/documentation/api/latest/guide/credentials.html).

## 2. ServiceNow: retrieve applications and their service relationships

Use the official **Table API**, selecting the actual classes and readable fields in the instance.

```bash
curl --fail --silent --show-error --get \
  "$SN_BASE/api/now/table/cmdb_ci_business_app" \
  --header "Authorization: Bearer $SN_ACCESS_TOKEN" \
  --header 'Accept: application/json' \
  --data-urlencode 'sysparm_fields=sys_id,sys_class_name,number,name,application_manager,business_criticality,sys_updated_on' \
  --data-urlencode 'sysparm_display_value=false' \
  --data-urlencode 'sysparm_exclude_reference_link=true' \
  --data-urlencode 'sysparm_query=ORDERBYsys_id' \
  --data-urlencode 'sysparm_limit=100' \
  --data-urlencode 'sysparm_offset=0'
```

Records are in `result`. Preserve native `sys_id` and connector-instance identity. Fetch further pages using the documented pagination links/offsets, tracking omissions or failures. Do not silently treat ACL-filtered or failed collection as a complete inventory.

Retrieve approved application-to-service relationships, where this instance models the application as the parent:

```bash
curl --fail --silent --show-error --get \
  "$SN_BASE/api/now/table/cmdb_rel_ci" \
  --header "Authorization: Bearer $SN_ACCESS_TOKEN" \
  --header 'Accept: application/json' \
  --data-urlencode "sysparm_query=parent=$SN_APPLICATION_SYS_ID^type=$SN_RELATION_TYPE_SYS_ID^ORDERBYsys_id" \
  --data-urlencode 'sysparm_fields=sys_id,parent,child,type,sys_updated_on' \
  --data-urlencode 'sysparm_display_value=false' \
  --data-urlencode 'sysparm_exclude_reference_link=true' \
  --data-urlencode 'sysparm_limit=100' \
  --data-urlencode 'sysparm_offset=0'
```

Resolve returned `child` identities through the configured CI class, for example `GET /api/now/table/cmdb_ci_service_auto/{sys_id}`. Confirm relationship type and direction with the CMDB owner; reverse the traversal when the model requires it. Retrieve additional relationship pages as needed.

**Application/service → GitLab project is a separate mapping.** Choose the organization's actual source: a service CI custom field, association table, service catalog, or approved mapping registry. Query that table/field through its supported API and produce `(ServiceNow instance, application/service sys_id) → (GitLab instance, project ID, optional build target/path)`. There is no universal ServiceNow field for a GitLab project. The demo's `u_gitlab_project_ids` is only one custom convention.

Reference fields can be scalar IDs or objects depending on request/display settings. Normalize the native value, preserving the original response. Owner display names are useful labels, not join keys.

Official references: [Table API and parameters](https://www.servicenow.com/docs/r/api-reference/rest-apis/c_TableAPI.html), [CSDM table mapping](https://www.servicenow.com/docs/r/servicenow-platform/common-service-data-model-csdm/csdm-to-cmdb-mapping.html).

## 3. GitLab: retrieve delivery records and the exact build artifacts

Set `GL_BASE` to the approved GitLab origin and `GL_PROJECT_ID` to the project obtained from the mapping. Numeric project IDs avoid URL-encoding issues with namespace paths. In a multi-instance estate, keep the GitLab instance ID with every numeric ID.

```bash
curl --fail --silent --show-error \
  --header "Authorization: Bearer $GL_TOKEN" \
  "$GL_BASE/api/v4/projects/$GL_PROJECT_ID"

curl --fail --silent --show-error \
  --header "Authorization: Bearer $GL_TOKEN" \
  "$GL_BASE/api/v4/projects/$GL_PROJECT_ID/environments?per_page=100&page=1"

curl --fail --silent --show-error \
  --header "Authorization: Bearer $GL_TOKEN" \
  "$GL_BASE/api/v4/projects/$GL_PROJECT_ID/deployments?status=success&per_page=100&page=1"
```

Traverse pagination using GitLab response links/headers. Persist the project context around project-scoped responses; do not assume every response includes it.

| API response | Fields used | Purpose |
| --- | --- | --- |
| Project | `id`, `path_with_namespace` | Scoped project identity and display name |
| Environment | `id`, `name`, `tier`, `state` | Source environment identity; map name to the organization's environment. `tier` is a category, not a unique environment. |
| Deployment | `id`, `sha`, `environment.id/name`, `deployable`, timestamps | Intended release and deployment job context; `deployable` can be null |
| Pipeline | `id`, `project_id`, `sha`, `ref`, `status` | Specific build execution and source commit |
| Job | `id`, `pipeline`, `commit.id`, `artifacts`, `artifacts_file` | Job identity and captured artifact availability |

When the deployment supplies a pipeline reference, retrieve it and its jobs:

```bash
curl --fail --silent --show-error \
  --header "Authorization: Bearer $GL_TOKEN" \
  "$GL_BASE/api/v4/projects/$GL_PROJECT_ID/pipelines/$GL_PIPELINE_ID"

curl --fail --silent --show-error \
  --header "Authorization: Bearer $GL_TOKEN" \
  "$GL_BASE/api/v4/projects/$GL_PROJECT_ID/pipelines/$GL_PIPELINE_ID/jobs?include_retried=true&per_page=100&page=1"
```

A deployment pipeline may promote an artifact built in a different pipeline/project. Follow the artifact provenance to that build; do not require the build and deployment job IDs to be identical. If deployment context is absent, resolve through an explicitly maintained artifact index or known build records. Do not select the newest successful pipeline as a substitute. A commit can have multiple builds/retries.

### The bridge GitLab does not supply automatically

A pipeline/job response does not inherently bind its SBOM to the digest AWS reports. Have the build publish a manifest alongside its SBOM, or use an existing equivalent provenance/attestation system. The manifest below is an **integration-owned artifact**, retrieved through the official Job Artifacts API; its schema is not a native GitLab endpoint.

```json
{
  "project_id": 101,
  "pipeline_id": 8101,
  "commit_sha": "0123456789abcdef0123456789abcdef01234567",
  "sbom_job_id": 12101,
  "sbom_path": "reports/sbom.cdx.json",
  "subject": {
    "type": "container-image",
    "digest": "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
  }
}
```

All values above are examples. The build must populate the real digest of the pushed artifact and the correct SBOM job. Capture the SBOM for that subject, including the platform when applicable. A ZIP Lambda build uses a subject type such as `lambda-code-sha256` and the appropriate base64 SHA-256 of the uploaded code ZIP.

Publish the files as ordinary job artifacts; the generation commands are organization-specific:

```yaml
# Snippet to merge into the job that generates the real SBOM and manifest.
# This snippet does not itself generate either file.
artifacts:
  paths:
    - reports/sbom.cdx.json
    - reports/build-manifest.json
```

Download by **project and exact job ID**, including older builds still running in production:

```bash
curl --fail --silent --show-error --location \
  --header "Authorization: Bearer $GL_TOKEN" \
  "$GL_BASE/api/v4/projects/$GL_PROJECT_ID/jobs/$GL_SBOM_JOB_ID/artifacts/reports/build-manifest.json" \
  --output build-manifest.json

curl --fail --silent --show-error --location \
  --header "Authorization: Bearer $GL_TOKEN" \
  "$GL_BASE/api/v4/projects/$GL_PROJECT_ID/jobs/$GL_SBOM_JOB_ID/artifacts/reports/sbom.cdx.json" \
  --output sbom.cdx.json
```

These examples assume the manifest and SBOM share a job. If they do not, download the manifest from its publishing job and follow its explicit SBOM job/path. Artifact paths must be appropriately URL-encoded. Curl handles redirects without forwarding the Authorization header to another host by default; do not use `--location-trusted`. Keep downloaded content and temporary signed URLs out of unrestricted logs.

Maintain a searchable artifact-to-build index from captured manifests to avoid scanning every historical pipeline for each asset. The index is collector-owned. Handle expired artifacts and incomplete historical coverage as evidence gaps. GitLab's latest-by-ref artifact endpoint is useful for other purposes but cannot prove which artifact an observed workload uses.

Official references: [Projects](https://docs.gitlab.com/api/projects/), [Environments](https://docs.gitlab.com/api/environments/), [Deployments](https://docs.gitlab.com/api/deployments/), [Pipelines](https://docs.gitlab.com/api/pipelines/), [Jobs](https://docs.gitlab.com/api/jobs/), [Job Artifacts](https://docs.gitlab.com/api/job_artifacts/).

## 4. AWS: collect the observed deployment

Use the official AWS CLI or SDK so requests use SigV4 and the standard credential provider chain. The following examples assume the approved credentials/profile is already configured and `AWS_REGION` is an approved collection region. Repeat in every authorized account/region and retain that scope in the capture.

```bash
aws sts get-caller-identity
aws ecs list-clusters --region "$AWS_REGION"
```

### ECS containers

For each cluster, enumerate tasks, then describe them in batches of at most 100:

```bash
aws ecs list-tasks --region "$AWS_REGION" \
  --cluster "$ECS_CLUSTER_ARN" --desired-status RUNNING

# ECS_TASK_ARN is one returned ARN; pass up to 100 separate ARNs per batch.
aws ecs describe-tasks --region "$AWS_REGION" \
  --cluster "$ECS_CLUSTER_ARN" --tasks "$ECS_TASK_ARN" --include TAGS
```

Retain `taskArn`, `clusterArn`, `taskDefinitionArn`, task/container `lastStatus`, `containers[].name`, `containers[].imageDigest`, and tags. Use each running container as an observation. Check the response's `failures` array even for a successful HTTP request. Desired RUNNING state alone does not prove current running state.

Task tags may require configured propagation from service/task definition. If business ownership exists only on a service or an external catalog, collect that relationship explicitly. Never assume a task inherits all tags. `image` can contain a mutable tag; `imageDigest` is the observed immutable subject used for the join.

A minimal SDK collection pattern illustrates pagination, batching, and failure retention:

```python
import boto3

session = boto3.Session()  # approved default credential provider chain
account = session.client("sts").get_caller_identity()["Account"]
ecs = session.client("ecs")  # region supplied by approved SDK configuration
observations, failures = [], []
for cluster_page in ecs.get_paginator("list_clusters").paginate():
    for cluster in cluster_page["clusterArns"]:
        for task_page in ecs.get_paginator("list_tasks").paginate(
            cluster=cluster, desiredStatus="RUNNING"
        ):
            arns = task_page["taskArns"]
            for start in range(0, len(arns), 100):
                response = ecs.describe_tasks(
                    cluster=cluster, tasks=arns[start:start + 100], include=["TAGS"]
                )
                failures.extend(response.get("failures", []))
                for task in response.get("tasks", []):
                    if task.get("lastStatus") != "RUNNING":
                        continue
                    for container in task.get("containers", []):
                        if container.get("lastStatus") == "RUNNING":
                            observations.append({
                                "account": account,
                                "region": ecs.meta.region_name,
                                "task": task,
                                "container": container,
                            })
# Persist a capture envelope with observations, failures, and capture timestamps.
# Add API exception handling/retries and collection coverage before production use.
```

Official references: [ListClusters](https://docs.aws.amazon.com/AmazonECS/latest/APIReference/API_ListClusters.html), [ListTasks](https://docs.aws.amazon.com/AmazonECS/latest/APIReference/API_ListTasks.html), [DescribeTasks](https://docs.aws.amazon.com/AmazonECS/latest/APIReference/API_DescribeTasks.html), [Container](https://docs.aws.amazon.com/AmazonECS/latest/APIReference/API_Container.html).

### Lambda functions

Discover functions and the aliases that represent actual environment routing:

```bash
aws lambda list-functions --region "$AWS_REGION"
aws lambda list-aliases --region "$AWS_REGION" --function-name "$LAMBDA_FUNCTION"
aws lambda get-alias --region "$AWS_REGION" \
  --function-name "$LAMBDA_FUNCTION" --name "$LAMBDA_ALIAS"

# Resolve the primary FunctionVersion and any AdditionalVersionWeights entries.
aws lambda get-function --region "$AWS_REGION" \
  --function-name "$LAMBDA_FUNCTION" --qualifier "$LAMBDA_VERSION"

# Use the unqualified function ARN for function-level tags.
aws lambda list-tags --region "$AWS_REGION" --resource "$LAMBDA_FUNCTION_ARN"
```

Preserve routing weights and each published version's configuration. Function `State=Active` means the function is ready; it is not proof that it currently receives traffic. Use alias/event-source/invocation context appropriate to the question rather than treating every published version as actively used. The demo simplifies this distinction.

For ZIP code, `Configuration.CodeSha256` identifies the code package; join it to a typed build manifest. `Configuration.Runtime` identifies a managed runtime family, not its exact patch. For an image function, use the resolved image identity in `Code.ResolvedImageUri` where supplied. Layers are separate versioned subjects and must be collected/inventoried separately for a complete library view. Exclude `Code.Location`, environment-variable values, and other unnecessary sensitive configuration from the viewer capture.

Official references: [GetFunction](https://docs.aws.amazon.com/lambda/latest/api/API_GetFunction.html), [ListAliases](https://docs.aws.amazon.com/lambda/latest/api/API_ListAliases.html), [GetAlias](https://docs.aws.amazon.com/lambda/latest/api/API_GetAlias.html), [ListTags](https://docs.aws.amazon.com/lambda/latest/api/API_ListTags.html).

### EC2 and Systems Manager installed software

```bash
aws ec2 describe-instances --region "$AWS_REGION" \
  --filters Name=instance-state-name,Values=running

aws ssm list-inventory-entries --region "$AWS_REGION" \
  --instance-id "$EC2_INSTANCE_ID" --type-name 'AWS:Application'
```

Read EC2 identities/tags from `Reservations[].Instances[]`. Keep account identity from the collector context. SSM's response supplies `InstanceId`, `TypeName`, `CaptureTime`, and `Entries`, including package `Name` and `Version`. Preserve release/epoch/package metadata where present rather than forcing every OS package into SemVer.

The host must be a managed node with SSM Inventory configured to collect application data. No entries or an API failure do not prove no software is installed. The native `ListInventoryEntries` operation returns up to 50 entries per page: follow `NextToken` until exhausted. AWS CLI commands with pagination support auto-paginate by default; verify the selected CLI operation/version and handle any returned continuation token. SDK collectors must explicitly use supported paginators or token loops.

This establishes installed-software evidence. App tags do not prove which interpreter/library a process uses. A process-level claim requires additional suitable instrumentation.

Official references: [DescribeInstances](https://docs.aws.amazon.com/AWSEC2/latest/APIReference/API_DescribeInstances.html), [ListInventoryEntries](https://docs.aws.amazon.com/systems-manager/latest/APIReference/API_ListInventoryEntries.html), [Inventory setup](https://docs.aws.amazon.com/systems-manager/latest/userguide/systems-manager-inventory.html).

## 5. Connect the records: an end-to-end join

These values are illustrative; the application mapping and manifest are explicit integration conventions.

| Step | Evidence read through the API | Join/output |
| --- | --- | --- |
| 1 | ServiceNow application `sys_id=A` and approved service relationship | Scoped application A → service S |
| 2 | Configured custom mapping table/field for S | S → GitLab instance G, project 101, build target `customer-api` |
| 3 | AWS task tags/catalog association identify A/S and raw environment `production` | Workload W → A/S and canonical `prod` |
| 4 | ECS running container reports `imageDigest=D` | W observes typed container artifact D at time T |
| 5 | Captured GitLab build manifest binds project 101, digest D, pipeline P, commit C, and SBOM job J | D → exact build P and SBOM artifact J/path |
| 6 | GitLab pipeline/job responses agree with manifest; Job Artifacts API returns that SBOM | Validate provenance context and parse the matching artifact inventory |
| 7 | SBOM records Python `3.10.15` | Answer: W's observed artifact inventory records Python 3.10.15 in prod |

The collector should resolve from the **observed artifact** into captured build evidence. Deployment targets help explain intent and rollout differences; they do not override an observed older digest.

If D is missing, unrecognized, ambiguous, or described only by a mismatched SBOM, report an unresolved version. If the only evidence is Lambda `python3.11`, report family-only precision. If the evidence is EC2 installed software, retain host-installed scope. Never fill these gaps using a latest pipeline or a similarly named package.

## Repository fallback when metadata is incomplete

Use the official GitLab **Repository Tree API** (`GET /projects/:id/repository/tree`) to enumerate approved files at the full build commit, then the **Repository Files API** (`GET /projects/:id/repository/files/:file_path`, or `/raw`) to retrieve their contents with the same `ref`. Preserve project/instance identity, commit, file path, blob/content hash, scope, and collection status. Never substitute the default branch for an observed build commit.

[Repository version evidence](repository-version-evidence.md#collect-source-files-using-official-gitlab-apis) supplies authentication, concrete requests, pagination/error handling, field meanings, monorepo constraints, and the implemented browser-local analyzer. Exact source pins, lock entries, minimum requirements, and image hints remain separate from artifact or process evidence. ServiceNow supplies application/service association; AWS supplies deployed-asset identity; GitLab supplies build revision and source files. A source pin alone cannot resolve a deployed-version Unknown.

## 6. Feed the proof of concept without mislabeling real data

Today's `buildPortfolio` requires `schema_version: 1` and `simulated: true`. **Do not relabel real captures as simulated to bypass that check.** A live/offline-real mode, access controls, sanitization policy, and appropriate UI labels must be implemented before loading real enterprise data into this public demo.

For a future adapter, the native response-to-bundle translation points are:

| Native source | Current fixture location | Translation required |
| --- | --- | --- |
| ServiceNow Table API `result` | `servicenow.businessApplications.result` | Retain IDs and reference values; combine with application-service relationships and approved source bindings using the active mapping profile |
| GitLab project-scoped endpoints | `gitlab.projects/pipelines/jobs/environments/deployments` | Attach collection project/instance context; complete all pages |
| GitLab job artifact manifest | `buildManifests` | Parse the integration-owned manifest, preserving exact subject and build/job binding |
| GitLab SBOM job response | `sbomArtifacts[].response` | Wrap the body with exact project, job, and artifact path |
| ECS `DescribeTasks.tasks` | `aws.ecs.tasks` | Combine capture pages and preserve tags/container identities and failures separately |
| Lambda configuration and function tags | `aws.lambda.functions` | Preserve qualified version/routing context; sanitize captured fields |
| EC2 `Reservations` | `aws.ec2.Reservations` | Preserve region/account capture context alongside native instance records |
| SSM `ListInventoryEntries.Entries` | `aws.ssm.Entities[].Data['AWS:Application'].Content` | Adapter-created envelope: carry InstanceId to Id and CaptureTime into the inventory record; this wrapper is not the native ListInventoryEntries response |

The proposed canonical adapter design is preferable for multiple source instances and many-to-many service relationships. The table identifies current code touchpoints rather than promising that the fixed fixture adapter is a complete live integration.

## 7. Verify an integration before relying on its answers

1. Record connector/API versions, query scopes, capture times, pagination completion, and access failures. Keep secrets and transient signed URLs out of logs and exported data.
2. Select a known application and manually confirm its CI/service/project association with the owning teams.
3. Pick a currently observed asset, retrieve its immutable artifact identity, and follow the exact build/job/SBOM chain. Confirm a known component version at the expected evidence scope.
4. Compare two environments and a rolling deployment. Verify that multiple simultaneous versions survive normalization.
5. Test missing tags, expired artifacts, denied reads, unknown digests, absent SSM inventory, and family-only runtime evidence. These must produce incomplete/unknown coverage rather than clean results.
6. Compare against a sanitized fixture in automated adapter tests. Retain the mapping revision so results are reproducible.

No customer endpoint connectivity or permissions have been verified. The POC implements simulated adapters, canonical mapping and a SQLite export/import path. Production collection, scheduling, historical persistence and complete operational error handling remain integration work.
