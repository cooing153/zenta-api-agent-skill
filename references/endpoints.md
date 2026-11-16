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
| `approval:decide` | 결재 승인·반려 |

An endpoint with no scope works with any personal token. On a few endpoints the scope depends on one parameter (the inbox's `source`, search's `kind`): the endpoint lists which value needs which scope, and that parameter must be sent with exactly one of those values. A bot token opens `POST /api/v1/messages` only.

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
| `groupId` | json (JSON 본문) |  | 넣을 이슈 그룹 번호(그룹 목록의 id). 못 넣으면 partialFailures 에 적혀요 |
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

### `GET /api/hub/issues/{id}/tree`

이슈와 그 아래 하위 이슈 전체(나무 한 그루) · scope: `issue:read`

| Field | Where | Required | Description |
|---|---|---|---|
| `id` | path (주소 안) | yes | 이슈 키(예: ZEN-12) 또는 번호 |
| `projectId` | query (주소 뒤 ?) | yes | 그 이슈의 프로젝트 번호 또는 키 |

```sh
curl -H "Authorization: Bearer $ZENTA_TOKEN" "$ZENTA_URL/api/hub/issues/ZEN-12/tree?projectId=ZEN"
```

### `GET /api/hub/issues/{id}/ancestors`

이슈의 상위 이슈들(바로 위 상위부터) · scope: `issue:read`

| Field | Where | Required | Description |
|---|---|---|---|
| `id` | path (주소 안) | yes | 이슈 키(예: ZEN-12) 또는 번호 |
| `projectId` | query (주소 뒤 ?) | yes | 그 이슈의 프로젝트 번호 또는 키 |

```sh
curl -H "Authorization: Bearer $ZENTA_TOKEN" "$ZENTA_URL/api/hub/issues/ZEN-12/ancestors?projectId=ZEN"
```

### `POST /api/hub/issues/{taskId}/comments/{commentId}/reactions`

이슈 코멘트에 반응 달기(이미 달았으면 그대로예요) · scope: `issue:write`

| Field | Where | Required | Description |
|---|---|---|---|
| `taskId` | path (주소 안) | yes | 이슈 키(예: ZEN-12) 또는 번호 |
| `commentId` | path (주소 안) | yes | 코멘트 번호 |
| `projectId` | json (JSON 본문) | yes | 프로젝트 번호 또는 키 |
| `emoji` | json (JSON 본문) | yes | check · +1 · eyes 중 하나 |

```sh
curl -H "Authorization: Bearer $ZENTA_TOKEN" -H "Content-Type: application/json" -d '{"projectId":"ZEN","emoji":"check"}' "$ZENTA_URL/api/hub/issues/ZEN-12/comments/123/reactions"
```

### `DELETE /api/hub/issues/{taskId}/comments/{commentId}/reactions`

이슈 코멘트에서 내 반응 빼기(코멘트는 그대로 남아요) · scope: `issue:write`

| Field | Where | Required | Description |
|---|---|---|---|
| `taskId` | path (주소 안) | yes | 이슈 키(예: ZEN-12) 또는 번호 |
| `commentId` | path (주소 안) | yes | 코멘트 번호 |
| `projectId` | query (주소 뒤 ?) | yes | 프로젝트 번호 또는 키 |
| `emoji` | query (주소 뒤 ?) | yes | check · +1 · eyes 중 하나 |

```sh
curl -H "Authorization: Bearer $ZENTA_TOKEN" -X DELETE "$ZENTA_URL/api/hub/issues/ZEN-12/comments/123/reactions?projectId=ZEN&emoji=check"
```

### `GET /api/hub/issues/recent`

내가 최근에 본 이슈 · scope: `issue:read`

| Field | Where | Required | Description |
|---|---|---|---|
| `limit` | query (주소 뒤 ?) |  | 몇 개(기본 10, 20까지) |

```sh
curl -H "Authorization: Bearer $ZENTA_TOKEN" "$ZENTA_URL/api/hub/issues/recent"
```

### `GET /api/hub/issues/deleted`

휴지통의 이슈 목록(지운 지 얼마 안 된 것부터) · scope: `issue:read`

| Field | Where | Required | Description |
|---|---|---|---|
| `projectId` | query (주소 뒤 ?) | yes | 프로젝트 번호 또는 키 |
| `cursor` | query (주소 뒤 ?) |  | 이어 읽을 자리(앞 답의 nextCursor) |
| `limit` | query (주소 뒤 ?) |  | 한 번에 몇 개(기본 50, 100까지) |

```sh
curl -H "Authorization: Bearer $ZENTA_TOKEN" "$ZENTA_URL/api/hub/issues/deleted?projectId=ZEN"
```

### `POST /api/hub/issues/{taskId}/restore`

휴지통의 이슈 되살리기(이슈를 지울 수 있는 사람만) · scope: `issue:write`

| Field | Where | Required | Description |
|---|---|---|---|
| `taskId` | path (주소 안) | yes | 이슈 키(예: ZEN-12) 또는 번호 |
| `projectId` | query (주소 뒤 ?) | yes | 프로젝트 번호 또는 키 |

```sh
curl -H "Authorization: Bearer $ZENTA_TOKEN" -X POST "$ZENTA_URL/api/hub/issues/ZEN-12/restore?projectId=ZEN"
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

### `POST /api/hub/issue-groups`

이슈 그룹 만들기(한 프로젝트에 50개까지) · scope: `issue:write`

| Field | Where | Required | Description |
|---|---|---|---|
| `projectId` | query (주소 뒤 ?) | yes | 프로젝트 번호 또는 키 |
| `name` | json (JSON 본문) | yes | 그룹 이름 |
| `color` | json (JSON 본문) |  | gray · blue · green · amber · red · violet 중 하나. 빼면 gray 예요 |

```sh
curl -H "Authorization: Bearer $ZENTA_TOKEN" -H "Content-Type: application/json" -d '{"name":"백엔드","color":"blue"}' "$ZENTA_URL/api/hub/issue-groups?projectId=ZEN"
```

### `PATCH /api/hub/issue-groups/{groupId}`

이슈 그룹 이름·색 바꾸기(보낸 칸만 바뀌어요) · scope: `issue:write`

| Field | Where | Required | Description |
|---|---|---|---|
| `groupId` | path (주소 안) | yes | 그룹 번호(그룹 목록의 id) |
| `projectId` | query (주소 뒤 ?) | yes | 프로젝트 번호 또는 키 |
| `name` | json (JSON 본문) |  | 새 이름 |
| `color` | json (JSON 본문) |  | gray · blue · green · amber · red · violet 중 하나 |

```sh
curl -H "Authorization: Bearer $ZENTA_TOKEN" -X PATCH -H "Content-Type: application/json" -d '{"name":"서버"}' "$ZENTA_URL/api/hub/issue-groups/GROUPID?projectId=ZEN"
```

### `PUT /api/hub/issue-groups/order`

이슈 그룹 순서 바꾸기 · scope: `issue:write`

| Field | Where | Required | Description |
|---|---|---|---|
| `projectId` | query (주소 뒤 ?) | yes | 프로젝트 번호 또는 키 |
| `order` | json (JSON 본문) | yes | 그 프로젝트의 그룹 번호 전부를 새 순서대로 |

```sh
curl -H "Authorization: Bearer $ZENTA_TOKEN" -X PUT -H "Content-Type: application/json" -d '{"order":["GROUPID2","GROUPID1"]}' "$ZENTA_URL/api/hub/issue-groups/order?projectId=ZEN"
```

### `GET /api/hub/issue-groups/{groupId}/issues`

그룹에 든 이슈 번호 목록 · scope: `issue:read`

| Field | Where | Required | Description |
|---|---|---|---|
| `groupId` | path (주소 안) | yes | 그룹 번호(그룹 목록의 id) |
| `projectId` | query (주소 뒤 ?) | yes | 프로젝트 번호 또는 키 |

```sh
curl -H "Authorization: Bearer $ZENTA_TOKEN" "$ZENTA_URL/api/hub/issue-groups/GROUPID/issues?projectId=ZEN"
```

### `POST /api/hub/labels`

라벨 만들기(조직 관리자만 돼요) · scope: `issue:write`

| Field | Where | Required | Description |
|---|---|---|---|
| `name` | json (JSON 본문) | yes | 라벨 이름 |
| `color` | json (JSON 본문) |  | 색(#rrggbb) |

```sh
curl -H "Authorization: Bearer $ZENTA_TOKEN" -H "Content-Type: application/json" -d '{"name":"긴급","color":"#d92d20"}' "$ZENTA_URL/api/hub/labels"
```

### `POST /api/hub/labels/{id}`

라벨 이름·색 바꾸기(조직 관리자만, 보낸 칸만 바뀌어요) · scope: `issue:write`

| Field | Where | Required | Description |
|---|---|---|---|
| `id` | path (주소 안) | yes | 라벨 번호 |
| `name` | json (JSON 본문) |  | 새 이름 |
| `color` | json (JSON 본문) |  | 색(#rrggbb) |

```sh
curl -H "Authorization: Bearer $ZENTA_TOKEN" -H "Content-Type: application/json" -d '{"name":"아주 긴급"}' "$ZENTA_URL/api/hub/labels/LABELID"
```

### `POST /api/hub/sprints`

스프린트 만들기 · scope: `issue:write`

| Field | Where | Required | Description |
|---|---|---|---|
| `projectId` | json (JSON 본문) | yes | 프로젝트 번호 또는 키 |
| `name` | json (JSON 본문) | yes | 스프린트 이름 |
| `startsAt` | json (JSON 본문) | yes | 시작일(YYYY-MM-DD) |
| `endsAt` | json (JSON 본문) | yes | 끝나는 날(YYYY-MM-DD) |

```sh
curl -H "Authorization: Bearer $ZENTA_TOKEN" -H "Content-Type: application/json" -d '{"projectId":"ZEN","name":"11월 2주","startsAt":"2026-11-16","endsAt":"2026-11-27"}' "$ZENTA_URL/api/hub/sprints"
```

### `POST /api/hub/sprints/{id}`

스프린트 이름·기간 바꾸기(세 칸을 함께 보내요) · scope: `issue:write`

| Field | Where | Required | Description |
|---|---|---|---|
| `id` | path (주소 안) | yes | 스프린트 번호 |
| `projectId` | json (JSON 본문) | yes | 프로젝트 번호 또는 키 |
| `name` | json (JSON 본문) | yes | 스프린트 이름 |
| `startsAt` | json (JSON 본문) | yes | 시작일(YYYY-MM-DD) |
| `endsAt` | json (JSON 본문) | yes | 끝나는 날(YYYY-MM-DD) |

```sh
curl -H "Authorization: Bearer $ZENTA_TOKEN" -H "Content-Type: application/json" -d '{"projectId":"ZEN","name":"11월 2주","startsAt":"2026-11-16","endsAt":"2026-11-30"}' "$ZENTA_URL/api/hub/sprints/SPRINTID"
```

### `POST /api/hub/sprints/{id}/start`

스프린트 시작하기(시작 전인 스프린트만 돼요) · scope: `issue:write`

| Field | Where | Required | Description |
|---|---|---|---|
| `id` | path (주소 안) | yes | 스프린트 번호 |
| `projectId` | query (주소 뒤 ?) | yes | 프로젝트 번호 또는 키 |

```sh
curl -H "Authorization: Bearer $ZENTA_TOKEN" -X POST "$ZENTA_URL/api/hub/sprints/SPRINTID/start?projectId=ZEN"
```

### `POST /api/hub/sprints/{id}/complete`

스프린트 끝내기(못 끝낸 이슈는 다음 스프린트로 넘기거나 스프린트 없음으로 가요) · scope: `issue:write`

| Field | Where | Required | Description |
|---|---|---|---|
| `id` | path (주소 안) | yes | 스프린트 번호 |
| `projectId` | query (주소 뒤 ?) | yes | 프로젝트 번호 또는 키 |
| `carryOverTo` | json (JSON 본문) |  | 못 끝낸 이슈를 넘길 스프린트 번호. 빼면 스프린트 없음으로 가요 |

```sh
curl -H "Authorization: Bearer $ZENTA_TOKEN" -H "Content-Type: application/json" -d '{"carryOverTo":"NEXTSPRINTID"}' "$ZENTA_URL/api/hub/sprints/SPRINTID/complete?projectId=ZEN"
```

### `GET /api/hub/sprints/{id}/issues`

스프린트에 담긴 이슈 목록 · scope: `issue:read`

| Field | Where | Required | Description |
|---|---|---|---|
| `id` | path (주소 안) | yes | 스프린트 번호 |
| `projectId` | query (주소 뒤 ?) | yes | 프로젝트 번호 또는 키 |

```sh
curl -H "Authorization: Bearer $ZENTA_TOKEN" "$ZENTA_URL/api/hub/sprints/SPRINTID/issues?projectId=ZEN"
```

### `GET /api/hub/sprints/backlog`

스프린트에 안 담긴 이슈 목록 · scope: `issue:read`

| Field | Where | Required | Description |
|---|---|---|---|
| `projectId` | query (주소 뒤 ?) | yes | 프로젝트 번호 또는 키 |
| `offset` | query (주소 뒤 ?) |  | 몇 개를 건너뛰고(이어 읽기) |
| `limit` | query (주소 뒤 ?) |  | 한 번에 몇 개 |

```sh
curl -H "Authorization: Bearer $ZENTA_TOKEN" "$ZENTA_URL/api/hub/sprints/backlog?projectId=ZEN"
```

### `POST /api/hub/releases`

릴리스 만들기 · scope: `issue:write`

| Field | Where | Required | Description |
|---|---|---|---|
| `projectId` | json (JSON 본문) | yes | 프로젝트 번호 또는 키 |
| `name` | json (JSON 본문) | yes | 릴리스 이름(예: 1.4.0) |
| `description` | json (JSON 본문) |  | 설명 |
| `releaseDate` | json (JSON 본문) |  | 출시 예정일(YYYY-MM-DD) |

```sh
curl -H "Authorization: Bearer $ZENTA_TOKEN" -H "Content-Type: application/json" -d '{"projectId":"ZEN","name":"1.4.0","releaseDate":"2026-12-01"}' "$ZENTA_URL/api/hub/releases"
```

### `POST /api/hub/releases/{id}`

릴리스 이름·설명·날짜 바꾸기(보낸 칸만 바뀌어요. 출시한 릴리스는 못 바꿔요) · scope: `issue:write`

| Field | Where | Required | Description |
|---|---|---|---|
| `id` | path (주소 안) | yes | 릴리스 번호 |
| `projectId` | query (주소 뒤 ?) | yes | 프로젝트 번호 또는 키 |
| `name` | json (JSON 본문) |  | 새 이름 |
| `description` | json (JSON 본문) |  | 새 설명 |
| `releaseDate` | json (JSON 본문) |  | 출시 예정일(YYYY-MM-DD). 빈 글자면 날짜를 지워요 |

```sh
curl -H "Authorization: Bearer $ZENTA_TOKEN" -H "Content-Type: application/json" -d '{"releaseDate":"2026-12-08"}' "$ZENTA_URL/api/hub/releases/RELEASEID?projectId=ZEN"
```

### `POST /api/hub/releases/{id}/release`

릴리스 출시하기(되돌릴 수 없어요. 못 끝낸 이슈는 다른 릴리스로 넘기거나 릴리스 없음으로 가요) · scope: `issue:write`

| Field | Where | Required | Description |
|---|---|---|---|
| `id` | path (주소 안) | yes | 릴리스 번호 |
| `projectId` | query (주소 뒤 ?) | yes | 프로젝트 번호 또는 키 |
| `moveTo` | json (JSON 본문) |  | 못 끝낸 이슈를 넘길 릴리스 번호. 빼면 릴리스 없음으로 가요 |

```sh
curl -H "Authorization: Bearer $ZENTA_TOKEN" -H "Content-Type: application/json" -d '{"moveTo":"NEXTRELEASEID"}' "$ZENTA_URL/api/hub/releases/RELEASEID/release?projectId=ZEN"
```

### `DELETE /api/hub/releases/{id}/issues/{issueId}`

이슈를 릴리스에서 빼기(이슈는 그대로예요. 출시한 릴리스에서는 못 빼요) · scope: `issue:write`

| Field | Where | Required | Description |
|---|---|---|---|
| `id` | path (주소 안) | yes | 릴리스 번호 |
| `issueId` | path (주소 안) | yes | 이슈 키(예: ZEN-12) 또는 번호 |
| `projectId` | query (주소 뒤 ?) | yes | 프로젝트 번호 또는 키 |

```sh
curl -H "Authorization: Bearer $ZENTA_TOKEN" -X DELETE "$ZENTA_URL/api/hub/releases/RELEASEID/issues/ZEN-12?projectId=ZEN"
```

### `POST /api/hub/milestones`

마일스톤 만들기 · scope: `issue:write`

| Field | Where | Required | Description |
|---|---|---|---|
| `projectId` | query (주소 뒤 ?) | yes | 프로젝트 번호 또는 키 |
| `name` | json (JSON 본문) | yes | 마일스톤 이름 |
| `description` | json (JSON 본문) |  | 설명 |
| `dueOn` | json (JSON 본문) |  | 목표일(YYYY-MM-DD) |

```sh
curl -H "Authorization: Bearer $ZENTA_TOKEN" -H "Content-Type: application/json" -d '{"name":"베타 공개","dueOn":"2026-12-15"}' "$ZENTA_URL/api/hub/milestones?projectId=ZEN"
```

### `GET /api/hub/milestones/{id}`

마일스톤 하나 · scope: `issue:read`

| Field | Where | Required | Description |
|---|---|---|---|
| `id` | path (주소 안) | yes | 마일스톤 번호 |
| `projectId` | query (주소 뒤 ?) | yes | 프로젝트 번호 또는 키 |

```sh
curl -H "Authorization: Bearer $ZENTA_TOKEN" "$ZENTA_URL/api/hub/milestones/MILESTONEID?projectId=ZEN"
```

### `POST /api/hub/milestones/{id}`

마일스톤 고치기(네 칸이 통째로 바뀌어요. 뺀 칸은 비고 상태는 open 이 돼요) · scope: `issue:write`

| Field | Where | Required | Description |
|---|---|---|---|
| `id` | path (주소 안) | yes | 마일스톤 번호 |
| `projectId` | query (주소 뒤 ?) | yes | 프로젝트 번호 또는 키 |
| `name` | json (JSON 본문) | yes | 마일스톤 이름 |
| `description` | json (JSON 본문) |  | 설명 |
| `dueOn` | json (JSON 본문) |  | 목표일(YYYY-MM-DD) |
| `state` | json (JSON 본문) |  | open(진행 중) · reached(이룸) · missed(놓침) |

```sh
curl -H "Authorization: Bearer $ZENTA_TOKEN" -H "Content-Type: application/json" -d '{"name":"베타 공개","dueOn":"2026-12-15","state":"reached"}' "$ZENTA_URL/api/hub/milestones/MILESTONEID?projectId=ZEN"
```

### `DELETE /api/hub/milestones/{id}/issues/{issueId}`

이슈를 마일스톤에서 빼기(이슈는 그대로예요) · scope: `issue:write`

| Field | Where | Required | Description |
|---|---|---|---|
| `id` | path (주소 안) | yes | 마일스톤 번호 |
| `issueId` | path (주소 안) | yes | 이슈 키(예: ZEN-12) 또는 번호 |
| `projectId` | query (주소 뒤 ?) | yes | 프로젝트 번호 또는 키 |

```sh
curl -H "Authorization: Bearer $ZENTA_TOKEN" -X DELETE "$ZENTA_URL/api/hub/milestones/MILESTONEID/issues/ZEN-12?projectId=ZEN"
```

### `DELETE /api/hub/issues/{taskId}/relations/{kind}/{otherId}`

이슈 관계 끊기(두 이슈는 그대로예요) · scope: `issue:write`

| Field | Where | Required | Description |
|---|---|---|---|
| `taskId` | path (주소 안) | yes | 이슈 키(예: ZEN-12) 또는 번호 |
| `kind` | path (주소 안) | yes | 맺을 때 쓴 관계 종류(예: blocking · related) |
| `otherId` | path (주소 안) | yes | 상대 이슈 키 또는 번호 |
| `projectId` | query (주소 뒤 ?) | yes | 프로젝트 번호 또는 키 |

```sh
curl -H "Authorization: Bearer $ZENTA_TOKEN" -X DELETE "$ZENTA_URL/api/hub/issues/ZEN-12/relations/blocking/ZEN-13?projectId=ZEN"
```

### `POST /api/hub/issues/{taskId}/watch`

이슈 지켜보기(바뀌면 토큰 주인에게 알림이 와요) · scope: `issue:write`

| Field | Where | Required | Description |
|---|---|---|---|
| `taskId` | path (주소 안) | yes | 이슈 키(예: ZEN-12) 또는 번호 |
| `projectId` | query (주소 뒤 ?) | yes | 그 이슈의 프로젝트 번호 또는 키 |

```sh
curl -H "Authorization: Bearer $ZENTA_TOKEN" -X POST "$ZENTA_URL/api/hub/issues/ZEN-12/watch?projectId=ZEN"
```

### `DELETE /api/hub/issues/{taskId}/watch`

이슈 지켜보기 그만두기 · scope: `issue:write`

| Field | Where | Required | Description |
|---|---|---|---|
| `taskId` | path (주소 안) | yes | 이슈 키(예: ZEN-12) 또는 번호 |
| `projectId` | query (주소 뒤 ?) | yes | 그 이슈의 프로젝트 번호 또는 키 |

```sh
curl -H "Authorization: Bearer $ZENTA_TOKEN" -X DELETE "$ZENTA_URL/api/hub/issues/ZEN-12/watch?projectId=ZEN"
```

### `POST /api/hub/issues/{taskId}/block`

이슈에 막힘 표시하기(사유를 적어요) · scope: `issue:write`

| Field | Where | Required | Description |
|---|---|---|---|
| `taskId` | path (주소 안) | yes | 이슈 키(예: ZEN-12) 또는 번호 |
| `projectId` | json (JSON 본문) | yes | 그 이슈의 프로젝트 번호 또는 키 |
| `reason` | json (JSON 본문) | yes | 막힌 까닭(200자까지) |

```sh
curl -H "Authorization: Bearer $ZENTA_TOKEN" -H "Content-Type: application/json" -d '{"projectId":"ZEN","reason":"디자인 시안을 기다려요"}' "$ZENTA_URL/api/hub/issues/ZEN-12/block"
```

### `DELETE /api/hub/issues/{taskId}/block`

이슈의 막힘 표시 풀기 · scope: `issue:write`

| Field | Where | Required | Description |
|---|---|---|---|
| `taskId` | path (주소 안) | yes | 이슈 키(예: ZEN-12) 또는 번호 |
| `projectId` | query (주소 뒤 ?) | yes | 그 이슈의 프로젝트 번호 또는 키 |

```sh
curl -H "Authorization: Bearer $ZENTA_TOKEN" -X DELETE "$ZENTA_URL/api/hub/issues/ZEN-12/block?projectId=ZEN"
```

### `POST /api/hub/issues/{taskId}/move`

이슈를 다른 프로젝트로 옮기기(키가 새로 붙어요) · scope: `issue:write`

| Field | Where | Required | Description |
|---|---|---|---|
| `taskId` | path (주소 안) | yes | 이슈 키(예: ZEN-12) 또는 번호 |
| `projectId` | json (JSON 본문) | yes | 지금 프로젝트 번호 또는 키 |
| `toProjectId` | json (JSON 본문) | yes | 옮길 프로젝트 번호 또는 키 |
| `dryRun` | json (JSON 본문) |  | true 면 옮기지 않고 계획만(고를 상태와 유형, 비워지는 것) |
| `statusId` | json (JSON 본문) |  | 옮긴 뒤 상태 번호(계획의 statuses 중 하나, 비우면 제안값) |
| `typeId` | json (JSON 본문) |  | 옮긴 뒤 유형 번호(계획의 types 중 하나, 비우면 제안값) |

```sh
curl -H "Authorization: Bearer $ZENTA_TOKEN" -H "Content-Type: application/json" -d '{"projectId":"ZEN","toProjectId":"OPS","dryRun":true}' "$ZENTA_URL/api/hub/issues/ZEN-12/move"
```

### `GET /api/hub/activity/issue/{id}`

이슈의 활동 이력(누가 언제 무엇을 바꿨는지) · scope: `issue:read`

| Field | Where | Required | Description |
|---|---|---|---|
| `id` | path (주소 안) | yes | 이슈 키(예: ZEN-12) 또는 번호 |
| `cursor` | query (주소 뒤 ?) |  | 다음 쪽(응답 머리글 X-Zenta-Next-Cursor 의 값) |

```sh
curl -H "Authorization: Bearer $ZENTA_TOKEN" "$ZENTA_URL/api/hub/activity/issue/ZEN-12"
```

### `POST /api/hub/issues/{taskId}/comments/{commentId}`

내가 단 코멘트 고치기 · scope: `issue:write`

| Field | Where | Required | Description |
|---|---|---|---|
| `taskId` | path (주소 안) | yes | 이슈 키(예: ZEN-12) 또는 번호 |
| `commentId` | path (주소 안) | yes | 코멘트 번호(이슈를 읽을 때 comments 의 id) |
| `projectId` | json (JSON 본문) | yes | 그 이슈의 프로젝트 번호 또는 키 |
| `body` | json (JSON 본문) | yes | 새 코멘트(마크다운, 20,000자까지) |

```sh
curl -H "Authorization: Bearer $ZENTA_TOKEN" -H "Content-Type: application/json" -d '{"projectId":"ZEN","body":"배포는 내일이에요"}' "$ZENTA_URL/api/hub/issues/ZEN-12/comments/42"
```

### `POST /api/hub/issues/{taskId}/vote`

이슈 추천하기(👍) · scope: `issue:write`

| Field | Where | Required | Description |
|---|---|---|---|
| `taskId` | path (주소 안) | yes | 이슈 키(예: ZEN-12) 또는 번호 |
| `projectId` | query (주소 뒤 ?) | yes | 그 이슈의 프로젝트 번호 또는 키 |

```sh
curl -H "Authorization: Bearer $ZENTA_TOKEN" -X POST "$ZENTA_URL/api/hub/issues/ZEN-12/vote?projectId=ZEN"
```

### `DELETE /api/hub/issues/{taskId}/vote`

이슈 추천 거두기 · scope: `issue:write`

| Field | Where | Required | Description |
|---|---|---|---|
| `taskId` | path (주소 안) | yes | 이슈 키(예: ZEN-12) 또는 번호 |
| `projectId` | query (주소 뒤 ?) | yes | 그 이슈의 프로젝트 번호 또는 키 |

```sh
curl -H "Authorization: Bearer $ZENTA_TOKEN" -X DELETE "$ZENTA_URL/api/hub/issues/ZEN-12/vote?projectId=ZEN"
```

### `POST /api/hub/issues/bulk`

여러 이슈를 한꺼번에 고치기(토큰은 한 번에 50건까지이고 건수만큼 쓰기 한도에서 빠져요) · scope: `issue:write`

| Field | Where | Required | Description |
|---|---|---|---|
| `projectId` | json (JSON 본문) | yes | 그 이슈들의 프로젝트 번호 또는 키 |
| `issueIds` | json (JSON 본문) | yes | 고칠 이슈의 키나 번호 목록(50건까지) |
| `status` | json (JSON 본문) |  | 상태를 바꾸려면 {"mode":"set","value":"상태 번호"} |
| `priority` | json (JSON 본문) |  | 우선순위를 바꾸려면 {"mode":"set","value":2} 이고 값은 0~4 정수 |
| `dueDate` | json (JSON 본문) |  | 마감일을 바꾸려면 {"mode":"set","value":"2026-12-01"} 이고 value 가 null 이면 비워요 |
| `startDate` | json (JSON 본문) |  | 시작일(마감일과 같은 모양) |
| `labels` | json (JSON 본문) |  | 라벨은 {"mode":"add","ids":["라벨 번호"]} 이고 mode 는 add · remove · replace · clear 중 하나 |
| `assignees` | json (JSON 본문) |  | 담당자(라벨과 같은 모양이고 ids 는 사람 번호) |
| `notify` | json (JSON 본문) |  | true 면 새 담당자에게 알림을 보내요(기본은 안 보내요) |

```sh
curl -H "Authorization: Bearer $ZENTA_TOKEN" -H "Content-Type: application/json" -d '{"projectId":"ZEN","issueIds":["ZEN-12","ZEN-13"],"priority":{"mode":"set","value":2}}' "$ZENTA_URL/api/hub/issues/bulk"
```

### `POST /api/hub/issues/bulk/move`

여러 이슈를 다른 프로젝트로 옮기기(토큰은 한 번에 50건까지이고 건수만큼 쓰기 한도에서 빠져요) · scope: `issue:write`

| Field | Where | Required | Description |
|---|---|---|---|
| `projectId` | json (JSON 본문) | yes | 지금 프로젝트 번호 또는 키 |
| `toProjectId` | json (JSON 본문) | yes | 옮길 프로젝트 번호 또는 키 |
| `items` | json (JSON 본문) | yes | 옮길 이슈 목록이고 한 줄은 {"issueId":"ZEN-12","statusId":"옮긴 뒤 상태 번호"}(상태는 낱개 옮기기의 계획에서 골라요) |

```sh
curl -H "Authorization: Bearer $ZENTA_TOKEN" -H "Content-Type: application/json" -d '{"projectId":"ZEN","toProjectId":"APP","items":[{"issueId":"ZEN-12","statusId":"1"}]}' "$ZENTA_URL/api/hub/issues/bulk/move"
```

### `GET /api/hub/filters`

저장 필터 목록 · scope: `issue:read`

| Field | Where | Required | Description |
|---|---|---|---|
| `projectId` | query (주소 뒤 ?) |  | 프로젝트 번호 또는 키. projectId 또는 scope=org 중 하나는 필수예요 |
| `scope` | query (주소 뒤 ?) |  | org 면 프로젝트에 묶이지 않은 전체 필터 |

```sh
curl -H "Authorization: Bearer $ZENTA_TOKEN" "$ZENTA_URL/api/hub/filters?projectId=ZEN"
```

### `GET /api/hub/filters/starred`

내가 즐겨찾기한 저장 필터 · scope: `issue:read`

```sh
curl -H "Authorization: Bearer $ZENTA_TOKEN" "$ZENTA_URL/api/hub/filters/starred"
```

### `GET /api/hub/filters/{id}`

저장 필터 하나(이름과 조건) · scope: `issue:read`

| Field | Where | Required | Description |
|---|---|---|---|
| `id` | path (주소 안) | yes | 필터 번호 |

```sh
curl -H "Authorization: Bearer $ZENTA_TOKEN" "$ZENTA_URL/api/hub/filters/123"
```

### `GET /api/hub/filters/{id}/issues`

저장 필터에 걸리는 이슈 목록 · scope: `issue:read`

| Field | Where | Required | Description |
|---|---|---|---|
| `id` | path (주소 안) | yes | 필터 번호 |
| `limit` | query (주소 뒤 ?) |  | 한 번에 받을 수(기본 200, 최대 200) |
| `cursor` | query (주소 뒤 ?) |  | 앞 응답의 nextCursor(다음 쪽) |

```sh
curl -H "Authorization: Bearer $ZENTA_TOKEN" "$ZENTA_URL/api/hub/filters/123/issues?limit=50"
```

### `POST /api/hub/filters`

저장 필터 만들기 · scope: `issue:write`

| Field | Where | Required | Description |
|---|---|---|---|
| `projectId` | json (JSON 본문) |  | 프로젝트 번호 또는 키(전체 필터면 빼고 scope 를 org 로) |
| `scope` | json (JSON 본문) |  | org 면 전체 필터 |
| `name` | json (JSON 본문) | yes | 필터 이름 |
| `query` | json (JSON 본문) | yes | 조건 객체(예: {"assigneeMe":true,"statusCategories":["todo","doing"]}) |
| `shared` | json (JSON 본문) |  | 프로젝트 필터를 프로젝트 사람들과 함께 쓸지(기본 false) |
| `share` | json (JSON 본문) |  | 전체 필터의 공유 범위: private · team · org |
| `teamId` | json (JSON 본문) |  | share 가 team 일 때 팀 번호 |

```sh
curl -H "Authorization: Bearer $ZENTA_TOKEN" -H "Content-Type: application/json" -d '{"projectId":"ZEN","name":"내 할 일","query":{"assigneeMe":true}}' "$ZENTA_URL/api/hub/filters"
```

### `POST /api/hub/filters/{id}`

저장 필터 고치기(보낸 칸만 바뀌어요) · scope: `issue:write`

| Field | Where | Required | Description |
|---|---|---|---|
| `id` | path (주소 안) | yes | 필터 번호 |
| `name` | json (JSON 본문) |  | 새 이름 |
| `query` | json (JSON 본문) |  | 새 조건 객체(통째로 바뀌어요) |
| `shared` | json (JSON 본문) |  | 프로젝트 필터의 공유 여부 |
| `share` | json (JSON 본문) |  | 전체 필터의 공유 범위: private · team · org |
| `teamId` | json (JSON 본문) |  | share 가 team 일 때 팀 번호 |

```sh
curl -H "Authorization: Bearer $ZENTA_TOKEN" -H "Content-Type: application/json" -d '{"name":"이번 주 할 일"}' "$ZENTA_URL/api/hub/filters/123"
```

### `POST /api/hub/filters/{id}/star`

저장 필터를 즐겨찾기에 넣기 또는 빼기 · scope: `issue:write`

| Field | Where | Required | Description |
|---|---|---|---|
| `id` | path (주소 안) | yes | 필터 번호 |
| `on` | json (JSON 본문) | yes | true 면 넣기, false 면 빼기 |

```sh
curl -H "Authorization: Bearer $ZENTA_TOKEN" -H "Content-Type: application/json" -d '{"on":true}' "$ZENTA_URL/api/hub/filters/123/star"
```

### `GET /api/hub/sprints/{id}/report`

스프린트 리포트(끝낸 것과 남은 것, 시작한 스프린트만) · scope: `issue:read`

| Field | Where | Required | Description |
|---|---|---|---|
| `id` | path (주소 안) | yes | 스프린트 번호 |
| `projectId` | query (주소 뒤 ?) | yes | 프로젝트 번호 또는 키 |

```sh
curl -H "Authorization: Bearer $ZENTA_TOKEN" "$ZENTA_URL/api/hub/sprints/123/report?projectId=ZEN"
```

### `GET /api/hub/sprints/{id}/burndown`

스프린트 번다운(날마다 남은 양) · scope: `issue:read`

| Field | Where | Required | Description |
|---|---|---|---|
| `id` | path (주소 안) | yes | 스프린트 번호 |
| `projectId` | query (주소 뒤 ?) | yes | 프로젝트 번호 또는 키 |

```sh
curl -H "Authorization: Bearer $ZENTA_TOKEN" "$ZENTA_URL/api/hub/sprints/123/burndown?projectId=ZEN"
```

### `GET /api/hub/goals`

목표 목록(진행률과 함께) · scope: `issue:read`

| Field | Where | Required | Description |
|---|---|---|---|
| `archived` | query (주소 뒤 ?) |  | 1 이면 보관한 목표 |

```sh
curl -H "Authorization: Bearer $ZENTA_TOKEN" "$ZENTA_URL/api/hub/goals"
```

### `POST /api/hub/goals`

목표 만들기 · scope: `issue:write`

| Field | Where | Required | Description |
|---|---|---|---|
| `title` | json (JSON 본문) | yes | 목표 이름(200자까지) |
| `description` | json (JSON 본문) |  | 설명(4000자까지) |
| `state` | json (JSON 본문) |  | active(하는 중) · achieved(이룸) · missed(못 이룸) |
| `ownerId` | json (JSON 본문) |  | 담당자의 사용자 번호 |
| `targetDate` | json (JSON 본문) |  | 목표일(YYYY-MM-DD) |
| `mode` | json (JSON 본문) |  | 진행률을 세는 법. issues 면 이은 이슈로, manual 이면 manualPercent 로 |
| `manualPercent` | json (JSON 본문) |  | mode 가 manual 일 때의 진행률(0~100) |

```sh
curl -H "Authorization: Bearer $ZENTA_TOKEN" -H "Content-Type: application/json" -d '{"title":"3분기 출시","targetDate":"2026-09-30"}' "$ZENTA_URL/api/hub/goals"
```

### `POST /api/hub/goals/{id}`

목표 고치기(보낸 칸만 바뀌어요. 만든 사람 · 담당자 · 조직 관리자만) · scope: `issue:write`

| Field | Where | Required | Description |
|---|---|---|---|
| `id` | path (주소 안) | yes | 목표 번호 |
| `title` | json (JSON 본문) |  | 목표 이름(200자까지) |
| `description` | json (JSON 본문) |  | 설명(4000자까지) |
| `state` | json (JSON 본문) |  | active(하는 중) · achieved(이룸) · missed(못 이룸) |
| `ownerId` | json (JSON 본문) |  | 담당자의 사용자 번호 |
| `targetDate` | json (JSON 본문) |  | 목표일(YYYY-MM-DD) |
| `mode` | json (JSON 본문) |  | 진행률을 세는 법. issues 면 이은 이슈로, manual 이면 manualPercent 로 |
| `manualPercent` | json (JSON 본문) |  | mode 가 manual 일 때의 진행률(0~100) |

```sh
curl -H "Authorization: Bearer $ZENTA_TOKEN" -H "Content-Type: application/json" -d '{"state":"achieved"}' "$ZENTA_URL/api/hub/goals/123"
```

### `POST /api/hub/goals/{id}/archive`

목표 보관하기 또는 되돌리기 · scope: `issue:write`

| Field | Where | Required | Description |
|---|---|---|---|
| `id` | path (주소 안) | yes | 목표 번호 |
| `archived` | json (JSON 본문) | yes | true 면 보관, false 면 되돌리기 |

```sh
curl -H "Authorization: Bearer $ZENTA_TOKEN" -H "Content-Type: application/json" -d '{"archived":true}' "$ZENTA_URL/api/hub/goals/123/archive"
```

### `GET /api/hub/goals/{id}/issues`

목표에 이은 이슈 목록(못 보는 이슈는 수만 hidden 에 담겨요) · scope: `issue:read`

| Field | Where | Required | Description |
|---|---|---|---|
| `id` | path (주소 안) | yes | 목표 번호 |

```sh
curl -H "Authorization: Bearer $ZENTA_TOKEN" "$ZENTA_URL/api/hub/goals/123/issues"
```

### `POST /api/hub/goals/{id}/issues`

목표에 이슈 잇기(고칠 수 있는 이슈만, 한 번에 50건까지이고 이슈 수만큼 쓰기 한도에서 빠져요) · scope: `issue:write`

| Field | Where | Required | Description |
|---|---|---|---|
| `id` | path (주소 안) | yes | 목표 번호 |
| `issueIds` | json (JSON 본문) | yes | 이을 이슈 번호 목록 |

```sh
curl -H "Authorization: Bearer $ZENTA_TOKEN" -H "Content-Type: application/json" -d '{"issueIds":["123"]}' "$ZENTA_URL/api/hub/goals/123/issues"
```

### `DELETE /api/hub/goals/{id}/issues/{issueId}`

목표에서 이슈 떼기(이슈와 목표는 그대로 남아요) · scope: `issue:write`

| Field | Where | Required | Description |
|---|---|---|---|
| `id` | path (주소 안) | yes | 목표 번호 |
| `issueId` | path (주소 안) | yes | 이슈 키(예: ZEN-12) 또는 번호 |

```sh
curl -H "Authorization: Bearer $ZENTA_TOKEN" -X DELETE "$ZENTA_URL/api/hub/goals/123/issues/ZEN-12"
```

### `GET /api/hub/issues/{id}/parent-options`

이 이슈의 상위로 고를 수 있는 이슈 · scope: `issue:read`

| Field | Where | Required | Description |
|---|---|---|---|
| `id` | path (주소 안) | yes | 이슈 키(예: ZEN-12) 또는 번호 |
| `projectId` | query (주소 뒤 ?) | yes | 그 이슈의 프로젝트 번호 또는 키 |
| `q` | query (주소 뒤 ?) |  | 키나 제목에서 찾을 낱말 |

```sh
curl -H "Authorization: Bearer $ZENTA_TOKEN" "$ZENTA_URL/api/hub/issues/ZEN-12/parent-options?projectId=ZEN"
```

### `GET /api/hub/issues/{id}/child-options`

이 이슈의 하위로 넣을 수 있는 이슈 · scope: `issue:read`

| Field | Where | Required | Description |
|---|---|---|---|
| `id` | path (주소 안) | yes | 이슈 키(예: ZEN-12) 또는 번호 |
| `projectId` | query (주소 뒤 ?) | yes | 그 이슈의 프로젝트 번호 또는 키 |
| `q` | query (주소 뒤 ?) |  | 키나 제목에서 찾을 낱말 |

```sh
curl -H "Authorization: Bearer $ZENTA_TOKEN" "$ZENTA_URL/api/hub/issues/ZEN-12/child-options?projectId=ZEN"
```

### `PUT /api/hub/issues/{id}/parent`

이슈의 상위 정하기(이미 상위가 있으면 옮겨져요) · scope: `issue:write`

| Field | Where | Required | Description |
|---|---|---|---|
| `id` | path (주소 안) | yes | 이슈 키(예: ZEN-12) 또는 번호 |
| `projectId` | json (JSON 본문) | yes | 그 이슈의 프로젝트 번호 또는 키 |
| `parentId` | json (JSON 본문) | yes | 상위가 될 이슈 키 또는 번호 |
| `ifParentId` | json (JSON 본문) |  | 지금 상위가 이 이슈일 때만 바꾸기(빈 값은 상위가 없을 때만) |

```sh
curl -H "Authorization: Bearer $ZENTA_TOKEN" -X PUT -H "Content-Type: application/json" -d '{"projectId":"ZEN","parentId":"ZEN-10"}' "$ZENTA_URL/api/hub/issues/ZEN-12/parent"
```

### `DELETE /api/hub/issues/{id}/parent`

이슈를 상위에서 떼기(두 이슈는 그대로 남아요) · scope: `issue:write`

| Field | Where | Required | Description |
|---|---|---|---|
| `id` | path (주소 안) | yes | 이슈 키(예: ZEN-12) 또는 번호 |
| `projectId` | query (주소 뒤 ?) | yes | 그 이슈의 프로젝트 번호 또는 키 |
| `ifParentId` | query (주소 뒤 ?) |  | 지금 상위가 이 이슈일 때만 떼기 |

```sh
curl -H "Authorization: Bearer $ZENTA_TOKEN" -X DELETE "$ZENTA_URL/api/hub/issues/ZEN-12/parent?projectId=ZEN"
```

### `GET /api/hub/issues/{taskId}/commits`

이슈에 이어진 commit(최근 것부터, 글쓴이 메일은 안 실어요) · scope: `issue:read`

| Field | Where | Required | Description |
|---|---|---|---|
| `taskId` | path (주소 안) | yes | 이슈 키(예: ZEN-12) 또는 번호 |
| `cursor` | query (주소 뒤 ?) |  | 앞 답의 nextCursor(더 오래된 commit) |

```sh
curl -H "Authorization: Bearer $ZENTA_TOKEN" "$ZENTA_URL/api/hub/issues/ZEN-12/commits"
```

### `GET /api/hub/issues/{taskId}/pull-requests`

이슈에 이어진 PR과 검토자 · scope: `issue:read`

| Field | Where | Required | Description |
|---|---|---|---|
| `taskId` | path (주소 안) | yes | 이슈 키(예: ZEN-12) 또는 번호 |

```sh
curl -H "Authorization: Bearer $ZENTA_TOKEN" "$ZENTA_URL/api/hub/issues/ZEN-12/pull-requests"
```

### `GET /api/hub/issues/department`

부서가 담당인 이슈(내가 볼 수 있는 것만) · scope: `issue:read`

| Field | Where | Required | Description |
|---|---|---|---|
| `departmentId` | query (주소 뒤 ?) |  | 부서 번호(없으면 내 부서) |
| `offset` | query (주소 뒤 ?) |  | 건너뛸 건수 |
| `limit` | query (주소 뒤 ?) |  | 한 번에 받을 건수(기본 50, 200까지) |

```sh
curl -H "Authorization: Bearer $ZENTA_TOKEN" "$ZENTA_URL/api/hub/issues/department"
```

### `POST /api/hub/issues/bulk/watch`

여러 이슈 한꺼번에 지켜보기 또는 그만 보기(토큰은 한 번에 50건까지이고 건수만큼 쓰기 한도에서 빠져요) · scope: `issue:write`

| Field | Where | Required | Description |
|---|---|---|---|
| `projectId` | json (JSON 본문) | yes | 프로젝트 번호 또는 키 |
| `issueIds` | json (JSON 본문) | yes | 이슈 키 목록 |
| `watch` | json (JSON 본문) | yes | true 면 지켜보기, false 면 그만 보기 |

```sh
curl -H "Authorization: Bearer $ZENTA_TOKEN" -H "Content-Type: application/json" -d '{"projectId":"ZEN","issueIds":["ZEN-12","ZEN-13"],"watch":true}' "$ZENTA_URL/api/hub/issues/bulk/watch"
```

### `GET /api/hub/approvals`

내 결재 목록(mine 이 없으면 내 차례인 결재, 한 번에 200건) · scope: `issue:read`

| Field | Where | Required | Description |
|---|---|---|---|
| `mine` | query (주소 뒤 ?) |  | drafted(내가 올린 결재) · handled(내가 처리한 결재) · done(내가 관여했고 끝난 결재) |
| `projectId` | query (주소 뒤 ?) |  | 프로젝트 키 또는 번호로 좁히기 |
| `offset` | query (주소 뒤 ?) |  | 건너뛸 건수(200건이 왔으면 다음 쪽이 있을 수 있어요) |

```sh
curl -H "Authorization: Bearer $ZENTA_TOKEN" "$ZENTA_URL/api/hub/approvals?mine=drafted"
```

### `GET /api/hub/approvals/{id}`

결재 한 건(결재선과 단계별 상태) · scope: `issue:read`

| Field | Where | Required | Description |
|---|---|---|---|
| `id` | path (주소 안) | yes | 결재 번호 |

```sh
curl -H "Authorization: Bearer $ZENTA_TOKEN" "$ZENTA_URL/api/hub/approvals/123"
```

### `GET /api/hub/approvals/issue/{issueId}`

이슈에 걸린 결재 목록 · scope: `issue:read`

| Field | Where | Required | Description |
|---|---|---|---|
| `issueId` | path (주소 안) | yes | 이슈 키(예: ZEN-12) 또는 번호 |

```sh
curl -H "Authorization: Bearer $ZENTA_TOKEN" "$ZENTA_URL/api/hub/approvals/issue/ZEN-12"
```

### `GET /api/hub/approvals/line/suggest`

내 부서 기준으로 추천하는 결재선 · scope: `issue:read`

```sh
curl -H "Authorization: Bearer $ZENTA_TOKEN" "$ZENTA_URL/api/hub/approvals/line/suggest"
```

### `POST /api/hub/approvals`

결재 올리기 · scope: `issue:write`

| Field | Where | Required | Description |
|---|---|---|---|
| `title` | json (JSON 본문) | yes | 제목(100자까지) |
| `body` | json (JSON 본문) |  | 내용(4000자까지) |
| `approverIds` | json (JSON 본문) | yes | 결재자의 사용자 번호 목록(결재 순서대로, 10명까지) |
| `issueId` | json (JSON 본문) |  | 결재를 걸 이슈 번호 |

```sh
curl -H "Authorization: Bearer $ZENTA_TOKEN" -H "Content-Type: application/json" -d '{"title":"연차 신청","body":"12월 1일부터 사흘","approverIds":["123"]}' "$ZENTA_URL/api/hub/approvals"
```

### `POST /api/hub/approvals/{id}/withdraw`

내가 올린 결재 회수하기 · scope: `issue:write`

| Field | Where | Required | Description |
|---|---|---|---|
| `id` | path (주소 안) | yes | 결재 번호 |

```sh
curl -H "Authorization: Bearer $ZENTA_TOKEN" -X POST "$ZENTA_URL/api/hub/approvals/123/withdraw"
```

### `POST /api/hub/approvals/{id}/approve`

내 차례인 결재 승인하기 · scope: `approval:decide`

| Field | Where | Required | Description |
|---|---|---|---|
| `id` | path (주소 안) | yes | 결재 번호 |
| `comment` | json (JSON 본문) |  | 의견(500자까지) |

```sh
curl -H "Authorization: Bearer $ZENTA_TOKEN" -H "Content-Type: application/json" -d '{"comment":"확인했어요"}' "$ZENTA_URL/api/hub/approvals/123/approve"
```

### `POST /api/hub/approvals/{id}/reject`

내 차례인 결재 반려하기 · scope: `approval:decide`

| Field | Where | Required | Description |
|---|---|---|---|
| `id` | path (주소 안) | yes | 결재 번호 |
| `comment` | json (JSON 본문) | yes | 반려 사유(500자까지) |

```sh
curl -H "Authorization: Bearer $ZENTA_TOKEN" -H "Content-Type: application/json" -d '{"comment":"예산 근거를 더해 주세요"}' "$ZENTA_URL/api/hub/approvals/123/reject"
```

### `GET /api/hub/users/{id}`

사람 한 명의 이름 · 부서 · 직함(메일은 안 실어요) · scope: `issue:read`

| Field | Where | Required | Description |
|---|---|---|---|
| `id` | path (주소 안) | yes | 사람 번호 |

```sh
curl -H "Authorization: Bearer $ZENTA_TOKEN" "$ZENTA_URL/api/hub/users/123"
```

### `GET /api/hub/org/tree`

부서 나무(담당 부서로 고를 부서 번호) · scope: `issue:read`

| Field | Where | Required | Description |
|---|---|---|---|
| `includeArchived` | query (주소 뒤 ?) |  | true 면 없앤 부서도 함께 |

```sh
curl -H "Authorization: Bearer $ZENTA_TOKEN" "$ZENTA_URL/api/hub/org/tree"
```

### `GET /api/hub/org/departments/{id}/members`

부서에 속한 사람 목록 · scope: `issue:read`

| Field | Where | Required | Description |
|---|---|---|---|
| `id` | path (주소 안) | yes | 부서 번호 |
| `includeDescendants` | query (주소 뒤 ?) |  | true 면 아래 부서 사람도 함께 |
| `limit` | query (주소 뒤 ?) |  | 한 번에 받을 수(보내면 쪽으로 나눠 줘요, 최대 200) |
| `cursor` | query (주소 뒤 ?) |  | 앞 응답의 nextCursor(다음 쪽) |

```sh
curl -H "Authorization: Bearer $ZENTA_TOKEN" "$ZENTA_URL/api/hub/org/departments/123/members?limit=50"
```

### `GET /api/hub/search`

이슈나 코멘트를 낱말로 찾기(이슈 보기 권한이 있어야 해요) · scope: by `kind` — `comment` needs `issue:read`, `issue` needs `issue:read`

| Field | Where | Required | Description |
|---|---|---|---|
| `q` | query (주소 뒤 ?) | yes | 찾을 낱말 |
| `kind` | query (주소 뒤 ?) | yes | issue(이슈) 또는 comment(코멘트) 중 하나 |
| `projectId` | query (주소 뒤 ?) |  | 이 프로젝트 안에서만(번호 또는 키) |
| `after` | query (주소 뒤 ?) |  | 이 날짜부터(YYYY-MM-DD, 이슈는 마지막으로 바뀐 날이고 코멘트는 쓴 날) |
| `before` | query (주소 뒤 ?) |  | 이 날짜 전까지(YYYY-MM-DD, 그날은 안 들어가요) |
| `limit` | query (주소 뒤 ?) |  | 한 번에 받을 건수(기본 30, 300까지) |

```sh
curl -H "Authorization: Bearer $ZENTA_TOKEN" "$ZENTA_URL/api/hub/search?kind=issue&q=%EB%A1%9C%EA%B7%B8%EC%9D%B8"
```

### `POST /api/hub/projects`

프로젝트 만들기(만든 사람이 관리자가 돼요) · scope: `issue:write`

| Field | Where | Required | Description |
|---|---|---|---|
| `title` | json (JSON 본문) | yes | 프로젝트 이름 |
| `key` | json (JSON 본문) |  | 이슈 번호 앞에 붙는 키(예: ZEN, 비우면 이름에서 정해요) |
| `emoji` | json (JSON 본문) |  | 이름 앞에 붙일 이모지 하나 |
| `template` | json (JSON 본문) |  | general · software · support · approval · marketing · sales 중 하나(기본 general) |

```sh
curl -H "Authorization: Bearer $ZENTA_TOKEN" -H "Content-Type: application/json" -d '{"title":"모바일 앱","key":"APP","template":"software"}' "$ZENTA_URL/api/hub/projects"
```

### `POST /api/hub/projects/{id}`

프로젝트 고치기(보낸 칸만 바뀌어요) · scope: `issue:write`

| Field | Where | Required | Description |
|---|---|---|---|
| `id` | path (주소 안) | yes | 프로젝트 번호 또는 키 |
| `title` | json (JSON 본문) |  | 프로젝트 이름 |
| `description` | json (JSON 본문) |  | 설명 |
| `emoji` | json (JSON 본문) |  | 이름 앞에 붙일 이모지 하나 |
| `hexColor` | json (JSON 본문) |  | 프로젝트 색(#rrggbb, 빈 글자면 색 없음) |
| `archived` | json (JSON 본문) |  | true 면 보관, false 면 되돌리기 |

```sh
curl -H "Authorization: Bearer $ZENTA_TOKEN" -H "Content-Type: application/json" -d '{"description":"2027 상반기 출시"}' "$ZENTA_URL/api/hub/projects/APP"
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

### `GET /api/v1/dms`

내 개인 대화 목록 · scope: `chat:read`

| Field | Where | Required | Description |
|---|---|---|---|
| `cursor` | query (주소 뒤 ?) |  | 앞 응답의 nextCursor(다음 쪽, 한 쪽에 100개) |

```sh
curl -H "Authorization: Bearer $ZENTA_TOKEN" "$ZENTA_URL/api/v1/dms"
```

### `GET /api/v1/dms/{id}/messages`

개인 대화의 메시지 읽기 · scope: `chat:read`

| Field | Where | Required | Description |
|---|---|---|---|
| `id` | path (주소 안) | yes | 개인 대화 번호 |
| `num_before` | query (주소 뒤 ?) |  | 한 번에 몇 개 |
| `before` | query (주소 뒤 ?) |  | 이 메시지 번호 앞의 글부터(이어 읽기) |

```sh
curl -H "Authorization: Bearer $ZENTA_TOKEN" "$ZENTA_URL/api/v1/dms/123/messages?num_before=50"
```

### `POST /api/v1/dms`

개인 대화 열기(같은 사람들과의 대화가 있으면 그 대화를 돌려줘요) · scope: `chat:write`

| Field | Where | Required | Description |
|---|---|---|---|
| `user_id` | form (폼 본문) |  | 상대 사람 번호(여럿이면 여러 번, 안 보내면 나에게 쓰는 대화) |

```sh
curl -H "Authorization: Bearer $ZENTA_TOKEN" --data-urlencode "user_id=123" "$ZENTA_URL/api/v1/dms"
```

### `POST /api/v1/dms/{id}/messages`

개인 대화에 메시지 보내기(채널 글과 합쳐 1분 30개까지) · scope: `chat:write`

| Field | Where | Required | Description |
|---|---|---|---|
| `id` | path (주소 안) | yes | 개인 대화 번호 |
| `content` | form (폼 본문) | yes | 보낼 글(마크다운, 10,000자까지) |
| `parent_id` | form (폼 본문) |  | 답글을 달 메시지 번호 |

```sh
curl -H "Authorization: Bearer $ZENTA_TOKEN" --data-urlencode "content=확인했어요" "$ZENTA_URL/api/v1/dms/123/messages"
```

### `GET /api/v1/streams/{id}/members`

채널에 든 사람 목록 · scope: `chat:read`

| Field | Where | Required | Description |
|---|---|---|---|
| `id` | path (주소 안) | yes | 채널 번호 |
| `q` | query (주소 뒤 ?) |  | 이름으로 좁히기 |
| `limit` | query (주소 뒤 ?) |  | 한 번에 받을 수(보내면 쪽으로 나눠 줘요) |
| `cursor` | query (주소 뒤 ?) |  | 앞 응답의 nextCursor(다음 쪽) |

```sh
curl -H "Authorization: Bearer $ZENTA_TOKEN" "$ZENTA_URL/api/v1/streams/123/members?limit=50"
```

### `GET /api/v1/streams/{id}/pins`

채널에 고정한 메시지 목록 · scope: `chat:read`

| Field | Where | Required | Description |
|---|---|---|---|
| `id` | path (주소 안) | yes | 채널 번호 |
| `cursor` | query (주소 뒤 ?) |  | 앞 응답의 nextCursor(다음 쪽, 한 쪽에 50개) |

```sh
curl -H "Authorization: Bearer $ZENTA_TOKEN" "$ZENTA_URL/api/v1/streams/123/pins"
```

### `POST /api/v1/streams/{id}/join`

공개 채널에 들어가기(비공개 채널은 초대로만 들어가요) · scope: `chat:write`

| Field | Where | Required | Description |
|---|---|---|---|
| `id` | path (주소 안) | yes | 채널 번호 |

```sh
curl -H "Authorization: Bearer $ZENTA_TOKEN" -X POST "$ZENTA_URL/api/v1/streams/123/join"
```

### `GET /api/v1/messages/search`

내가 볼 수 있는 채널과 대화에서 메시지 찾기 · scope: `chat:read`

| Field | Where | Required | Description |
|---|---|---|---|
| `q` | query (주소 뒤 ?) | yes | 찾을 낱말 |
| `limit` | query (주소 뒤 ?) |  | 한 번에 받을 수 |

```sh
curl -H "Authorization: Bearer $ZENTA_TOKEN" -G --data-urlencode "q=배포" "$ZENTA_URL/api/v1/messages/search"
```

### `GET /api/v1/unread`

채널과 대화마다 안 읽은 메시지 수 · scope: `chat:read`

```sh
curl -H "Authorization: Bearer $ZENTA_TOKEN" "$ZENTA_URL/api/v1/unread"
```

### `PATCH /api/v1/messages/{id}`

내가 쓴 메시지 고치기(남의 글은 못 고쳐요) · scope: `chat:write`

| Field | Where | Required | Description |
|---|---|---|---|
| `id` | path (주소 안) | yes | 메시지 번호 |
| `content` | json (JSON 본문) | yes | 새 글(마크다운, 비울 수 없어요) |

```sh
curl -H "Authorization: Bearer $ZENTA_TOKEN" -X PATCH -H "Content-Type: application/json" -d '{"content":"고친 글이에요"}' "$ZENTA_URL/api/v1/messages/123"
```

### `POST /api/v1/messages/{id}/pin`

메시지를 채널에 고정하기 · scope: `chat:write`

| Field | Where | Required | Description |
|---|---|---|---|
| `id` | path (주소 안) | yes | 메시지 번호 |

```sh
curl -H "Authorization: Bearer $ZENTA_TOKEN" -X POST "$ZENTA_URL/api/v1/messages/123/pin"
```

### `DELETE /api/v1/messages/{id}/pin`

메시지 고정 풀기(글은 그대로 남아요) · scope: `chat:write`

| Field | Where | Required | Description |
|---|---|---|---|
| `id` | path (주소 안) | yes | 메시지 번호 |

```sh
curl -H "Authorization: Bearer $ZENTA_TOKEN" -X DELETE "$ZENTA_URL/api/v1/messages/123/pin"
```

### `GET /api/v1/streams/browse`

들어갈 수 있는 공개 채널 둘러보기 · scope: `chat:read`

| Field | Where | Required | Description |
|---|---|---|---|
| `q` | query (주소 뒤 ?) |  | 이름으로 좁히기 |
| `limit` | query (주소 뒤 ?) |  | 한 번에 받을 수(보내면 쪽으로 나눠 줘요) |
| `cursor` | query (주소 뒤 ?) |  | 앞 응답의 nextCursor(다음 쪽) |

```sh
curl -H "Authorization: Bearer $ZENTA_TOKEN" "$ZENTA_URL/api/v1/streams/browse?limit=50"
```

### `POST /api/v1/streams`

채널 만들기(만든 사람이 그 채널에 들어가요) · scope: `chat:write`

| Field | Where | Required | Description |
|---|---|---|---|
| `name` | json (JSON 본문) | yes | 채널 이름(조직 안에서 하나뿐이어야 해요) |
| `description` | json (JSON 본문) |  | 채널 설명 |
| `invite_only` | json (JSON 본문) |  | true 면 비공개 채널(초대로만 들어와요) |

```sh
curl -H "Authorization: Bearer $ZENTA_TOKEN" -H "Content-Type: application/json" -d '{"name":"배포-알림","description":"배포 소식"}' "$ZENTA_URL/api/v1/streams"
```

### `PATCH /api/v1/streams/{id}`

채널 이름 · 설명 · 보관 · 공개 범위 바꾸기(조직 관리자나 채널을 만든 사람만) · scope: `chat:write`

| Field | Where | Required | Description |
|---|---|---|---|
| `id` | path (주소 안) | yes | 채널 번호 |
| `name` | json (JSON 본문) |  | 새 이름 |
| `description` | json (JSON 본문) |  | 새 설명 |
| `is_archived` | json (JSON 본문) |  | true 면 보관, false 면 되살리기 |
| `is_private` | json (JSON 본문) |  | true 면 비공개로, false 면 공개로 |

```sh
curl -H "Authorization: Bearer $ZENTA_TOKEN" -X PATCH -H "Content-Type: application/json" -d '{"description":"배포 소식과 장애 알림"}' "$ZENTA_URL/api/v1/streams/123"
```

### `POST /api/v1/streams/{id}/invite`

채널에 사람 초대하기(조직 관리자나 채널을 만든 사람만, 한 번에 100명까지이고 사람 수만큼 쓰기 한도에서 빠져요) · scope: `chat:write`

| Field | Where | Required | Description |
|---|---|---|---|
| `id` | path (주소 안) | yes | 채널 번호 |
| `user_ids` | json (JSON 본문) | yes | 초대할 사람 번호 목록 |

```sh
curl -H "Authorization: Bearer $ZENTA_TOKEN" -H "Content-Type: application/json" -d '{"user_ids":["123","456"]}' "$ZENTA_URL/api/v1/streams/123/invite"
```

### `POST /api/v1/streams/{id}/leave`

채널에서 나가기(글은 그대로 남아요) · scope: `chat:write`

| Field | Where | Required | Description |
|---|---|---|---|
| `id` | path (주소 안) | yes | 채널 번호 |

```sh
curl -H "Authorization: Bearer $ZENTA_TOKEN" -X POST "$ZENTA_URL/api/v1/streams/123/leave"
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

알림함 읽기(source 로 고른 곳의 읽기 권한이 있어야 해요) · scope: by `source` — `board` needs `issue:read`, `chat` needs `chat:read`, `doc` needs `doc:read`

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

알림 하나를 읽음으로(source 로 고른 곳의 쓰기 권한이 있어야 해요) · scope: by `source` — `board` needs `issue:write`, `chat` needs `chat:write`, `doc` needs `doc:write`

| Field | Where | Required | Description |
|---|---|---|---|
| `id` | path (주소 안) | yes | 알림 번호(알림함 읽기의 id) |
| `source` | query (주소 뒤 ?) | yes | 그 알림을 읽은 곳과 같은 값. board(issue:write) · doc(doc:write) · chat(chat:write) 중 하나 |

```sh
curl -H "Authorization: Bearer $ZENTA_TOKEN" -X POST "$ZENTA_URL/api/hub/notifications/NOTICEID/read?source=board"
```

### `POST /api/hub/notifications/read-all`

고른 곳의 알림을 모두 읽음으로(source 로 고른 곳의 쓰기 권한이 있어야 해요) · scope: by `source` — `board` needs `issue:write`, `chat` needs `chat:write`, `doc` needs `doc:write`

| Field | Where | Required | Description |
|---|---|---|---|
| `source` | query (주소 뒤 ?) | yes | board(이슈 알림, issue:write) · doc(문서 알림, doc:write) · chat(채팅 알림, chat:write) 중 하나 |

```sh
curl -H "Authorization: Bearer $ZENTA_TOKEN" -X POST "$ZENTA_URL/api/hub/notifications/read-all?source=board"
```

### `POST /api/hub/notifications/{id}/unread`

알림 하나를 안 읽음으로(source 로 고른 곳의 쓰기 권한이 있어야 해요) · scope: by `source` — `board` needs `issue:write`, `chat` needs `chat:write`, `doc` needs `doc:write`

| Field | Where | Required | Description |
|---|---|---|---|
| `id` | path (주소 안) | yes | 알림 번호(알림함 읽기의 id) |
| `source` | query (주소 뒤 ?) | yes | 그 알림을 읽은 곳과 같은 값. board(issue:write) · doc(doc:write) · chat(chat:write) 중 하나 |

```sh
curl -H "Authorization: Bearer $ZENTA_TOKEN" -X POST "$ZENTA_URL/api/hub/notifications/NOTICEID/unread?source=board"
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

### `POST /api/hub/wiki/{id}/copy`

문서 복사하기(같은 곳이나 다른 프로젝트로, 한 번에 200장까지이고 사본 수만큼 쓰기 한도에서 빠져요) · scope: `doc:write`

| Field | Where | Required | Description |
|---|---|---|---|
| `id` | path (주소 안) | yes | 복사할 문서 번호 |
| `projectId` | query (주소 뒤 ?) |  | 그 문서가 있는 프로젝트 번호 또는 키. projectId · scope 중 하나는 필수예요 |
| `scope` | query (주소 뒤 ?) |  | org 면 회사 문서 |
| `toProjectId` | json (JSON 본문) |  | 복사해 둘 프로젝트 번호 또는 키. toProjectId · toScope 중 하나는 필수예요 |
| `toScope` | json (JSON 본문) |  | org 면 회사 문서로 |
| `parentId` | json (JSON 본문) |  | 이 문서 아래에 두기(없으면 맨 위) |
| `withChildren` | json (JSON 본문) |  | true 면 하위 문서도 함께 |

```sh
curl -H "Authorization: Bearer $ZENTA_TOKEN" -H "Content-Type: application/json" -d '{"toProjectId":"ZEN","withChildren":true}' "$ZENTA_URL/api/hub/wiki/123/copy?projectId=ZEN"
```

### `PUT /api/hub/wiki/{id}/labels`

문서 라벨 바꾸기(목록이 통째로 바뀌어요) · scope: `doc:write`

| Field | Where | Required | Description |
|---|---|---|---|
| `id` | path (주소 안) | yes | 문서 번호 |
| `projectId` | query (주소 뒤 ?) |  | 프로젝트 번호 또는 키. projectId · scope 중 하나는 필수예요 |
| `scope` | query (주소 뒤 ?) |  | org 면 회사 문서 |
| `labelIds` | json (JSON 본문) | yes | 붙일 라벨 번호 목록(빈 목록이면 다 떼요) |

```sh
curl -H "Authorization: Bearer $ZENTA_TOKEN" -X PUT -H "Content-Type: application/json" -d '{"labelIds":["123"]}' "$ZENTA_URL/api/hub/wiki/123/labels?projectId=ZEN"
```

### `POST /api/hub/wiki-folders`

문서 폴더 만들기 · scope: `doc:write`

| Field | Where | Required | Description |
|---|---|---|---|
| `projectId` | json (JSON 본문) |  | 프로젝트 번호 또는 키. projectId · scope 중 하나는 필수예요 |
| `scope` | json (JSON 본문) |  | org 면 회사 문서 |
| `title` | json (JSON 본문) | yes | 폴더 이름 |
| `parentId` | json (JSON 본문) |  | 이 폴더 아래에 두기(없으면 맨 위) |

```sh
curl -H "Authorization: Bearer $ZENTA_TOKEN" -H "Content-Type: application/json" -d '{"projectId":"ZEN","title":"회의록"}' "$ZENTA_URL/api/hub/wiki-folders"
```

### `PATCH /api/hub/wiki-folders/{id}`

문서 폴더 이름 바꾸기 · scope: `doc:write`

| Field | Where | Required | Description |
|---|---|---|---|
| `id` | path (주소 안) | yes | 폴더 번호 |
| `projectId` | json (JSON 본문) |  | 프로젝트 번호 또는 키. projectId · scope 중 하나는 필수예요 |
| `scope` | json (JSON 본문) |  | org 면 회사 문서 |
| `title` | json (JSON 본문) | yes | 새 이름 |

```sh
curl -H "Authorization: Bearer $ZENTA_TOKEN" -X PATCH -H "Content-Type: application/json" -d '{"projectId":"ZEN","title":"주간 회의록"}' "$ZENTA_URL/api/hub/wiki-folders/123"
```

### `POST /api/hub/wiki/{id}/favorite`

문서를 내 즐겨찾기에 넣기 또는 빼기 · scope: `doc:write`

| Field | Where | Required | Description |
|---|---|---|---|
| `id` | path (주소 안) | yes | 문서 번호 |
| `projectId` | json (JSON 본문) |  | 프로젝트 번호 또는 키. projectId · scope 중 하나는 필수예요 |
| `scope` | json (JSON 본문) |  | org 면 회사 문서 |
| `favorite` | json (JSON 본문) | yes | true 면 넣기, false 면 빼기 |

```sh
curl -H "Authorization: Bearer $ZENTA_TOKEN" -H "Content-Type: application/json" -d '{"projectId":"ZEN","favorite":true}' "$ZENTA_URL/api/hub/wiki/123/favorite"
```

### `GET /api/hub/wiki/{id}/watch`

내가 이 문서를 지켜보고 있는지 · scope: `doc:read`

| Field | Where | Required | Description |
|---|---|---|---|
| `id` | path (주소 안) | yes | 문서 번호 |
| `projectId` | query (주소 뒤 ?) |  | 프로젝트 번호 또는 키. projectId · scope 중 하나는 필수예요 |
| `scope` | query (주소 뒤 ?) |  | org 면 회사 문서 |

```sh
curl -H "Authorization: Bearer $ZENTA_TOKEN" "$ZENTA_URL/api/hub/wiki/123/watch?projectId=ZEN"
```

### `POST /api/hub/wiki/{id}/watch`

문서 지켜보기 켜기 또는 끄기(바뀌면 알림을 받아요) · scope: `doc:write`

| Field | Where | Required | Description |
|---|---|---|---|
| `id` | path (주소 안) | yes | 문서 번호 |
| `projectId` | query (주소 뒤 ?) |  | 프로젝트 번호 또는 키. projectId · scope 중 하나는 필수예요 |
| `scope` | query (주소 뒤 ?) |  | org 면 회사 문서 |
| `watching` | json (JSON 본문) | yes | true 면 켜기, false 면 끄기 |

```sh
curl -H "Authorization: Bearer $ZENTA_TOKEN" -H "Content-Type: application/json" -d '{"watching":true}' "$ZENTA_URL/api/hub/wiki/123/watch?projectId=ZEN"
```

### `GET /api/hub/wiki/templates`

문서 템플릿 목록 · scope: `doc:read`

| Field | Where | Required | Description |
|---|---|---|---|
| `projectId` | query (주소 뒤 ?) |  | 프로젝트 번호 또는 키. projectId · scope 중 하나는 필수예요 |
| `scope` | query (주소 뒤 ?) |  | org 면 회사 문서 |

```sh
curl -H "Authorization: Bearer $ZENTA_TOKEN" "$ZENTA_URL/api/hub/wiki/templates?projectId=ZEN"
```

### `POST /api/hub/wiki/{id}/undelete`

휴지통의 문서 되살리기 · scope: `doc:write`

| Field | Where | Required | Description |
|---|---|---|---|
| `id` | path (주소 안) | yes | 문서 번호 |
| `projectId` | json (JSON 본문) |  | 프로젝트 번호 또는 키. projectId · scope 중 하나는 필수예요 |
| `scope` | json (JSON 본문) |  | org 면 회사 문서 |

```sh
curl -H "Authorization: Bearer $ZENTA_TOKEN" -H "Content-Type: application/json" -d '{"projectId":"ZEN"}' "$ZENTA_URL/api/hub/wiki/123/undelete"
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

### `GET /api/hub/wiki/{id}/comments`

문서에 달린 코멘트 묶음(문단마다, 답글 포함) · scope: `doc:read`

| Field | Where | Required | Description |
|---|---|---|---|
| `id` | path (주소 안) | yes | 문서 번호 |
| `projectId` | query (주소 뒤 ?) |  | 프로젝트 문서면 프로젝트 번호나 키(회사 문서면 scope=org) |
| `scope` | query (주소 뒤 ?) |  | 회사 문서면 org |

```sh
curl -H "Authorization: Bearer $ZENTA_TOKEN" "$ZENTA_URL/api/hub/wiki/DOCID/comments?projectId=ZEN"
```

### `POST /api/hub/wiki/{id}/comments`

문서의 문단에 코멘트 달기(열린 코멘트는 한 문서에 200개까지) · scope: `doc:write`

| Field | Where | Required | Description |
|---|---|---|---|
| `id` | path (주소 안) | yes | 문서 번호 |
| `projectId` | query (주소 뒤 ?) |  | 프로젝트 문서면 프로젝트 번호나 키(회사 문서면 scope=org) |
| `scope` | query (주소 뒤 ?) |  | 회사 문서면 org |
| `blockId` | json (JSON 본문) | yes | 코멘트를 붙일 문단의 번호(문서를 읽을 때 doc.blocks 의 id) |
| `x` | json (JSON 본문) | yes | 문단 안 가로 자리(0 에서 1 사이, 모르면 0) |
| `y` | json (JSON 본문) | yes | 문단 안 세로 자리(0 에서 1 사이, 모르면 0) |
| `body` | json (JSON 본문) | yes | 코멘트(4,000자까지) |

```sh
curl -H "Authorization: Bearer $ZENTA_TOKEN" -H "Content-Type: application/json" -d '{"blockId":"b1","x":0,"y":0,"body":"이 숫자를 확인해 주세요"}' "$ZENTA_URL/api/hub/wiki/DOCID/comments?projectId=ZEN"
```

### `POST /api/hub/wiki/{id}/comments/{thread}/replies`

문서 코멘트에 답글 달기 · scope: `doc:write`

| Field | Where | Required | Description |
|---|---|---|---|
| `id` | path (주소 안) | yes | 문서 번호 |
| `projectId` | query (주소 뒤 ?) |  | 프로젝트 문서면 프로젝트 번호나 키(회사 문서면 scope=org) |
| `scope` | query (주소 뒤 ?) |  | 회사 문서면 org |
| `thread` | path (주소 안) | yes | 코멘트 묶음 번호(코멘트를 읽을 때 받은 id) |
| `body` | json (JSON 본문) | yes | 답글(4,000자까지) |

```sh
curl -H "Authorization: Bearer $ZENTA_TOKEN" -H "Content-Type: application/json" -d '{"body":"고쳤어요"}' "$ZENTA_URL/api/hub/wiki/DOCID/comments/THREADID/replies?projectId=ZEN"
```

### `POST /api/hub/wiki/{id}/comments/{thread}/resolve`

문서 코멘트를 해결로 닫거나 다시 열기 · scope: `doc:write`

| Field | Where | Required | Description |
|---|---|---|---|
| `id` | path (주소 안) | yes | 문서 번호 |
| `projectId` | query (주소 뒤 ?) |  | 프로젝트 문서면 프로젝트 번호나 키(회사 문서면 scope=org) |
| `scope` | query (주소 뒤 ?) |  | 회사 문서면 org |
| `thread` | path (주소 안) | yes | 코멘트 묶음 번호(코멘트를 읽을 때 받은 id) |
| `resolved` | json (JSON 본문) | yes | true 면 해결로 닫고 false 면 다시 열어요 |

```sh
curl -H "Authorization: Bearer $ZENTA_TOKEN" -H "Content-Type: application/json" -d '{"resolved":true}' "$ZENTA_URL/api/hub/wiki/DOCID/comments/THREADID/resolve?projectId=ZEN"
```

### `GET /api/hub/wiki/{id}/revisions`

문서의 판 이력(누가 언제 고쳤는지, 새 판부터) · scope: `doc:read`

| Field | Where | Required | Description |
|---|---|---|---|
| `id` | path (주소 안) | yes | 문서 번호 |
| `projectId` | query (주소 뒤 ?) |  | 프로젝트 문서면 프로젝트 번호나 키(회사 문서면 scope=org) |
| `scope` | query (주소 뒤 ?) |  | 회사 문서면 org |
| `cursor` | query (주소 뒤 ?) |  | 다음 쪽(앞 답의 nextCursor) |
| `limit` | query (주소 뒤 ?) |  | 한 번에 받을 판 수 |

```sh
curl -H "Authorization: Bearer $ZENTA_TOKEN" "$ZENTA_URL/api/hub/wiki/DOCID/revisions?projectId=ZEN"
```

### `GET /api/hub/wiki/{id}/revisions/{rev}`

문서의 옛 판 하나(그때의 제목과 본문) · scope: `doc:read`

| Field | Where | Required | Description |
|---|---|---|---|
| `id` | path (주소 안) | yes | 문서 번호 |
| `projectId` | query (주소 뒤 ?) |  | 프로젝트 문서면 프로젝트 번호나 키(회사 문서면 scope=org) |
| `scope` | query (주소 뒤 ?) |  | 회사 문서면 org |
| `rev` | path (주소 안) | yes | 판 번호(판 이력의 revision) |

```sh
curl -H "Authorization: Bearer $ZENTA_TOKEN" "$ZENTA_URL/api/hub/wiki/DOCID/revisions/3?projectId=ZEN"
```
