# Zenta API recipes

`$Z` below means `node <skill folder>/scripts/zenta.mjs`. Every recipe lists the scope it needs.
Answers are JSON; ids are big numbers sent as strings. Every refusal is `{"result":"error","msg":"…","code":"…"}`.

## Who am I · which projects (any token / `issue:read`)

```sh
$Z check                         # personal token: owner's id (user.id) and name · bot token: «봇 토큰이에요»
$Z GET /api/hub/projects         # [{id, key, name, …}] — use key (e.g. ZEN) as projectId
```

## Find issues (`issue:read`)

```sh
$Z GET /api/hub/issues --query projectId=ZEN --query search=로그인            # words in title or key
$Z GET /api/hub/issues --query mine=1 --query statusCategories=todo,doing     # my open issues, all projects
$Z GET /api/hub/issues --query projectId=ZEN --query limit=50 --query offset=50
$Z GET /api/hub/issues/ZEN-12                                                 # one issue with comments
```

- One of `projectId` · `planId` · `mine=1` · `assigneeId` is required.
- Pages: `limit` (default 50, max 200). If the answer has `"hasMore": true`, ask again with `offset=<nextOffset>`.
- Status categories: `todo` · `doing` · `hold` · `done` · `closed`.

## Create an issue (`issue:write`)

```sh
$Z POST /api/hub/issues --json '{"projectId":"ZEN","title":"배포 실패 확인","description":"로그를 붙였어요","priority":2,"dueDate":"2026-11-20"}'
```

- Answer: the new issue (`key`, `id`, …). Tell the user the key (e.g. `ZEN-31`).
- If `partialFailures` is not empty, the issue exists but those fields were not saved — tell the user which and why
  (`message`), do not create it again.
- `priority` is 0–4. `assigneeIds` takes person ids (see «Assign»).
- Optional: `parentId` (make it a sub-issue of that issue — key or id), `typeId` (`/api/hub/fields/types`),
  `labelIds` (`/api/hub/labels`), `storyPoints` or `estimateMinutes` (whichever the project estimates in).

## Comment (`issue:write`)

```sh
$Z POST /api/hub/issues/ZEN-12/comments --json '{"projectId":"ZEN","body":"원인을 찾았어요. **설정 파일**이 빠졌어요"}'
```

Confirm the text with the user first — everyone watching the issue is notified.

## Change fields safely (`issue:write`)

1. Read: `$Z GET /api/hub/issues/ZEN-12`.
2. Send only what changes in `patch`, and the values you read in `base`:

```sh
$Z POST /api/hub/issues/ZEN-12 --json '{"projectId":"ZEN","patch":{"title":"새 제목","priority":1},"base":{"title":"옛 제목","priority":0}}'
```

- `409 ISSUE_CONFLICT`: someone changed it after you read. The answer's `conflict` says which field, who and their
  value. Show it to the user and ask before sending again.
- Fields: `title` · `description` · `status` · `assignees` · `priority` · `startDate` · `dueDate` · `labels` ·
  `issueType` · `storyPoints` · `estimateMinutes`.
- One token may send at most 120 writes per minute (issues, comments, fields, sprints, groups, documents — chat
  posts have their own limit of 30). The next one gets `429 RATE_LIMITED` with `Retry-After`; wait that long
  (`--retry` does) instead of retrying at once.
- `{"noLongerVisible": true}` means the change hid the issue from you (e.g. you removed yourself); it was saved.

## Change status (`issue:read` + `issue:write`)

```sh
$Z GET /api/hub/workflow/states --query projectId=ZEN            # states: [{id, name, category, …}]
$Z POST /api/hub/workflow/can-transition --json '{"projectId":"ZEN","toStateId":"<id>","issueIds":["ZEN-12"]}'
$Z POST /api/hub/issues/ZEN-12 --json '{"projectId":"ZEN","patch":{"status":"<id>"},"base":{"status":"<current id>"}}'
```

- Pick the state by name or `category` (`done` for «완료»). Use the issue's type (`?issueType=`) when the project
  has a different workflow per type.
- `can-transition` changes nothing; it says `allowed` and, if not, the `reason`/`message` (a required field, a rule).
  Tell the user instead of forcing it.

## Assign or unassign (`issue:read` + `issue:write`)

```sh
$Z GET /api/hub/users/search --query projectId=ZEN --query members=true --query q=김민수   # project members (no emails)
$Z POST /api/hub/issues/ZEN-12 --json '{"projectId":"ZEN","patch":{"assignees":["<person id>"]}}'
$Z POST /api/hub/issues/ZEN-12 --json '{"projectId":"ZEN","patch":{"assignees":[]}}'            # unassign all
```

- Without `members=true` the list is everyone in the company the owner may pick on screen; for assigning, prefer
  project members.
- `assignees` is the whole new list — read the issue first and keep the people who should stay.
- Several people share a name: show the user the matches (name, department) and ask which one.
- `403 FORBIDDEN` «담당자를 지정할 권한이 없어요»: the token owner's project role may not assign.

## Custom fields (`issue:read` / `issue:write`)

```sh
$Z GET /api/hub/fields/definitions --query projectId=ZEN     # [{id, name, type, options, …}]
$Z GET /api/hub/fields/values/ZEN-12
$Z POST /api/hub/fields/values/ZEN-12 --json '{"values":[{"fieldId":"<id>","value":"높음"}]}'
```

## Labels, sprints, groups, sub-issues (`issue:read` / `issue:write`)

Look the thing up first, then send its `id`. Sprint and group writes take the issue's **`id`** (the number you get
when you read the issue), not its key.

```sh
$Z GET /api/hub/labels                                         # {labels: [{id, name, color}]}
$Z POST /api/hub/issues/ZEN-12 --json '{"projectId":"ZEN","patch":{"labels":["<label id>","<label id>"]},"base":{"labels":["<label id>"]}}'

$Z GET /api/hub/sprints --query projectId=ZEN                  # [{id, name, state, startsAt, endsAt, …}]
$Z POST /api/hub/sprints/<sprint id>/issues --json '{"projectId":"ZEN","issueIds":["<issue id>"]}'

$Z GET /api/hub/issue-groups --query projectId=ZEN             # {groups: [{id, name, color, issueCount}]}
$Z POST /api/hub/issue-groups/<group id>/issues --query projectId=ZEN --json '{"issueIds":["<issue id>"]}'
$Z POST /api/hub/issue-groups/none/issues --query projectId=ZEN --json '{"issueIds":["<issue id>"]}'   # out of any group

$Z GET /api/hub/issues/ZEN-12/subtasks --query projectId=ZEN   # {subtasks: [{id, key, title, status, assignees, children: […]}]}
$Z POST /api/hub/issues --json '{"projectId":"ZEN","title":"로그인 오류 문구 정리","parentId":"ZEN-12"}'   # new sub-issue
$Z POST /api/hub/issues/ZEN-12/subtasks --json '{"projectId":"ZEN","childId":"ZEN-13"}'                 # existing issue → sub-issue
```

- `labels` in a patch **replaces the whole list**: send every label the issue should keep; `[]` removes all.
- Putting an issue into a sprint **moves** it out of the sprint it was in. An issue is in one group at a time.
- All of these writes need the token owner to be allowed to edit issues in that project (`403 FORBIDDEN` otherwise).
  A finished sprint takes no new issues (`400`).
- A group move answers `{"moved": n}`. If `n` is smaller than the number you sent, some issues were skipped (not
  visible to the owner, or in another project) — tell the user how many moved, not «all done».
- `POST …/subtasks` on an issue that already has a parent **moves** it under the new parent. The parent must be in
  the same project (also for `parentId` when creating; otherwise the issue is created and `partialFailures` says so).
- Label ids must exist: an unknown id or a label *name* answers `400`. On create, a label the owner may not set is
  left off and reported in `partialFailures`.
- **Taking things out** (confirm with the user first; the helper wants `--yes` on a `DELETE`). Nothing is deleted —
  the issues stay, and putting them back restores the link:

  ```sh
  $Z DELETE /api/hub/sprints/<sprint id>/issues/ZEN-12 --query projectId=ZEN --yes    # back to the backlog (204)
  $Z DELETE /api/hub/issues/ZEN-12/subtasks/ZEN-13 --query projectId=ZEN --yes        # ZEN-13 is no longer under ZEN-12 (204)
  ```

  An issue that is not in that sprint, or not a sub-issue of that parent, answers `404`. A finished sprint cannot
  be changed (`400`). Leaving a group is the `none` call above.
- Creating, renaming or deleting labels, sprints and groups is done in Zenta, not with a token.

## Read and search documents (`doc:read`)

```sh
$Z GET /api/hub/wiki --query projectId=ZEN                      # page tree of a project
$Z GET /api/hub/wiki --query scope=org                          # company documents
$Z GET /api/hub/wiki/search --query scope=all --query q=온보딩  # everything you may see
$Z GET /api/hub/wiki/<id> --query projectId=ZEN                 # one page: title, body (markdown), revision
```

## Write documents (`doc:write`)

The page content is the `doc` field (a block tree, see `references/endpoints.md`); `body` is its markdown mirror.
A write without `doc` is refused. Write the content as a markdown file and let the helper build both:

```sh
$Z POST /api/hub/wiki --json '{"projectId":"ZEN","title":"배포 절차"}' --markdown deploy.md
$Z PUT  /api/hub/wiki/<id> --json '{"projectId":"ZEN","revision":3}' --append-markdown more.md   # add to the end
$Z PUT  /api/hub/wiki/<id> --json '{"projectId":"ZEN","revision":3}' --markdown whole.md         # replace all
$Z POST /api/hub/wiki/<id>/move --query projectId=ZEN --json '{"toProjectId":"ZEN","parentId":"<parent id>"}'
```

- Moving: `toProjectId` (or `"toScope":"org"`) is always needed, even inside the same project; leave out `parentId`
  to move to the top.
- For company documents use `"scope":"org"` instead of `projectId` (in the JSON, and `--query scope=org` for reads).
- `revision` is the number you got when you read the page. A different number means someone saved in between: `409`.
  Re-read and ask the user.
- The helper understands headings, paragraphs, lists (numbered, nested, to-do `- [ ]`), quotes, code blocks, rules,
  tables, **bold**, *italic*, ~~strike~~, `code` and links. Pages that hold other things (cards, columns, files,
  embeds) are refused by `--markdown` (replacing would drop them); use `--append-markdown`, or ask the user to edit
  in Zenta.
- **Deleting documents is not possible with a token.** Tell the user to delete it in Zenta.

## Chat: read and post (`chat:read` / `chat:write`)

```sh
$Z GET /api/v1/streams                                                         # channels you are in
$Z GET /api/v1/messages --query 'narrow=[{"operator":"stream","operand":"배포알림"}]' --query anchor=newest --query num_before=20
$Z POST /api/v1/messages --form to=배포알림 --form content='배포가 끝났어요 ✅'
$Z POST /api/v1/messages --form to=배포알림 --form content='확인했어요' --form parent_id=<message id>   # reply
```

Posting notifies people — confirm the channel and text first. Blank messages and messages over 10,000 characters
are refused (`400`). One token may post at most 30 messages per minute (the first 30 go at once); the 31st gets
`429 RATE_LIMITED` with `Retry-After` = seconds until a slot frees. Wait that long (`--retry` does), then send the
rest — or put many lines into one message instead.

## Post as a bot (`bot token`)

An org admin makes a bot (설정 › 연동과 접수 › 연동 › 봇) and its token. A bot token only posts, and only to the
channels the admin put the bot in. `$Z check` answers «봇 토큰이에요» for it (that is a success). Use it exactly like
`POST /api/v1/messages` above with `ZENTA_TOKEN` set to the bot token. A message shows the bot's name.

## Incoming webhook (no token)

For a script that only needs to drop a line into one channel, an admin can add an **incoming webhook** to a bot and
copy its address (shown once). The address itself is the secret:

```sh
curl -X POST -H 'Content-Type: application/json' -d '{"text":"배포가 끝났어요"}' "$ZENTA_HOOK_URL"
```

At most 30 messages per minute per bot (then `429 RATE_LIMITED` with `Retry-After`), 10,000 characters each.

## Outgoing webhooks (Zenta calls you)

Admins set these up in 설정 › 연동과 접수 › 웹훅. Zenta `POST`s JSON to your address with headers
`X-Zenta-Event`, `X-Zenta-Timestamp` and `X-Zenta-Signature` = hex HMAC-SHA256 of `"<timestamp>.<raw body>"` with
the webhook's secret. Verify it and reject old timestamps:

```js
import { createHmac, timingSafeEqual } from 'node:crypto'
function verify(secret, headers, rawBody, maxAgeSec = 300) {
  const ts = headers['x-zenta-timestamp']
  if (!ts || Math.abs(Date.now() / 1000 - Number(ts)) > maxAgeSec) return false
  const want = createHmac('sha256', secret).update(`${ts}.${rawBody}`).digest('hex')
  const got = String(headers['x-zenta-signature'] ?? '')
  return got.length === want.length && timingSafeEqual(Buffer.from(got), Buffer.from(want))
}
```

Events include `issue.created`, `issue.updated`, `issue.assigned`, `issue.transition`, `issue.deleted`,
`comment.created` and `message.created`. Each issue event carries `key`, `title`, `projectKey`, `actorId`, `actorName`.
