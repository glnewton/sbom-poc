# Executable adapter profiles and customer variation

## Native data versus integration conventions

The source envelope is `dist/data/simulated-mapping-input.json` with `schema_version:1`, `simulated:true`, capture time, source instances, profiles, source captures and an integration registry. It supplements the original enterprise snapshot. It is an adapter bundle, not a native vendor response.

| Bundle collection | Native source or integration origin |
| --- | --- |
| `servicenow.applicationServices.result` | ServiceNow Table API application-service rows; demo uses `cmdb_ci_service_auto` |
| `servicenow.relationships.result` | Table API `cmdb_rel_ci` rows with `parent`, `child`, `type` references |
| `servicenow.relationshipTypes.result` | Table API `cmdb_rel_type`; relationship type sys_id is instance-specific |
| `registry.services` | Integration-owned deployable-service identities |
| `registry.sourceBindings` | Approved service ↔ GitLab instance/project/path/build-target registry |
| `registry.ownershipDecisions` | Explicit primary operator decision for shared service consumers |
| `aws.accounts` | STS GetCallerIdentity-shaped capture context |
| `aws.ecs.clusters/services/taskDefinitions` | Aggregated Describe* response records |
| `aws.ecr.images` | Aggregated ECR DescribeImages image details with region context |
| `aws.lambda.aliases` | Aggregated Lambda alias records |
| `aws.workloadTagCaptures` | Adapter envelope: resource ID, account/region context, API operation, capture time and normalized tag map; not a native AWS API response |

The demo's `u_...` fields and AWS tag names are customer conventions. They are never represented as mandatory ServiceNow or AWS fields. `u_gitlab_project_ids` remains in the legacy fixture for backwards compatibility and standalone legacy tests; the live UI uses the selected mapping profile and registry for ownership/project attribution.

## Two implemented profiles

| Setting | CMDB relationship profile | Alternate custom-reference profile |
| --- | --- | --- |
| `id` | `cmdb-relationships` | `custom-reference` |
| `applicationMode` | `relationship` | `reference` |
| `serviceTag` | `ApplicationServiceId` | `CMDBService` |
| `relationType` | Captured `cmdb_rel_type.sys_id` | Retained for graph inspection |
| `parentField` / `childField` | `parent` / `child` | Retained for native graph inspection |
| `applicationReferenceField` | Unused for primary ownership | `u_business_application` |
| `serviceKeyField` | `u_deployable_service_id` | Same configured field |
| `environmentField` | `u_environment` | Same configured field |
| `environmentAliases` | `development→dev`, `user-acceptance→uat`, `production→prod`, `dever→dev` and canonical aliases | Same sample aliases |

The workbench profile selector invokes `buildPortfolio(snapshot, {mappingInput, profileId})` again. It changes the resolver used by the application and version views. The graph is rebuilt from that resolved fleet. Selection is session-local; it does not rewrite files or contact an API.

Profiles use configured direct field names and tag names, not arbitrary code expressions. Reference fields support native `{value, display_value}` objects or raw IDs. Table/class selection and native capture acquisition are collector responsibilities; the current browser receives the normalized bundle collections above. To adapt a different customer class, query that class, preserve its identity, and map the fields into this envelope with an explicit profile revision.

## Resolution algorithm

1. Find exactly one tag capture for the observed resource in the same account and region. Unknown/duplicate captures are unresolved/ambiguous.
2. Read the configured application-service tag and resolve one ServiceNow application-service sys_id in the selected instance. No service name fallback.
3. Resolve business applications through either the configured relationship type/direction or the configured reference field. Validate that application IDs exist.
4. If several applications consume the service, require exactly one approved primary-ownership decision whose primary application is in that relationship set. Keep the other consumers as graph relationships. The version query's application scope means **operating application**, not every consumer; consumer impact can be inspected in the graph.
5. Resolve the deployable-service registry key and one currently valid `primary` source binding. The binding includes GitLab instance, project ID, source path, build target, role, validity and approval context. Validate that the project and service exist. Auxiliary bindings remain visible without being treated as primary artifact producers.
6. Normalize the environment using the selected profile. Compare CMDB and independent AWS app/project/environment tags. Any contradiction becomes `conflict`; no source wins silently.
7. Only a resolved mapping supplies portfolio application/project attribution. Missing or ambiguous mappings remain visible as unresolved workloads. Then the existing observed artifact → build → job → SBOM validation runs.
8. Exact source files may supplement a matching build commit. They remain source observations and do not replace deployed Unknowns.

A result carries `status`, profile ID, resolved application/project, application-service/deployable-service IDs, source path/build target, environment, owner candidates, issues, applied rule IDs and native evidence pointers. Failed results do not supply accepted application/project IDs.

## Cardinality and monorepos

The registry supports many bindings per service and many services per project. The fixture demonstrates an auxiliary source for `customer-api` and another build target (`notification-admin`, path `admin`) in project 103. That second target has no captured deployment, so it contributes no deployed-version claims. Never spread all repository packages to every service in a monorepo.

The current version resolver selects one active primary binding per deployable service. A service with several independently deployed primary targets should be represented as distinct deployable-service IDs or extended with an explicit workload build-target key; the resolver deliberately rejects ambiguous primary bindings. Source path is retained for review, but package-to-build inclusion is not inferred from path alone. A production manifest should also include target/path and enforce them during artifact correlation. The existing manifest identity remains project + pipeline + job + typed digest.

## Precedence, freshness and failures

There is no numerical confidence score or automatic conflict winner. Ownership comes from configured ServiceNow relationships/reference plus approved registry bindings; AWS tags independently corroborate or contradict it. Artifact identity comes from the observed workload. A GitLab environment deployment expresses intent. Runtime/library claims preserve source scope and precision.

Binding validity uses the snapshot's capture time. Capture times remain attached to evidence. The fixed POC is not a temporal reconciliation service: freshness budgets, overlapping collection windows, record deletion/tombstones, multi-instance capture scheduling, and review workflows need a production policy and implementation. Do not turn an API access failure into an empty authoritative collection.

The mutation tests cover missing CMDB links, changed relationship direction/type, expired/duplicate source bindings, missing projects, shared consumers without a decision, conflicting app/project/environment tags, unknown digests and inconsistent build metadata. See [worked traces](worked-traces.md).
