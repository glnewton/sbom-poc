# Logical entity fields

Logical fields are projections of the native mapping table and typed relationships. Foreign-key projections use canonical target IDs; the physical graph stores them as relationship rows. Optional missing source fields remain unknown.

## Business application

| Field | Logical type | Key |
| --- | --- | --- |
| id | string | PK |
| sys_id | string |  |
| number | string |  |
| name | string |  |
| application_manager | reference |  |
| business_criticality | string |  |

## Application service

| Field | Logical type | Key |
| --- | --- | --- |
| id | string | PK |
| sys_id | string |  |
| sys_class_name | string |  |
| name | string |  |
| service_key | string | FK |
| environment_key | string | FK |

## Deployable service

| Field | Logical type | Key |
| --- | --- | --- |
| id | string | PK |
| name | string |  |
| registry_namespace | string |  |

## Service/source binding

| Field | Logical type | Key |
| --- | --- | --- |
| id | string | PK |
| service_key | string | FK |
| project_key | string | FK |
| path | string |  |
| build_target | string |  |
| role | string |  |
| valid_from | datetime |  |
| valid_to | datetime |  |

## Source project

| Field | Logical type | Key |
| --- | --- | --- |
| id | string | PK |
| gitlab_instance | string |  |
| project_id | integer |  |
| path_with_namespace | string |  |
| default_branch | string |  |

## Source commit

| Field | Logical type | Key |
| --- | --- | --- |
| id | string | PK |
| project_key | string | FK |
| sha | string |  |

## Source file

| Field | Logical type | Key |
| --- | --- | --- |
| id | string | PK |
| commit_key | string | FK |
| path | string |  |
| content_hash | string |  |
| last_commit_id | string |  |

## Build pipeline

| Field | Logical type | Key |
| --- | --- | --- |
| id | string | PK |
| project_key | string | FK |
| commit_key | string | FK |
| pipeline_id | integer |  |
| status | string |  |
| created_at | datetime |  |

## Build/SBOM job

| Field | Logical type | Key |
| --- | --- | --- |
| id | string | PK |
| pipeline_key | string | FK |
| job_id | integer |  |
| name | string |  |
| stage | string |  |
| status | string |  |

## Immutable artifact

| Field | Logical type | Key |
| --- | --- | --- |
| id | string | PK |
| subject_type | string |  |
| digest | string |  |
| release | string |  |

## SBOM document

| Field | Logical type | Key |
| --- | --- | --- |
| id | string | PK |
| job_key | string | FK |
| path | string |  |
| format | string |  |
| document_version | string |  |

## Component identity

| Field | Logical type | Key |
| --- | --- | --- |
| id | string | PK |
| sbom_key | string | FK |
| reference | string |  |
| name | string |  |
| purl | string |  |

## Version observation

| Field | Logical type | Key |
| --- | --- | --- |
| id | string | PK |
| component | string |  |
| version | string |  |
| precision | string |  |
| scope | string |  |
| locator | string |  |
| captured_at | datetime |  |

## Environment

| Field | Logical type | Key |
| --- | --- | --- |
| id | string | PK |
| organization | string |  |
| name | string |  |

## GitLab environment

| Field | Logical type | Key |
| --- | --- | --- |
| id | string | PK |
| project_key | string | FK |
| environment_key | string | FK |
| environment_id | integer |  |
| name | string |  |
| tier | string |  |

## GitLab deployment

| Field | Logical type | Key |
| --- | --- | --- |
| id | string | PK |
| gitlab_environment_key | string | FK |
| commit_key | string | FK |
| deployment_id | integer |  |
| status | string |  |
| updated_at | datetime |  |

## AWS account

| Field | Logical type | Key |
| --- | --- | --- |
| id | string | PK |
| partition | string |  |
| account_id | string |  |
| collector_principal | string |  |

## AWS region

| Field | Logical type | Key |
| --- | --- | --- |
| id | string | PK |
| partition | string |  |
| region_name | string |  |

## ECS cluster

| Field | Logical type | Key |
| --- | --- | --- |
| id | string | PK |
| cluster_arn | string |  |
| cluster_name | string |  |
| status | string |  |

## ECS service

| Field | Logical type | Key |
| --- | --- | --- |
| id | string | PK |
| cluster_key | string | FK |
| task_definition_key | string | FK |
| service_arn | string |  |
| service_name | string |  |
| desired_count | integer |  |

## ECS task definition revision

| Field | Logical type | Key |
| --- | --- | --- |
| id | string | PK |
| task_definition_arn | string |  |
| family | string |  |
| revision | integer |  |
| container_definitions | json |  |

## ECR image occurrence

| Field | Logical type | Key |
| --- | --- | --- |
| id | string | PK |
| artifact_key | string | FK |
| registry_id | string |  |
| region | string |  |
| repository_name | string |  |
| image_digest | string |  |
| image_tags | json |  |

## Lambda function

| Field | Logical type | Key |
| --- | --- | --- |
| id | string | PK |
| unqualified_arn | string |  |
| function_name | string |  |

## Lambda alias

| Field | Logical type | Key |
| --- | --- | --- |
| id | string | PK |
| function_key | string | FK |
| alias_arn | string |  |
| name | string |  |
| primary_version | string |  |
| additional_version_weights | json |  |

## Observed workload

| Field | Logical type | Key |
| --- | --- | --- |
| id | string | PK |
| account_key | string | FK |
| region_key | string | FK |
| application_service_key | string | FK |
| artifact_key | string | FK |
| resource_id | string |  |
| kind | string |  |
| observed_at | datetime |  |
| mapping_status | string |  |

## Host inventory snapshot

| Field | Logical type | Key |
| --- | --- | --- |
| id | string | PK |
| workload_key | string | FK |
| type_name | string |  |
| captured_at | datetime |  |
