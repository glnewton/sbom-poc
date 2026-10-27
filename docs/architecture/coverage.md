# Implementation and platform coverage

The architecture is comprehensive for the current ServiceNow/GitLab/ECS/Lambda-ZIP/EC2 POC scope. This matrix distinguishes working behavior from integration extensions rather than implying universal discovery.

| Capability | POC behavior | Evidence / extension boundary |
| --- | --- | --- |
| Business applications, application services, CMDB relationship type/direction | Implemented captures, profiles, graph and UI | Customer class/ACL and relation selection must be configured in a collector |
| Shared service consumers | Implemented many-to-many CMDB relations and explicit primary-owner decision | Primary version scope is operator; consumer links remain inspectable |
| Multiple repositories per service / multiple targets per project | Registry and graph implement primary/auxiliary bindings; fixture includes both | One active primary target per deployable service; split independent targets or extend workload target selection |
| Alternate customer schema | Two executable profiles change relationship/reference and AWS-tag selection | Arbitrary expression languages and in-browser profile authoring are not implemented |
| GitLab source → pipeline → job → SBOM | Implemented validation and native-record lineage | Live collection, artifact retention and cryptographic attestations need deployment work |
| Exact version search across application/environment | Existing search now consumes resolved profile mappings | Conflicting ownership blocks attribution; evidence precision preserved |
| ECS cluster/service/task-definition/container graph | Implemented from simulated native-shaped captures | Running digest is identity; desired service config is retained separately |
| ECR registry occurrence → immutable artifact | Implemented | OCI index-to-child mapping, image-layer scanning and cross-registry attestations need extra evidence |
| Lambda published ZIP versions, aliases, code hash, runtime family | Implemented | Weighted alias logic preserves additional targets and reports missing captures; fixture has single-target aliases |
| Lambda container images and layers | Documented extension | Add ResolvedImageUri/layer-version identities and SBOM associations; not inferred from ZIP hash |
| EC2/SSM installed software | Implemented with account/region/instance/time scope | Does not establish process usage or container inventory on that host |
| Repository source fallback | Implemented supported local files and simulated full-commit snapshots | Live cloning/collection, unsupported package managers and full dependency resolution remain separate work |
| EKS/Kubernetes | Extension documented below | No implemented Kubernetes adapter or pod/version claims |
| Elastic Beanstalk / App Runner / Fargate beyond ECS fixture | Extension documented below | No implemented provider adapter; artifact evidence requirements still apply |
| Native-to-canonical field tables, ERDs and rule inventory | Generated from shared runtime catalog and committed | Regenerate after catalog changes; handwritten runbooks need reviewed updates |
| Persistent canonical store | Executable SQLite single-capture exporter/importer | Production multi-tenant APIs, history, retention, review workflows and scheduling not implemented |
| Live official API connections | Concrete operations/authentication/pagination documented | No customer credentials or network collection configured; all hosted fixtures stay simulated |

## EKS / Kubernetes extension

Use AWS EKS `ListClusters`/`DescribeCluster` for cluster/account/region identity, then authorized Kubernetes API reads for namespaces, Deployments/StatefulSets/DaemonSets/Jobs, ReplicaSets and Pods. Model controller UID, namespace UID, pod UID and container name; resolve ownerReferences by UID. The running container `status.containerStatuses[].imageID` is observed artifact evidence, while pod spec image tags express intent. Map service/application ownership with approved labels/registry bindings and preserve label conflicts. GitLab environment names alone do not identify a namespace. Add typed entities, API contracts, joins, failure cases and fixtures before enabling this adapter.

Official references: [EKS DescribeCluster](https://docs.aws.amazon.com/eks/latest/APIReference/API_DescribeCluster.html), [Kubernetes API reference](https://kubernetes.io/docs/reference/kubernetes-api/).

## Other AWS deployment models

For App Runner, describe service/source configuration and resolve the deployed immutable image/build evidence rather than assuming a mutable configured tag identifies observed bytes. For Elastic Beanstalk, retain application/environment/version label, application-version source bundle and the deployed instance/container observations. A release label is not a language/library version. Add explicit build-manifest identities for non-container packages where necessary.

Official references: [App Runner DescribeService](https://docs.aws.amazon.com/apprunner/latest/api/API_DescribeService.html), [Elastic Beanstalk DescribeEnvironments](https://docs.aws.amazon.com/elasticbeanstalk/latest/api/API_DescribeEnvironments.html).

## Production acceptance gates

Validate at least one manually traced workload per source/platform, denied and partial responses, pagination completion, duplicate/native identity collisions, expired SBOMs, multiple build jobs for one SHA, many-to-many CMDB relationships, environment drift, image index/child mismatches, alias weighted rollouts, missing runtime patches, unsupported source files, and differences between declared, installed and executed versions. Record the accepted mapping-profile revision and evidence capture window. These are integration validation requirements, not claims that a public POC has verified customer systems.
