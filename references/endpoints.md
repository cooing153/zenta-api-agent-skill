<!-- Generated from the Zenta server's supported-API table. Do not edit by hand. -->

# Zenta API reference

Every request sends `Authorization: Bearer $ZENTA_TOKEN` to `$ZENTA_URL` (the Zenta service address — the helper fills it in; see SKILL.md). A token can call only the endpoints below, only with the scopes it was given, and never more than its owner may do in the web app.

## Scopes

| Scope | 화면 이름 |
|---|---|
| `issue:read` | 이슈 보기 |
| `issue:write` | 이슈 만들기·고치기 |
| `chat:read` | 채팅 읽기 |
| `chat:write` | 채팅 보내기 |
| `doc:read` | 문서 보기 |
| `doc:write` | 문서 쓰기 |

An endpoint with no scope works with any personal token — except the inbox, whose `source` value decides the scope (see its `source` parameter). A bot token opens `POST /api/v1/messages` only.

## Refusals

| Status | `code` | Meaning |
|---|---|---|
| 400 | `BAD_REQUEST` | Fix the input: e.g. blank text, or over a length limit (chat 10,000 · issue title 300 · description 50,000 · comment 20,000 · doc title 200 · doc body 200,000 characters). |
| 401 | `UNAUTHORIZED` | Token missing, wrong, revoked or expired — make a new token. |
| 403 | `TOKEN_SCOPE` | The token lacks the scope this endpoint needs. |
| 403 | `TOKEN_ROUTE` | This endpoint is not open to tokens at all. |
| 403 | `TOKEN_POLICY_OFF` | An org admin turned personal API tokens off. |
| 403 | `FORBIDDEN` | The token owner may not do this (same rule as the web app). |
| 404 | `NOT_FOUND` | Missing, or the owner cannot see it (the two look the same on purpose). |
| 409 | `ISSUE_CONFLICT` | Someone changed the field since you read it (`base` did not match). Re-read, then ask. |
| 429 | `RATE_LIMITED` | Too many writes: chat posts at most 30 per minute per token (webhooks: per bot), other writes (issues, comments, fields, sprints, groups, documents) at most 120 per minute per token. Reads are not limited. Wait `Retry-After` seconds, then send the rest. |
| 429 | `TOO_MANY_REQUESTS` | Another limit (e.g. too many @all mentions); wait `Retry-After` seconds if given. |

Every refusal body is `{"result":"error","msg":"…","code":"…"}`; `msg` is a Korean sentence you can show to a person.

## Endpoints

### `GET /api/hub/auth/me`

토큰 주인의 정보와 권한 · scope: any personal token

```sh
curl -H "Authorization: Bearer $ZENTA_TOKEN" "$ZENTA_URL/api/hub/auth/me"
```

### `GET /api/hub/projects`

볼 수 있는 프로젝트 목록 · scope: `issue:read`

```sh
curl -H "Authorization: Bearer $ZENTA_TOKEN" "$ZENTA_URL/api/hub/projects"
```

### `GET /api/hub/issues`

이슈 목록 · scope: `issue:read`

| Field | Where | Required | Description |
|---|---|---|---|
| `projectId` | query (주소 뒤 ?) |  | 프로젝트 번호 또는 키(예: ZEN). projectId · planId · mine · assigneeId 중 하나는 필수예요 |
| `planId` | query (주소 뒤 ?) |  | 계획 번호(그 계획에 든 프로젝트들의 이슈) |
| `mine` | query (주소 뒤 ?) |  | 1 이면 내가 담당한 이슈만 |
| `assigneeId` | query (주소 뒤 ?) |  | 이 사람이 담당한 이슈만(다른 범위와 함께 못 씀) |
| `search` | query (주소 뒤 ?) |  | 제목이나 이슈 키에 든 글자로 찾기 |
| `statusCategories` | query (주소 뒤 ?) |  | 상태 분류로 거르기(쉼표로 여럿): todo · doing · hold · done · closed |
| `statusIds` | query (주소 뒤 ?) |  | 상태 번호로 거르기(쉼표로 여럿) |
| `sort` | query (주소 뒤 ?) |  | 정렬(모르는 값은 400) |
| `dueFrom` | query (주소 뒤 ?) |  | 마감일 시작(YYYY-MM-DD) |
| `dueTo` | query (주소 뒤 ?) |  | 마감일 끝(YYYY-MM-DD) |
| `offset` | query (주소 뒤 ?) |  | 건너뛸 수 |
| `limit` | query (주소 뒤 ?) |  | 한 번에 받을 수(기본 50, 최대 200). 답의 hasMore 가 true 면 nextOffset 으로 이어 받아요 |

```sh
curl -H "Authorization: Bearer $ZENTA_TOKEN" "$ZENTA_URL/api/hub/issues?projectId=ZEN&limit=20"
```

### `GET /api/hub/issues/{taskId}`

이슈 하나(코멘트·상태·담당자 포함) · scope: `issue:read`

| Field | Where | Required | Description |
|---|---|---|---|
| `taskId` | path (주소 안) | yes | 이슈 키(예: ZEN-12) 또는 번호 |
| `projectId` | query (주소 뒤 ?) |  | 번호로 찾을 때는 프로젝트 번호나 키도 보내요(키로 찾으면 없어도 돼요) |

```sh
curl -H "Authorization: Bearer $ZENTA_TOKEN" "$ZENTA_URL/api/hub/issues/ZEN-12"
```

### `POST /api/hub/issues`

이슈 만들기(못 넣은 칸은 답의 partialFailures 에 그 까닭과 함께 적혀요) · scope: `issue:write`

| Field | Where | Required | Description |
|---|---|---|---|
| `projectId` | json (JSON 본문) | yes | 프로젝트 번호 또는 키(예: ZEN) |
| `title` | json (JSON 본문) | yes | 제목(300자까지) |
| `description` | json (JSON 본문) |  | 설명(마크다운, 50,000자까지) |
| `assigneeIds` | json (JSON 본문) |  | 담당자 번호 목록 |
| `priority` | json (JSON 본문) |  | 우선순위(0~4 정수) |
| `statusId` | json (JSON 본문) |  | 상태 번호(없으면 첫 상태) |
| `startDate` | json (JSON 본문) |  | 시작일(YYYY-MM-DD) |
| `dueDate` | json (JSON 본문) |  | 마감일(YYYY-MM-DD) |
| `parentId` | json (JSON 본문) |  | 상위 이슈 키나 번호(같은 프로젝트의 이슈여야 해요. 이 이슈를 그 아래 하위 이슈로 만들어요) |
| `typeId` | json (JSON 본문) |  | 이슈 유형 번호(GET /api/hub/fields/types) |
| `labelIds` | json (JSON 본문) |  | 라벨 번호 목록(GET /api/hub/labels) |
| `storyPoints` | json (JSON 본문) |  | 스토리 포인트(프로젝트 추정 방식이 스토리 포인트일 때) |
| `estimateMinutes` | json (JSON 본문) |  | 추정 시간(분, 프로젝트 추정 방식이 시간일 때) |

```sh
curl -H "Authorization: Bearer $ZENTA_TOKEN" -H "Content-Type: application/json" -d '{"projectId":"ZEN","title":"배포 실패 확인"}' "$ZENTA_URL/api/hub/issues"
```

### `POST /api/hub/issues/{taskId}`

이슈 고치기(보낸 칸만 바뀌어요) · scope: `issue:write`

| Field | Where | Required | Description |
|---|---|---|---|
| `taskId` | path (주소 안) | yes | 이슈 키(예: ZEN-12) 또는 번호 |
| `projectId` | json (JSON 본문) | yes | 그 이슈의 프로젝트 번호 또는 키 |
| `patch` | json (JSON 본문) | yes | 바꿀 칸만 담은 객체(예: {"title":"새 제목"}). 칸: title · description · status(상태 번호) · assignees(사람 번호 목록) · priority(0~4) · startDate · dueDate · labels(라벨 번호 목록, 통째로 바뀌고 빈 목록이면 다 떼요) · issueType(유형 번호, 빈 글자면 유형 없음) · storyPoints · estimateMinutes(둘 다 null 이면 추정 지우기) |
| `base` | json (JSON 본문) |  | 보고 있던 값(그사이 바뀌었으면 409) |

```sh
curl -H "Authorization: Bearer $ZENTA_TOKEN" -H "Content-Type: application/json" -d '{"projectId":"ZEN","patch":{"title":"새 제목"}}' "$ZENTA_URL/api/hub/issues/ZEN-12"
```

### `POST /api/hub/issues/{taskId}/comments`

이슈에 코멘트 달기 · scope: `issue:write`

| Field | Where | Required | Description |
|---|---|---|---|
| `taskId` | path (주소 안) | yes | 이슈 키(예: ZEN-12) 또는 번호 |
| `projectId` | json (JSON 본문) | yes | 그 이슈의 프로젝트 번호 또는 키 |
| `body` | json (JSON 본문) | yes | 코멘트(마크다운, 20,000자까지) |

```sh
curl -H "Authorization: Bearer $ZENTA_TOKEN" -H "Content-Type: application/json" -d '{"projectId":"ZEN","body":"배포 끝났어요"}' "$ZENTA_URL/api/hub/issues/ZEN-12/comments"
```

### `GET /api/hub/workflow/states`

프로젝트의 상태 목록(상태를 바꿀 때 쓸 번호) · scope: `issue:read`

| Field | Where | Required | Description |
|---|---|---|---|
| `projectId` | query (주소 뒤 ?) | yes | 프로젝트 번호 또는 키 |
| `issueType` | query (주소 뒤 ?) |  | 이 유형의 상태만(유형마다 상태가 다른 프로젝트) |

```sh
curl -H "Authorization: Bearer $ZENTA_TOKEN" "$ZENTA_URL/api/hub/workflow/states?projectId=ZEN"
```

### `POST /api/hub/workflow/can-transition`

이슈를 그 상태로 옮길 수 있는지 미리 보기(바꾸지는 않아요) · scope: `issue:read`

| Field | Where | Required | Description |
|---|---|---|---|
| `projectId` | json (JSON 본문) | yes | 프로젝트 번호 또는 키 |
| `toStateId` | json (JSON 본문) | yes | 옮길 상태 번호 |
| `issueIds` | json (JSON 본문) | yes | 이슈 키나 번호 목록 |

```sh
curl -H "Authorization: Bearer $ZENTA_TOKEN" -H "Content-Type: application/json" -d '{"projectId":"ZEN","toStateId":"123","issueIds":["ZEN-12"]}' "$ZENTA_URL/api/hub/workflow/can-transition"
```

### `GET /api/hub/fields/types`

프로젝트의 이슈 유형 목록 · scope: `issue:read`

| Field | Where | Required | Description |
|---|---|---|---|
| `projectId` | query (주소 뒤 ?) | yes | 프로젝트 번호 또는 키 |

```sh
curl -H "Authorization: Bearer $ZENTA_TOKEN" "$ZENTA_URL/api/hub/fields/types?projectId=ZEN"
```

### `GET /api/hub/fields/definitions`

프로젝트의 추가 정보 칸 목록 · scope: `issue:read`

| Field | Where | Required | Description |
|---|---|---|---|
| `projectId` | query (주소 뒤 ?) | yes | 프로젝트 번호 또는 키 |
| `issueTypeId` | query (주소 뒤 ?) |  | 이 유형에 붙는 필드만 |

```sh
curl -H "Authorization: Bearer $ZENTA_TOKEN" "$ZENTA_URL/api/hub/fields/definitions?projectId=ZEN"
```

### `GET /api/hub/fields/values/{taskId}`

이슈의 추가 정보 값 · scope: `issue:read`

| Field | Where | Required | Description |
|---|---|---|---|
| `taskId` | path (주소 안) | yes | 이슈 키(예: ZEN-12) 또는 번호 |
| `projectId` | query (주소 뒤 ?) |  | 번호로 찾을 때 프로젝트 번호나 키 |

```sh
curl -H "Authorization: Bearer $ZENTA_TOKEN" "$ZENTA_URL/api/hub/fields/values/ZEN-12"
```

### `POST /api/hub/fields/values/{taskId}`

이슈의 추가 정보 값 바꾸기 · scope: `issue:write`

| Field | Where | Required | Description |
|---|---|---|---|
| `taskId` | path (주소 안) | yes | 이슈 키(예: ZEN-12) 또는 번호 |
| `values` | json (JSON 본문) | yes | [{"fieldId":"필드 번호","value":값}] 목록 |
| `expected` | json (JSON 본문) |  | 보고 있던 값(같은 모양, 그사이 바뀌었으면 409) |

```sh
curl -H "Authorization: Bearer $ZENTA_TOKEN" -H "Content-Type: application/json" -d '{"values":[{"fieldId":"123","value":"높음"}]}' "$ZENTA_URL/api/hub/fields/values/ZEN-12"
```

### `GET /api/hub/users/search`

담당자로 고를 사람 찾기(화면의 사람 고르기와 같은 범위) · scope: `issue:read`

| Field | Where | Required | Description |
|---|---|---|---|
| `projectId` | query (주소 뒤 ?) | yes | 프로젝트 번호 또는 키(그 프로젝트에서 고를 수 있는 사람) |
| `q` | query (주소 뒤 ?) |  | 이름·부서 일부 |
| `members` | query (주소 뒤 ?) |  | true 면 프로젝트 구성원만(담당자를 고를 때 권해요) |
| `limit` | query (주소 뒤 ?) |  | 몇 명까지 |

```sh
curl -H "Authorization: Bearer $ZENTA_TOKEN" "$ZENTA_URL/api/hub/users/search?projectId=ZEN&q=김"
```

### `GET /api/hub/labels`

라벨 목록(이슈에 붙일 때 쓸 번호) · scope: `issue:read`

```sh
curl -H "Authorization: Bearer $ZENTA_TOKEN" "$ZENTA_URL/api/hub/labels"
```

### `GET /api/hub/sprints`

스프린트 목록(이슈를 담을 때 쓸 번호) · scope: `issue:read`

| Field | Where | Required | Description |
|---|---|---|---|
| `projectId` | query (주소 뒤 ?) |  | 프로젝트 번호 또는 키. projectId · planId 중 하나는 필수예요 |
| `planId` | query (주소 뒤 ?) |  | 계획 번호(그 계획에 든 프로젝트들의 스프린트) |

```sh
curl -H "Authorization: Bearer $ZENTA_TOKEN" "$ZENTA_URL/api/hub/sprints?projectId=ZEN"
```

### `POST /api/hub/sprints/{id}/issues`

이슈를 스프린트에 담기(다른 스프린트에 있던 이슈는 옮겨져요. 끝난 스프린트에는 못 담아요) · scope: `issue:write`

| Field | Where | Required | Description |
|---|---|---|---|
| `id` | path (주소 안) | yes | 스프린트 번호 |
| `projectId` | json (JSON 본문) | yes | 프로젝트 번호 또는 키 |
| `issueIds` | json (JSON 본문) | yes | 이슈 번호 목록(이슈를 읽어 받은 id 예요. 키는 안 돼요) |

```sh
curl -H "Authorization: Bearer $ZENTA_TOKEN" -H "Content-Type: application/json" -d '{"projectId":"ZEN","issueIds":["ISSUEID"]}' "$ZENTA_URL/api/hub/sprints/SPRINTID/issues"
```

### `DELETE /api/hub/sprints/{id}/issues/{issueId}`

이슈를 스프린트에서 빼기(이슈는 그대로예요. 끝난 스프린트에서는 못 빼요) · scope: `issue:write`

| Field | Where | Required | Description |
|---|---|---|---|
| `id` | path (주소 안) | yes | 스프린트 번호 |
| `issueId` | path (주소 안) | yes | 이슈 키(예: ZEN-12) 또는 번호 |
| `projectId` | query (주소 뒤 ?) | yes | 프로젝트 번호 또는 키 |

```sh
curl -H "Authorization: Bearer $ZENTA_TOKEN" -X DELETE "$ZENTA_URL/api/hub/sprints/SPRINTID/issues/ZEN-12?projectId=ZEN"
```

### `GET /api/hub/issue-groups`

프로젝트의 이슈 그룹 목록 · scope: `issue:read`

| Field | Where | Required | Description |
|---|---|---|---|
| `projectId` | query (주소 뒤 ?) | yes | 프로젝트 번호 또는 키 |

```sh
curl -H "Authorization: Bearer $ZENTA_TOKEN" "$ZENTA_URL/api/hub/issue-groups?projectId=ZEN"
```

### `POST /api/hub/issue-groups/{groupId}/issues`

이슈를 그룹으로 옮기기(답의 moved 가 옮긴 수예요. 볼 수 없거나 다른 프로젝트의 이슈는 건너뛰어요) · scope: `issue:write`

| Field | Where | Required | Description |
|---|---|---|---|
| `groupId` | path (주소 안) | yes | 그룹 번호(목록의 id). none 이면 그룹에서 빼요 |
| `projectId` | query (주소 뒤 ?) | yes | 프로젝트 번호 또는 키 |
| `issueIds` | json (JSON 본문) | yes | 이슈 번호 목록(이슈를 읽어 받은 id 예요. 키는 안 돼요) |

```sh
curl -H "Authorization: Bearer $ZENTA_TOKEN" -H "Content-Type: application/json" -d '{"issueIds":["ISSUEID"]}' "$ZENTA_URL/api/hub/issue-groups/GROUPID/issues?projectId=ZEN"
```

### `GET /api/hub/issues/{id}/subtasks`

이슈의 하위 이슈 목록(줄마다 그 아래 하위가 children 에 담겨요) · scope: `issue:read`

| Field | Where | Required | Description |
|---|---|---|---|
| `id` | path (주소 안) | yes | 이슈 키(예: ZEN-12) 또는 번호 |
| `projectId` | query (주소 뒤 ?) | yes | 그 이슈의 프로젝트 번호 또는 키 |

```sh
curl -H "Authorization: Bearer $ZENTA_TOKEN" "$ZENTA_URL/api/hub/issues/ZEN-12/subtasks?projectId=ZEN"
```

### `POST /api/hub/issues/{id}/subtasks`

이미 있는 이슈를 하위 이슈로 잇기(다른 상위 아래 있었으면 옮겨져요. 새로 만들려면 이슈 만들기의 parentId) · scope: `issue:write`

| Field | Where | Required | Description |
|---|---|---|---|
| `id` | path (주소 안) | yes | 상위가 될 이슈 키(예: ZEN-12) 또는 번호 |
| `projectId` | json (JSON 본문) | yes | 그 이슈의 프로젝트 번호 또는 키 |
| `childId` | json (JSON 본문) | yes | 하위로 넣을 이슈 키 또는 번호 |

```sh
curl -H "Authorization: Bearer $ZENTA_TOKEN" -H "Content-Type: application/json" -d '{"projectId":"ZEN","childId":"ZEN-13"}' "$ZENTA_URL/api/hub/issues/ZEN-12/subtasks"
```

### `DELETE /api/hub/issues/{id}/subtasks/{childId}`

하위 이슈를 상위에서 끊기(두 이슈는 그대로 남아요. 그 상위의 하위가 아니면 404) · scope: `issue:write`

| Field | Where | Required | Description |
|---|---|---|---|
| `id` | path (주소 안) | yes | 상위 이슈 키(예: ZEN-12) 또는 번호 |
| `childId` | path (주소 안) | yes | 끊을 하위 이슈 키 또는 번호 |
| `projectId` | query (주소 뒤 ?) | yes | 그 이슈의 프로젝트 번호 또는 키 |

```sh
curl -H "Authorization: Bearer $ZENTA_TOKEN" -X DELETE "$ZENTA_URL/api/hub/issues/ZEN-12/subtasks/ZEN-13?projectId=ZEN"
```

### `GET /api/hub/releases`

릴리스 목록(이슈를 담을 때 쓸 번호) · scope: `issue:read`

| Field | Where | Required | Description |
|---|---|---|---|
| `projectId` | query (주소 뒤 ?) |  | 프로젝트 번호 또는 키. projectId · planId 중 하나는 필수예요 |
| `planId` | query (주소 뒤 ?) |  | 계획 번호(그 계획에 든 프로젝트들의 릴리스) |

```sh
curl -H "Authorization: Bearer $ZENTA_TOKEN" "$ZENTA_URL/api/hub/releases?projectId=ZEN"
```

### `GET /api/hub/releases/{id}/issues`

릴리스에 담긴 이슈 목록 · scope: `issue:read`

| Field | Where | Required | Description |
|---|---|---|---|
| `id` | path (주소 안) | yes | 릴리스 번호 |
| `projectId` | query (주소 뒤 ?) | yes | 프로젝트 번호 또는 키 |

```sh
curl -H "Authorization: Bearer $ZENTA_TOKEN" "$ZENTA_URL/api/hub/releases/RELEASEID/issues?projectId=ZEN"
```

### `POST /api/hub/releases/{id}/issues`

이슈를 릴리스에 담기(다른 릴리스에 있던 이슈는 옮겨져요. 출시한 릴리스에는 못 담아요) · scope: `issue:write`

| Field | Where | Required | Description |
|---|---|---|---|
| `id` | path (주소 안) | yes | 릴리스 번호 |
| `projectId` | query (주소 뒤 ?) | yes | 프로젝트 번호 또는 키 |
| `issueIds` | json (JSON 본문) | yes | 이슈 번호 목록(이슈를 읽어 받은 id 예요. 키는 안 돼요) |

```sh
curl -H "Authorization: Bearer $ZENTA_TOKEN" -H "Content-Type: application/json" -d '{"issueIds":["ISSUEID"]}' "$ZENTA_URL/api/hub/releases/RELEASEID/issues?projectId=ZEN"
```

### `GET /api/hub/milestones`

마일스톤 목록(이슈를 담을 때 쓸 번호) · scope: `issue:read`

| Field | Where | Required | Description |
|---|---|---|---|
| `projectId` | query (주소 뒤 ?) | yes | 프로젝트 번호 또는 키 |

```sh
curl -H "Authorization: Bearer $ZENTA_TOKEN" "$ZENTA_URL/api/hub/milestones?projectId=ZEN"
```

### `GET /api/hub/milestones/{id}/issues`

마일스톤에 담긴 이슈 목록 · scope: `issue:read`

| Field | Where | Required | Description |
|---|---|---|---|
| `id` | path (주소 안) | yes | 마일스톤 번호 |
| `projectId` | query (주소 뒤 ?) | yes | 프로젝트 번호 또는 키 |
| `cursor` | query (주소 뒤 ?) |  | 다음 쪽(앞 답의 nextCursor) |
| `limit` | query (주소 뒤 ?) |  | 한 번에 몇 건(기본 50, 200까지) |

```sh
curl -H "Authorization: Bearer $ZENTA_TOKEN" "$ZENTA_URL/api/hub/milestones/MILESTONEID/issues?projectId=ZEN"
```

### `POST /api/hub/milestones/{id}/issues`

이슈를 마일스톤에 담기(한 번에 하나) · scope: `issue:write`

| Field | Where | Required | Description |
|---|---|---|---|
| `id` | path (주소 안) | yes | 마일스톤 번호 |
| `projectId` | query (주소 뒤 ?) | yes | 프로젝트 번호 또는 키 |
| `issueId` | json (JSON 본문) | yes | 이슈 키(예: ZEN-12) 또는 번호 |

```sh
curl -H "Authorization: Bearer $ZENTA_TOKEN" -H "Content-Type: application/json" -d '{"issueId":"ZEN-12"}' "$ZENTA_URL/api/hub/milestones/MILESTONEID/issues?projectId=ZEN"
```

### `GET /api/hub/issues/{taskId}/relations`

이슈의 관계 목록(관련 · 막음 · 중복 · 복제) · scope: `issue:read`

| Field | Where | Required | Description |
|---|---|---|---|
| `taskId` | path (주소 안) | yes | 이슈 키(예: ZEN-12) 또는 번호 |
| `projectId` | query (주소 뒤 ?) | yes | 그 이슈의 프로젝트 번호 또는 키 |

```sh
curl -H "Authorization: Bearer $ZENTA_TOKEN" "$ZENTA_URL/api/hub/issues/ZEN-12/relations?projectId=ZEN"
```

### `POST /api/hub/issues/{taskId}/relations`

두 이슈 사이에 관계 맺기(상대 이슈에도 짝 관계가 생겨요) · scope: `issue:write`

| Field | Where | Required | Description |
|---|---|---|---|
| `taskId` | path (주소 안) | yes | 이슈 키(예: ZEN-12) 또는 번호 |
| `projectId` | json (JSON 본문) | yes | 그 이슈의 프로젝트 번호 또는 키 |
| `otherId` | json (JSON 본문) | yes | 상대 이슈 키 또는 번호 |
| `kind` | json (JSON 본문) | yes | 관계 종류: related(관련) · blocking(이 이슈가 상대를 막음) · blocked(상대에게 막힘) · duplicating(이 이슈가 상대의 중복) · duplicated · cloning · cloned |

```sh
curl -H "Authorization: Bearer $ZENTA_TOKEN" -H "Content-Type: application/json" -d '{"projectId":"ZEN","otherId":"ZEN-13","kind":"blocking"}' "$ZENTA_URL/api/hub/issues/ZEN-12/relations"
```

### `GET /api/hub/timelogs`

이슈의 시간 기록 목록 · scope: `issue:read`

| Field | Where | Required | Description |
|---|---|---|---|
| `issueId` | query (주소 뒤 ?) | yes | 이슈 키(예: ZEN-12) 또는 번호 |

```sh
curl -H "Authorization: Bearer $ZENTA_TOKEN" "$ZENTA_URL/api/hub/timelogs?issueId=ZEN-12"
```

### `POST /api/hub/timelogs`

이슈에 시간 기록 적기(토큰 주인의 기록으로 남아요) · scope: `issue:write`

| Field | Where | Required | Description |
|---|---|---|---|
| `issueId` | json (JSON 본문) | yes | 이슈 키(예: ZEN-12) 또는 번호 |
| `minutes` | json (JSON 본문) | yes | 걸린 시간(분, 1분부터 24시간까지) |
| `workedOn` | json (JSON 본문) |  | 일한 날(YYYY-MM-DD). 비우면 오늘이에요 |
| `note` | json (JSON 본문) |  | 한 일(짧게) |
| `userId` | json (JSON 본문) |  | 조직 관리자만: 이 사람의 기록으로 적어요(사람 번호) |

```sh
curl -H "Authorization: Bearer $ZENTA_TOKEN" -H "Content-Type: application/json" -d '{"issueId":"ZEN-12","minutes":90,"note":"배포 스크립트 점검"}' "$ZENTA_URL/api/hub/timelogs"
```

### `PATCH /api/hub/timelogs/{id}`

시간 기록 고치기(세 칸이 통째로 바뀌어요. 남의 기록은 조직 관리자만 고쳐요) · scope: `issue:write`

| Field | Where | Required | Description |
|---|---|---|---|
| `id` | path (주소 안) | yes | 시간 기록 번호 |
| `minutes` | json (JSON 본문) | yes | 걸린 시간(분, 1분부터 24시간까지) |
| `workedOn` | json (JSON 본문) |  | 일한 날(YYYY-MM-DD). 안 보내면 오늘로 바뀌어요 |
| `note` | json (JSON 본문) |  | 한 일. 안 보내면 지워져요 |

```sh
curl -H "Authorization: Bearer $ZENTA_TOKEN" -X PATCH -H "Content-Type: application/json" -d '{"minutes":120,"workedOn":"2026-11-13","note":"배포 스크립트 점검"}' "$ZENTA_URL/api/hub/timelogs/TIMELOGID"
```

### `GET /api/hub/issues/attachments/policy`

올릴 수 있는 파일 크기와 확장자 · scope: `issue:read`

```sh
curl -H "Authorization: Bearer $ZENTA_TOKEN" "$ZENTA_URL/api/hub/issues/attachments/policy"
```

### `GET /api/hub/issues/{taskId}/attachments`

이슈의 첨부 목록(줄마다 이름 name · 크기 size · 내려받을 때 쓸 publicId 가 있어요) · scope: `issue:read`

| Field | Where | Required | Description |
|---|---|---|---|
| `taskId` | path (주소 안) | yes | 이슈 키(예: ZEN-12) 또는 번호 |

```sh
curl -H "Authorization: Bearer $ZENTA_TOKEN" "$ZENTA_URL/api/hub/issues/ZEN-12/attachments"
```

### `GET /api/hub/issues/{taskId}/attachments/{id}/download`

첨부 내려받기(파일 내용이 그대로 와요. 307 이면 넘겨 준 주소에서 받아요) · scope: `issue:read`

| Field | Where | Required | Description |
|---|---|---|---|
| `taskId` | path (주소 안) | yes | 이슈 키(예: ZEN-12) 또는 번호 |
| `id` | path (주소 안) | yes | 첨부의 publicId(목록에서 받아요) |

```sh
curl -H "Authorization: Bearer $ZENTA_TOKEN" -L -o 받은파일 "$ZENTA_URL/api/hub/issues/ZEN-12/attachments/PUBLICID/download"
```

### `POST /api/hub/issues/{taskId}/attachments`

이슈에 파일 올리기(multipart/form-data, 한 번에 하나) · scope: `issue:write`

| Field | Where | Required | Description |
|---|---|---|---|
| `taskId` | path (주소 안) | yes | 이슈 키(예: ZEN-12) 또는 번호 |
| `file` | form (폼 본문) | yes | 올릴 파일(multipart 의 file 칸). 크기·확장자는 정책을 따라요 |

```sh
curl -H "Authorization: Bearer $ZENTA_TOKEN" -F "file=@보고서.pdf" "$ZENTA_URL/api/hub/issues/ZEN-12/attachments"
```

### `GET /api/v1/streams`

내가 든 채널 목록 · scope: `chat:read`

```sh
curl -H "Authorization: Bearer $ZENTA_TOKEN" "$ZENTA_URL/api/v1/streams"
```

### `GET /api/v1/messages`

채널·대화의 메시지 읽기 · scope: `chat:read`

| Field | Where | Required | Description |
|---|---|---|---|
| `narrow` | query (주소 뒤 ?) |  | JSON 배열(예: [{"operator":"stream","operand":"배포알림"}]) |
| `anchor` | query (주소 뒤 ?) |  | 어디서부터(newest · oldest · 메시지 번호) |
| `num_before` | query (주소 뒤 ?) |  | anchor 앞으로 몇 개 |
| `num_after` | query (주소 뒤 ?) |  | anchor 뒤로 몇 개 |

```sh
curl -H "Authorization: Bearer $ZENTA_TOKEN" -G --data-urlencode 'narrow=[{"operator":"stream","operand":"배포알림"}]' "$ZENTA_URL/api/v1/messages"
```

### `POST /api/v1/messages`

채널에 메시지 보내기(토큰 하나에 1분 30개까지, 봇 토큰은 봇이 든 채널에만) · scope: `chat:write`

| Field | Where | Required | Description |
|---|---|---|---|
| `to` | form (폼 본문) | yes | 채널 번호 또는 이름 |
| `content` | form (폼 본문) | yes | 보낼 글(마크다운, 10,000자까지) |
| `parent_id` | form (폼 본문) |  | 답글을 달 메시지 번호 |

```sh
curl -H "Authorization: Bearer $ZENTA_TOKEN" --data-urlencode "to=배포알림" --data-urlencode "content=배포가 끝났어요" "$ZENTA_URL/api/v1/messages"
```

### `GET /api/v1/messages/{id}/replies`

메시지에 달린 답글 읽기 · scope: `chat:read`

| Field | Where | Required | Description |
|---|---|---|---|
| `id` | path (주소 안) | yes | 답글이 달린 메시지 번호 |
| `num_before` | query (주소 뒤 ?) |  | 한 번에 몇 개(기본 50, 1,000까지) |
| `after` | query (주소 뒤 ?) |  | 이 번호 뒤의 답글부터(이어 읽기) |

```sh
curl -H "Authorization: Bearer $ZENTA_TOKEN" "$ZENTA_URL/api/v1/messages/MESSAGEID/replies"
```

### `GET /api/v1/messages/{id}/reactions`

메시지에 달린 반응과 누른 사람 · scope: `chat:read`

| Field | Where | Required | Description |
|---|---|---|---|
| `id` | path (주소 안) | yes | 메시지 번호 |

```sh
curl -H "Authorization: Bearer $ZENTA_TOKEN" "$ZENTA_URL/api/v1/messages/MESSAGEID/reactions"
```

### `POST /api/v1/messages/{id}/reactions`

메시지에 반응 달기(같은 반응을 또 달아도 하나예요) · scope: `chat:write`

| Field | Where | Required | Description |
|---|---|---|---|
| `id` | path (주소 안) | yes | 메시지 번호 |
| `emoji_name` | form (폼 본문) | yes | 이모지 이름(예: +1 · check · eyes · tada). 전체 이름은 GET /api/v1/emoji 에 있어요 |

```sh
curl -H "Authorization: Bearer $ZENTA_TOKEN" --data-urlencode "emoji_name=+1" "$ZENTA_URL/api/v1/messages/MESSAGEID/reactions"
```

### `DELETE /api/v1/messages/{id}/reactions`

내가 단 반응 빼기(남이 단 반응은 못 빼요) · scope: `chat:write`

| Field | Where | Required | Description |
|---|---|---|---|
| `id` | path (주소 안) | yes | 메시지 번호 |
| `emoji_name` | query (주소 뒤 ?) | yes | 뺄 이모지 이름(달 때 쓴 이름) |

```sh
curl -H "Authorization: Bearer $ZENTA_TOKEN" -X DELETE -G --data-urlencode "emoji_name=+1" "$ZENTA_URL/api/v1/messages/MESSAGEID/reactions"
```

### `GET /api/v1/emoji`

반응에 쓸 수 있는 이모지 이름 목록(3천 개쯤이라 답이 커요) · scope: `chat:read`

```sh
curl -H "Authorization: Bearer $ZENTA_TOKEN" "$ZENTA_URL/api/v1/emoji"
```

### `GET /api/hub/notifications`

알림함 읽기(source 로 고른 곳의 읽기 권한이 있어야 해요) · scope: any personal token

| Field | Where | Required | Description |
|---|---|---|---|
| `source` | query (주소 뒤 ?) | yes | board(이슈 알림, issue:read) · doc(문서 알림, doc:read) · chat(채팅 알림, chat:read) 중 하나 |
| `unread` | query (주소 뒤 ?) |  | 1 이면 안 읽은 것만 |
| `limit` | query (주소 뒤 ?) |  | 한 번에 몇 개(기본 20, 100까지) |
| `offset` | query (주소 뒤 ?) |  | 몇 개를 건너뛰고(이어 읽기) |

```sh
curl -H "Authorization: Bearer $ZENTA_TOKEN" "$ZENTA_URL/api/hub/notifications?source=board&unread=1"
```

### `POST /api/hub/notifications/{id}/read`

알림 하나를 읽음으로(source 로 고른 곳의 쓰기 권한이 있어야 해요) · scope: any personal token

| Field | Where | Required | Description |
|---|---|---|---|
| `id` | path (주소 안) | yes | 알림 번호(알림함 읽기의 id) |
| `source` | query (주소 뒤 ?) | yes | 그 알림을 읽은 곳과 같은 값. board(issue:write) · doc(doc:write) · chat(chat:write) 중 하나 |

```sh
curl -H "Authorization: Bearer $ZENTA_TOKEN" -X POST "$ZENTA_URL/api/hub/notifications/NOTICEID/read?source=board"
```

### `GET /api/hub/wiki`

문서 목차(트리) · scope: `doc:read`

| Field | Where | Required | Description |
|---|---|---|---|
| `projectId` | query (주소 뒤 ?) |  | 프로젝트 번호 또는 키. projectId · scope 중 하나는 필수예요 |
| `scope` | query (주소 뒤 ?) |  | org 면 회사 문서, all 이면 볼 수 있는 모든 문서 |
| `parent` | query (주소 뒤 ?) |  | 이 문서 바로 아래만(번호) |

```sh
curl -H "Authorization: Bearer $ZENTA_TOKEN" "$ZENTA_URL/api/hub/wiki?projectId=ZEN"
```

### `GET /api/hub/wiki/search`

문서 찾기 · scope: `doc:read`

| Field | Where | Required | Description |
|---|---|---|---|
| `q` | query (주소 뒤 ?) | yes | 찾을 말 |
| `projectId` | query (주소 뒤 ?) |  | 프로젝트 번호 또는 키. projectId · scope 중 하나는 필수예요 |
| `scope` | query (주소 뒤 ?) |  | org 면 회사 문서, all 이면 볼 수 있는 모든 문서 |

```sh
curl -H "Authorization: Bearer $ZENTA_TOKEN" "$ZENTA_URL/api/hub/wiki/search?scope=all&q=온보딩"
```

### `GET /api/hub/wiki/{id}`

문서 하나(본문 마크다운 body · 판 번호 revision 포함) · scope: `doc:read`

| Field | Where | Required | Description |
|---|---|---|---|
| `id` | path (주소 안) | yes | 문서 번호 |
| `projectId` | query (주소 뒤 ?) |  | 프로젝트 문서면 프로젝트 번호나 키(회사 문서면 scope=org) |
| `scope` | query (주소 뒤 ?) |  | 회사 문서면 org |

```sh
curl -H "Authorization: Bearer $ZENTA_TOKEN" "$ZENTA_URL/api/hub/wiki/DOCID?projectId=ZEN"
```

### `POST /api/hub/wiki`

문서 만들기(본문은 doc 트리로 보내요. body 만 보내면 거절돼요) · scope: `doc:write`

| Field | Where | Required | Description |
|---|---|---|---|
| `projectId` | json (JSON 본문) |  | 프로젝트 번호 또는 키(회사 문서면 빼고 scope 를 org 로) |
| `scope` | json (JSON 본문) |  | 회사 문서면 org |
| `title` | json (JSON 본문) | yes | 제목(200자까지) |
| `doc` | json (JSON 본문) | yes | 문서 내용 트리이고 없으면 문서 내용이 비었다며 거절돼요. 가장 작은 모양은 {"v":1,"eol":false,"blocks":[{"id":"b1","kind":"paragraph","spans":[{"kind":"text","text":"글"}]}]} 이고(블록 id 는 비지 않고 겹치지 않게) 스킬 도우미(zenta.mjs)의 --markdown 이 마크다운에서 만들어 줘요 |
| `body` | json (JSON 본문) |  | doc 과 같은 내용의 마크다운(200,000자까지, 검색·판 비교에 써요). doc 만 바꾸고 body 를 안 맞추면 검색이 틀어져요 |
| `parentId` | json (JSON 본문) |  | 이 문서 아래에 만들기(번호) |

```sh
curl -H "Authorization: Bearer $ZENTA_TOKEN" -H "Content-Type: application/json" -d '{"projectId":"ZEN","title":"배포 절차","doc":{"v":1,"eol":false,"blocks":[{"id":"b1","kind":"paragraph","spans":[{"kind":"text","text":"빌드한 뒤 배포해요"}]}]},"body":"빌드한 뒤 배포해요"}' "$ZENTA_URL/api/hub/wiki"
```

### `PUT /api/hub/wiki/{id}`

문서 고치기(doc 트리를 통째로 보내요 · 보낸 revision 이 지금 판이 아니면 409) · scope: `doc:write`

| Field | Where | Required | Description |
|---|---|---|---|
| `id` | path (주소 안) | yes | 문서 번호 |
| `projectId` | json (JSON 본문) |  | 프로젝트 문서면 프로젝트 번호나 키(회사 문서면 scope 를 org 로) |
| `scope` | json (JSON 본문) |  | 회사 문서면 org |
| `title` | json (JSON 본문) | yes | 제목(200자까지) |
| `doc` | json (JSON 본문) | yes | 바꾼 뒤의 문서 내용 전체 트리로 통째로 바뀌니, 덧붙이려면 읽은 doc.blocks 뒤에 블록을 더해 보내요(없으면 거절돼요). 가장 작은 모양은 {"v":1,"eol":false,"blocks":[{"id":"b1","kind":"paragraph","spans":[{"kind":"text","text":"글"}]}]} 이고(블록 id 는 비지 않고 겹치지 않게) 스킬 도우미(zenta.mjs)의 --markdown 이 마크다운에서 만들어 줘요 |
| `body` | json (JSON 본문) | yes | doc 과 같은 내용의 마크다운 전체(200,000자까지, 검색·판 비교에 써요) |
| `revision` | json (JSON 본문) | yes | 읽을 때 받은 판 번호 |

```sh
curl -H "Authorization: Bearer $ZENTA_TOKEN" -X PUT -H "Content-Type: application/json" -d '{"projectId":"ZEN","title":"배포 절차","doc":{"v":1,"eol":false,"blocks":[{"id":"b1","kind":"paragraph","spans":[{"kind":"text","text":"빌드한 뒤 배포해요"}]}]},"body":"빌드한 뒤 배포해요","revision":3}' "$ZENTA_URL/api/hub/wiki/DOCID"
```

### `POST /api/hub/wiki/{id}/move`

문서 옮기기(다른 문서 아래로·다른 프로젝트로) · scope: `doc:write`

| Field | Where | Required | Description |
|---|---|---|---|
| `id` | path (주소 안) | yes | 문서 번호 |
| `projectId` | query (주소 뒤 ?) |  | 지금 있는 프로젝트 번호나 키(회사 문서면 scope=org) |
| `scope` | query (주소 뒤 ?) |  | 지금 회사 문서면 org |
| `toProjectId` | json (JSON 본문) |  | 옮겨 갈 프로젝트 번호나 키(같은 프로젝트 안에서 옮겨도 보내요. 회사 문서면 toScope) |
| `toScope` | json (JSON 본문) |  | 회사 문서로 옮기면 org |
| `parentId` | json (JSON 본문) |  | 옮겨 갈 위 문서 번호(맨 위면 빼요) |

```sh
curl -H "Authorization: Bearer $ZENTA_TOKEN" -H "Content-Type: application/json" -d '{"toProjectId":"ZEN","parentId":"PARENTID"}' "$ZENTA_URL/api/hub/wiki/DOCID/move?projectId=ZEN"
```
