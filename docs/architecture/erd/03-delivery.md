# delivery logical ERD

Generated from the same catalog as the POC workbench. Each node is a typed canonical entity; its native scoped key is documented in the entity dictionary. Logical fields below project native attributes, capture metadata and relationship keys; *_key foreign keys are physically implemented by typed edges, not duplicated columns in the graph store. Optional fields such as source-file hashes remain absent when the capture does not supply them. The physical graph store is documented separately. Cardinalities describe a valid, complete relationship; missing captures produce issues rather than invented parents. Many-to-many links are represented as relationship assertions.

```mermaid
erDiagram
  PROJECT {
    string id PK
    string gitlab_instance
    integer project_id
    string path_with_namespace
    string default_branch
  }
  COMMIT {
    string id PK
    string project_key FK
    string sha
  }
  PIPELINE {
    string id PK
    string project_key FK
    string commit_key FK
    integer pipeline_id
    string status
    datetime created_at
  }
  JOB {
    string id PK
    string pipeline_key FK
    integer job_id
    string name
    string stage
    string status
  }
  ARTIFACT {
    string id PK
    string subject_type
    string digest
    string release
  }
  SBOM {
    string id PK
    string job_key FK
    string path
    string format
    string document_version
  }
  GITLAB_ENVIRONMENT {
    string id PK
    string project_key FK
    string environment_key FK
    integer environment_id
    string name
    string tier
  }
  DEPLOYMENT {
    string id PK
    string gitlab_environment_key FK
    string commit_key FK
    integer deployment_id
    string status
    datetime updated_at
  }
  PROJECT ||--o{ COMMIT : "project_commit"
  COMMIT ||--o{ PIPELINE : "commit_pipeline"
  PIPELINE ||--o{ JOB : "pipeline_job"
  JOB }o--o{ ARTIFACT : "job_artifact"
  JOB ||--o{ SBOM : "job_sbom"
  ARTIFACT }o--o{ SBOM : "artifact_sbom"
  PROJECT ||--o{ GITLAB_ENVIRONMENT : "project_environment"
  GITLAB_ENVIRONMENT ||--o{ DEPLOYMENT : "environment_deployment"
  DEPLOYMENT }o--|| COMMIT : "deployment_commit"
```

| Relationship | From | To | Cardinality | Join policy | Rule |
| --- | --- | --- | --- | --- | --- |
| project_commit | project | commit | one-to-many | Exact project and full commit SHA | BUILD-01 |
| commit_pipeline | commit | pipeline | one-to-many | Pipeline.sha equals commit SHA | BUILD-01 |
| pipeline_job | pipeline | job | one-to-many | Job.pipeline.id and project context agree | BUILD-01 |
| job_artifact | job | artifact | many-to-many | Manifest binds build/job to typed subject | BUILD-02 |
| job_sbom | job | sbom | one-to-many | Exact job artifact path and captured body | SBOM-01 |
| artifact_sbom | artifact | sbom | many-to-many | Validated manifest; no latest-job lookup | SBOM-01 |
| project_environment | project | gitlab_environment | one-to-many | Project-scoped environment ID | DEPLOY-01 |
| environment_deployment | gitlab_environment | deployment | one-to-many | Deployment.environment.id | DEPLOY-01 |
| deployment_commit | deployment | commit | many-to-one | Deployment.sha; intent only | DEPLOY-01 |

