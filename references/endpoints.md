<!-- Generated from the Zenta server's supported-API table. Do not edit by hand. -->

# Zenta API reference

Every request sends `Authorization: Bearer $ZENTA_TOKEN` to `$ZENTA_URL`. A token can call only the endpoints below, only with the scopes it was given, and never more than its owner may do in the web app.

## Scopes

| Scope | 화면 이름 |
|---|---|
| `issue:read` | 이슈 보기 |
| `issue:write` | 이슈 만들기·고치기 |
| `chat:read` | 채팅 읽기 |
| `chat:write` | 채팅 보내기 |
| `doc:read` | 문서 보기 |
| `doc:write` | 문서 쓰기 |

An endpoint with no scope works with any personal token (bot tokens: `chat:write` only).

## Refusals

| Status | `code` | Meaning |
|---|---|---|
| 401 | `UNAUTHORIZED` | Token missing, wrong, revoked or expired — make a new token. |
| 403 | `TOKEN_SCOPE` | The token lacks the scope this endpoint needs. |
| 403 | `TOKEN_ROUTE` | This endpoint is not open to tokens at all. |
| 403 | `TOKEN_POLICY_OFF` | An org admin turned personal API tokens off. |
| 403 | `FORBIDDEN` | The token owner may not do this (same rule as the web app). |
| 404 | `NOT_FOUND` | Missing, or the owner cannot see it (the two look the same on purpose). |
| 409 | `ISSUE_CONFLICT` | Someone changed the field since you read it (`base` did not match). Re-read, then ask. |
| 429 | `TOO_MANY_REQUESTS` | Slow down; wait `Retry-After` seconds. |

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
| `title` | json (JSON 본문) | yes | 제목 |
| `description` | json (JSON 본문) |  | 설명(마크다운) |
| `assigneeIds` | json (JSON 본문) |  | 담당자 번호 목록 |
| `priority` | json (JSON 본문) |  | 우선순위(0~4 정수) |
| `statusId` | json (JSON 본문) |  | 상태 번호(없으면 첫 상태) |
| `startDate` | json (JSON 본문) |  | 시작일(YYYY-MM-DD) |
| `dueDate` | json (JSON 본문) |  | 마감일(YYYY-MM-DD) |

```sh
curl -H "Authorization: Bearer $ZENTA_TOKEN" -H "Content-Type: application/json" -d '{"projectId":"ZEN","title":"배포 실패 확인"}' "$ZENTA_URL/api/hub/issues"
```

### `POST /api/hub/issues/{taskId}`

이슈 고치기(보낸 칸만 바뀌어요) · scope: `issue:write`

| Field | Where | Required | Description |
|---|---|---|---|
| `taskId` | path (주소 안) | yes | 이슈 키(예: ZEN-12) 또는 번호 |
| `projectId` | json (JSON 본문) | yes | 그 이슈의 프로젝트 번호 또는 키 |
| `patch` | json (JSON 본문) | yes | 바꿀 칸만 담은 객체(예: {"title":"새 제목"}). 칸: title · description · status(상태 번호) · assignees(사람 번호 목록) · priority(0~4) · startDate · dueDate |
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
| `body` | json (JSON 본문) | yes | 코멘트(마크다운) |

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

채널에 메시지 보내기(봇 토큰은 봇이 든 채널에만) · scope: `chat:write`

| Field | Where | Required | Description |
|---|---|---|---|
| `to` | form (폼 본문) | yes | 채널 번호 또는 이름 |
| `content` | form (폼 본문) | yes | 보낼 글(마크다운) |
| `parent_id` | form (폼 본문) |  | 답글을 달 메시지 번호 |

```sh
curl -H "Authorization: Bearer $ZENTA_TOKEN" --data-urlencode "to=배포알림" --data-urlencode "content=배포가 끝났어요" "$ZENTA_URL/api/v1/messages"
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

문서 만들기(본문은 doc 트리로 — body 만 보내면 거절돼요) · scope: `doc:write`

| Field | Where | Required | Description |
|---|---|---|---|
| `projectId` | json (JSON 본문) |  | 프로젝트 번호 또는 키(회사 문서면 빼고 scope 를 org 로) |
| `scope` | json (JSON 본문) |  | 회사 문서면 org |
| `title` | json (JSON 본문) | yes | 제목 |
| `doc` | json (JSON 본문) | yes | 문서 내용(트리) — 이것이 문서의 정본이에요. 없으면 「문서 내용이 비어 있어요」로 거절돼요. 가장 작은 모양: {"v":1,"eol":false,"blocks":[{"id":"b1","kind":"paragraph","spans":[{"kind":"text","text":"글"}]}]} (블록 id 는 비지 않고 겹치지 않게). 스킬 도우미(zenta.mjs)의 --markdown 이 마크다운에서 만들어 줘요 |
| `body` | json (JSON 본문) |  | doc 과 같은 내용의 마크다운(검색·판 비교에 써요). doc 만 바꾸고 body 를 안 맞추면 검색이 틀어져요 |
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
| `title` | json (JSON 본문) | yes | 제목 |
| `doc` | json (JSON 본문) | yes | 바꾼 뒤의 문서 내용 전체(트리) — 통째로 바꿔요. 덧붙이려면 읽은 doc.blocks 뒤에 블록을 더해 보내요. 없으면 「문서 내용이 비어 있어요」로 거절돼요. 가장 작은 모양: {"v":1,"eol":false,"blocks":[{"id":"b1","kind":"paragraph","spans":[{"kind":"text","text":"글"}]}]} (블록 id 는 비지 않고 겹치지 않게). 스킬 도우미(zenta.mjs)의 --markdown 이 마크다운에서 만들어 줘요 |
| `body` | json (JSON 본문) | yes | doc 과 같은 내용의 마크다운 전체(검색·판 비교에 써요) |
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
