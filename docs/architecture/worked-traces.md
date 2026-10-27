# Worked traces and acceptance cases

Generated from committed fixtures and the current mapping implementation. Open **Mapping workbench → Workload trace** and select the service/environment below; the same keys and decisions appear in the POC. Snapshot: 2026-10-26T12:00:00Z. Profile: cmdb-relationships.

The current graph contains 655 entities, 1135 relationships and 12 recorded issues. These are deterministic fixture counts, not production statistics.

## Atlas Python prod, including mixed rollout

| Field | Recorded value |
| --- | --- |
| Application | Atlas Customer Platform |
| Workload | arn:aws:ecs:us-east-1:111122223333:task/prod-applications/efb14a2924cf26adea75621cebacad57 |
| Environment / type | prod / ECS |
| Application-service sys_id | 025902e8ba7ee39ffb5c5c405299d406 |
| Deployable service / build target | service-101 / customer-api |
| Project / source path | 101 / . |
| Mapping decision | resolved |
| Observed artifact | sha256:9d9ee29fe63f22431b15170b2ce29e50bd648cb9083b2a3348aadfb84b57a929 |
| Build commit | 4fe170c90f1c8b19bd20f4fe3b16f717bbee162e |
| Pipeline / SBOM job | 8003 / 12003 |
| Inventory scope | artifact |
| Recorded components | python 3.10.15 (exact); fastapi 0.103.2 (exact); requests 2.31.0 (exact); urllib3 1.26.18 (exact) |
| Trace size | 29 entities / 41 relationships |
| Issues | None recorded |

| Field | Recorded value |
| --- | --- |
| Application | Atlas Customer Platform |
| Workload | arn:aws:ecs:us-east-1:111122223333:task/prod-applications/26b30febcf55be1c8914d325f398f465 |
| Environment / type | prod / ECS |
| Application-service sys_id | 025902e8ba7ee39ffb5c5c405299d406 |
| Deployable service / build target | service-101 / customer-api |
| Project / source path | 101 / . |
| Mapping decision | resolved |
| Observed artifact | sha256:5d9d4d7f16a0bec62eba0e1da25918ef693712095f03c8d1ebc69ac8dbfb7532 |
| Build commit | 03e7e9e4d28dcecc729b2d561e44260d6d8d8541 |
| Pipeline / SBOM job | 8004 / 12004 |
| Inventory scope | artifact |
| Recorded components | python 3.10.14 (exact); fastapi 0.103.2 (exact); requests 2.31.0 (exact); urllib3 1.26.18 (exact) |
| Trace size | 29 entities / 40 relationships |
| Issues | AWS build differs from GitLab deployment target |


## Beacon prod: known build, missing SBOM, repository fallback

| Field | Recorded value |
| --- | --- |
| Application | Beacon Analytics |
| Workload | arn:aws:ecs:us-east-1:111122223333:task/prod-applications/ee0563124ec475b22ea9ee048f218cce |
| Environment / type | prod / ECS |
| Application-service sys_id | 1a6d51cfd65e816d1a5eeee3880ed70a |
| Deployable service / build target | service-302 / report-builder |
| Project / source path | 302 / . |
| Mapping decision | resolved |
| Observed artifact | sha256:1e3dc42f9e86255be616f9f1f098713597dea4dfa1a543f3eb367f230d079d84 |
| Build commit | 9253732f83c7c90ba73e435e01aec53c97fbba3e |
| Pipeline / SBOM job | 8023 / 12023 |
| Inventory scope | gap |
| Recorded components | No component inventory linked |
| Trace size | 24 entities / 27 relationships |
| Issues | SBOM artifact missing |


## Beacon prod: unknown observed digest

| Field | Recorded value |
| --- | --- |
| Application | Beacon Analytics |
| Workload | arn:aws:ecs:us-east-1:111122223333:task/prod-applications/df9753905410d4d977f6a30030409de5 |
| Environment / type | prod / ECS |
| Application-service sys_id | 1a6d51cfd65e816d1a5eeee3880ed70a |
| Deployable service / build target | service-302 / report-builder |
| Project / source path | 302 / . |
| Mapping decision | resolved |
| Observed artifact | sha256:8eafee238a17c97ce5b51cb39e6a37d38fd2da613783ab55dc336ae225ff5a64 |
| Build commit | Unresolved |
| Pipeline / SBOM job | Unresolved |
| Inventory scope | gap |
| Recorded components | No component inventory linked |
| Trace size | 13 entities / 15 relationships |
| Issues | Artifact digest not linked to a build |


## Harbor DEV: CMDB/AWS ownership conflict

| Field | Recorded value |
| --- | --- |
| Application | Unresolved |
| Workload | arn:aws:ecs:us-east-1:444455556666:task/dev-applications/e16d34429c0dc60366971d8ddf171f41 |
| Environment / type | dev / ECS |
| Application-service sys_id | 8c9e009f23211ae60e2c48551845ccc9 |
| Deployable service / build target | service-401 / operations-portal |
| Project / source path | Unresolved / . |
| Mapping decision | conflict |
| Observed artifact | sha256:0d4af28deb20197acef878a6f89bd19a374580c75c0c01762f7e37161bfba899 |
| Build commit | Unresolved |
| Pipeline / SBOM job | Unresolved |
| Inventory scope | gap |
| Recorded components | No component inventory linked |
| Trace size | 19 entities / 24 relationships |
| Issues | AWS application tag contradicts CMDB ownership.; Application mapping missing; GitLab project mapping missing |


## Harbor UAT: image tag without observed digest

| Field | Recorded value |
| --- | --- |
| Application | Harbor Operations |
| Workload | arn:aws:ecs:us-east-1:444455556666:task/uat-applications/ecb215920c16680f800d97d622c8725d |
| Environment / type | uat / ECS |
| Application-service sys_id | a828dc9448f461a39a3459cb156f41bb |
| Deployable service / build target | service-401 / operations-portal |
| Project / source path | 401 / . |
| Mapping decision | resolved |
| Observed artifact | Missing |
| Build commit | Unresolved |
| Pipeline / SBOM job | Unresolved |
| Inventory scope | gap |
| Recorded components | No component inventory linked |
| Trace size | 12 entities / 14 relationships |
| Issues | Observed artifact digest missing |


## Shared notification service and Lambda runtime family

| Field | Recorded value |
| --- | --- |
| Application | Atlas Customer Platform |
| Workload | arn:aws:lambda:us-east-1:111122223333:function:notification-handler-prod:12 |
| Environment / type | prod / Lambda |
| Application-service sys_id | aa1b5ffc7cbd31e0eb4822967925d9ec |
| Deployable service / build target | service-103 / notification-handler |
| Project / source path | 103 / . |
| Mapping decision | resolved |
| Observed artifact | kupkqc1DSDzJwFr/fpOgNN/0IwwA+PaqrQXhPAIh0sI= |
| Build commit | 256cb07271635a2257d34118e3f0ad9e6ebf7167 |
| Pipeline / SBOM job | 8011 / 12011 |
| Inventory scope | artifact |
| Recorded components | requests 2.31.0 (exact); boto3 1.34.10 (exact); python 3.11 (family) |
| Trace size | 24 entities / 31 relationships |
| Issues | None recorded |


## Harbor host-installed software

| Field | Recorded value |
| --- | --- |
| Application | Harbor Operations |
| Workload | i-decbc7cdd0e793715 |
| Environment / type | prod / EC2 |
| Application-service sys_id | 3e98d469a6907c2da859a35d26474136 |
| Deployable service / build target | service-402 / legacy-batch |
| Project / source path | 402 / . |
| Mapping decision | resolved |
| Observed artifact | Missing |
| Build commit | Unresolved |
| Pipeline / SBOM job | Unresolved |
| Inventory scope | host |
| Recorded components | python3 3.9.18 (exact); requests 2.28.2 (exact); urllib3 1.26.16 (exact) |
| Trace size | 13 entities / 16 relationships |
| Issues | None recorded |


## Unmapped ECS worker

| Field | Recorded value |
| --- | --- |
| Application | Unresolved |
| Workload | arn:aws:ecs:us-east-1:444455556666:task/dev-applications/88f6811ab5d8fc6d3177f9b7609ae0fc |
| Environment / type | dev / ECS |
| Application-service sys_id | Missing |
| Deployable service / build target | Missing / Missing |
| Project / source path | Unresolved / Unresolved |
| Mapping decision | unresolved |
| Observed artifact | sha256:87abb46a5c0e577d327fffdcd25afe608e83e6c69db5932d74e2f13d9c957e4c |
| Build commit | Unresolved |
| Pipeline / SBOM job | Unresolved |
| Inventory scope | gap |
| Recorded components | No component inventory linked |
| Trace size | 21 entities / 27 relationships |
| Issues | AWS ApplicationServiceId does not identify exactly one CMDB application service.; Application mapping missing; GitLab project mapping missing |

## Acceptance behavior

- Unknown digest, missing SBOM, missing version and ownership conflict are separate failure states. No latest-build or display-name shortcut is permitted.
- Changing to the custom-reference profile preserves equivalent primary mappings for this fixture, while applying a different ownership/tag route.
- Removing the shared-service ownership decision makes the relationship profile ambiguous; it cannot silently choose an application.
- Adding an active duplicate primary source binding or expiring the only primary binding blocks attribution.
- A missing Lambda alias target is a captured routing gap, not an invented function version.
- Missing repository/SBOM fields remain evidence-specific Unknowns; source pins stay attached to their exact commit.

These cases are executable in `mapping-checks.mjs`, with existing artifact/version cases in `enterprise-checks.mjs` and `repository-checks.mjs`.

