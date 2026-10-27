# ownership logical ERD

Generated from the same catalog as the POC workbench. Each node is a typed canonical entity; its native scoped key is documented in the entity dictionary. Logical fields below project native attributes, capture metadata and relationship keys; *_key foreign keys are physically implemented by typed edges, not duplicated columns in the graph store. Optional fields such as source-file hashes remain absent when the capture does not supply them. The physical graph store is documented separately. Cardinalities describe a valid, complete relationship; missing captures produce issues rather than invented parents. Many-to-many links are represented as relationship assertions.

```mermaid
erDiagram
  APPLICATION {
    string id PK
    string sys_id
    string number
    string name
    json application_manager
    string business_criticality
  }
  APPLICATION_SERVICE {
    string id PK
    string sys_id
    string sys_class_name
    string name
    string service_key FK
    string environment_key FK
  }
  SERVICE {
    string id PK
    string name
    string registry_namespace
  }
  SOURCE_BINDING {
    string id PK
    string service_key FK
    string project_key FK
    string path
    string build_target
    string role
    datetime valid_from
    datetime valid_to
  }
  PROJECT {
    string id PK
    string gitlab_instance
    integer project_id
    string path_with_namespace
    string default_branch
  }
  ENVIRONMENT {
    string id PK
    string organization
    string name
  }
  WORKLOAD {
    string id PK
    string account_key FK
    string region_key FK
    string application_service_key FK
    string artifact_key FK
    string resource_id
    string kind
    datetime observed_at
    string mapping_status
  }
  APPLICATION }o--o{ APPLICATION_SERVICE : "application_uses_service"
  APPLICATION_SERVICE }o--|| SERVICE : "service_instance"
  APPLICATION_SERVICE }o--|| ENVIRONMENT : "service_environment"
  SERVICE ||--o{ SOURCE_BINDING : "service_source"
  SOURCE_BINDING }o--|| PROJECT : "binding_project"
  WORKLOAD }o--|| APPLICATION_SERVICE : "workload_service"
  WORKLOAD }o--|| ENVIRONMENT : "workload_environment"
```

| Relationship | From | To | Cardinality | Join policy | Rule |
| --- | --- | --- | --- | --- | --- |
| application_uses_service | application | application_service | many-to-many | Configured cmdb_rel_ci type/direction or reference field | MAP-02 |
| service_instance | application_service | service | many-to-one | Configured deployable-service key | MAP-03 |
| service_environment | application_service | environment | many-to-one | Configured environment field and aliases | MAP-04 |
| service_source | service | source_binding | one-to-many | Approved source registry membership | MAP-03 |
| binding_project | source_binding | project | many-to-one | Scoped GitLab instance/project ID | MAP-03 |
| workload_service | workload | application_service | many-to-one | Unique configured AWS application-service tag and validated ownership | MAP-01 |
| workload_environment | workload | environment | many-to-one | Resolved CMDB/AWS environment agreement | MAP-04 |

