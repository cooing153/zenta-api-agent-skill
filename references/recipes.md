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
- Deleting labels, sprints and groups is done in Zenta, not with a token.

## Make and change groups, labels, sprints (`issue:write`)

```sh
$Z POST /api/hub/issue-groups --query projectId=ZEN --json '{"name":"백엔드","color":"blue"}'       # → {id, name, color, …}
$Z PATCH /api/hub/issue-groups/<group id> --query projectId=ZEN --json '{"name":"서버"}'
$Z PUT /api/hub/issue-groups/order --query projectId=ZEN --json '{"order":["<group id>","<group id>"]}'   # 204
$Z GET /api/hub/issue-groups/<group id>/issues --query projectId=ZEN                                 # {issueIds: […]}
$Z POST /api/hub/issues --json '{"projectId":"ZEN","title":"로그인 오류 고치기","groupId":"<group id>"}'   # new issue, already in the group

$Z POST /api/hub/labels --json '{"name":"긴급","color":"#d92d20"}'                                    # org admins only
$Z POST /api/hub/labels/<label id> --json '{"name":"아주 긴급"}'

$Z POST /api/hub/sprints --json '{"projectId":"ZEN","name":"11월 2주","startsAt":"2026-11-16","endsAt":"2026-11-27"}'
$Z POST /api/hub/sprints/<sprint id> --json '{"projectId":"ZEN","name":"11월 2주","startsAt":"2026-11-16","endsAt":"2026-11-30"}'
$Z POST '/api/hub/sprints/<sprint id>/start?projectId=ZEN'
$Z POST /api/hub/sprints/<sprint id>/complete --query projectId=ZEN --json '{"carryOverTo":"<next sprint id>"}'
$Z GET /api/hub/sprints/<sprint id>/issues --query projectId=ZEN
$Z GET /api/hub/sprints/backlog --query projectId=ZEN                                                # issues in no sprint: {items, hasMore, nextOffset}
```

- **Groups**: colors are `gray` `blue` `green` `amber` `red` `violet`. `order` must list **every** group of the
  project, each once — read the list first; anything else answers `400`. To add an issue to a group in one call,
  create it with `groupId`; if the group does not exist in that project the issue is still created, outside any
  group, and `partialFailures` says so.
- **Labels** belong to the whole organization, so only an organization admin's token may make or rename one
  (`403` otherwise). Check `GET /api/hub/labels` first — do not make a second label with the same meaning.
- **Sprints**: editing sends name and both dates together. Starting works on a sprint that has not started yet
  (a project may have several in progress). **Finishing a sprint cannot be undone**: issues that are not done go to `carryOverTo`, or out
  of any sprint when you leave it out — the answer says how many of them the owner can see (`carriedOver`). Confirm with the user before
  starting or finishing one.

## Releases, milestones, relations, time logs (`issue:read` / `issue:write`)

```sh
$Z GET /api/hub/releases --query projectId=ZEN                 # [{id, name, state: unreleased|released, issueCount, doneCount}]
$Z GET /api/hub/releases/<release id>/issues --query projectId=ZEN
$Z POST /api/hub/releases/<release id>/issues --query projectId=ZEN --json '{"issueIds":["<issue id>"]}'   # {added: n}

$Z GET /api/hub/milestones --query projectId=ZEN               # {milestones: [{id, name, state, issueCount}]}
$Z GET /api/hub/milestones/<milestone id>/issues --query projectId=ZEN   # {issues: […], nextCursor?}
$Z POST /api/hub/milestones/<milestone id>/issues --query projectId=ZEN --json '{"issueId":"ZEN-12"}'     # 204

$Z GET /api/hub/issues/ZEN-12/relations --query projectId=ZEN  # {relations: [{kind, issue: {id, key, title, status}}]}
$Z POST /api/hub/issues/ZEN-12/relations --json '{"projectId":"ZEN","otherId":"ZEN-13","kind":"blocking"}'

$Z GET /api/hub/timelogs --query issueId=ZEN-12                # [{id, minutes, workedOn, note, user}]
$Z POST /api/hub/timelogs --json '{"issueId":"ZEN-12","minutes":90,"note":"배포 스크립트 점검"}'             # 201
$Z PATCH /api/hub/timelogs/<time log id> --json '{"minutes":120,"workedOn":"2026-11-13","note":"배포 스크립트 점검"}'
```

- A release takes issue **ids** (a key is refused with `400`); a milestone takes one issue **key or id** per call.
  An issue is in one release at a time — putting it into a release moves it out of the unreleased one it was in.
  It can be in several milestones.
- `{"added": n}` counts what was newly put in: an issue already in the release, not in that project or not visible
  to the owner is skipped without an error — if `n` is smaller than what you sent, say so. A released release takes
  no more issues (`409 ALREADY_RELEASED`).
- Relation `kind` reads from the issue in the path: `blocking` = this issue blocks the other, `blocked` = it is
  blocked by the other, `duplicating` = this issue is the duplicate, `related` has no direction (`cloning`/`cloned`
  mark a copy). The other issue gets the matching relation by itself. Linking twice, linking an issue to itself or
  an unknown kind answers `409 CONFLICT` with the reason in the message — that is not «someone changed it», do not
  retry.
- A time log belongs to the token owner. `minutes` is 1 to 1440; `workedOn` is `YYYY-MM-DD` and defaults to today.
  Only an organization admin's token may log for someone else (`"userId"`) or edit another person's log — both are
  recorded as done on that person's behalf, so never do it without the user asking for exactly that.
- **`PATCH` replaces the whole log**: send `minutes`, `workedOn` and `note` together. A field you leave out is not
  kept — `workedOn` becomes today and `note` becomes empty. Read the log first and send back what should stay.
  The issue of a log cannot be changed. A log whose issue the owner can no longer see answers `404`, like a log
  that does not exist.
- Deleting a time log, a release or a milestone is not possible with a token — tell the user to do it in Zenta.

Make, change and take out:

```sh
$Z POST /api/hub/releases --json '{"projectId":"ZEN","name":"1.4.0","releaseDate":"2026-12-01"}'
$Z POST /api/hub/releases/<release id> --query projectId=ZEN --json '{"releaseDate":"2026-12-08"}'    # only the fields you send
$Z POST /api/hub/releases/<release id>/release --query projectId=ZEN --json '{"moveTo":"<next release id>"}'
$Z DELETE /api/hub/releases/<release id>/issues/ZEN-12 --query projectId=ZEN --yes

$Z POST /api/hub/milestones --query projectId=ZEN --json '{"name":"베타 공개","dueOn":"2026-12-15"}'
$Z GET /api/hub/milestones/<milestone id> --query projectId=ZEN
$Z POST /api/hub/milestones/<milestone id> --query projectId=ZEN --json '{"name":"베타 공개","dueOn":"2026-12-15","state":"reached"}'
$Z DELETE /api/hub/milestones/<milestone id>/issues/ZEN-12 --query projectId=ZEN --yes               # 204

$Z DELETE /api/hub/issues/ZEN-12/relations/blocking/ZEN-13 --query projectId=ZEN --yes                # 204
```

- **Shipping a release (`…/release`) cannot be undone**, and a shipped release can no longer be edited or have
  issues taken out. Issues that are not done move to `moveTo`, or out of any release when you leave it out. Always
  confirm with the user first.
- **Editing a milestone replaces all of it**: send `name`, `description`, `dueOn` and `state` together (`open` ·
  `reached` · `missed`). A field you leave out becomes empty and `state` goes back to `open` — read it first
  (`GET …/<milestone id>`). Editing a release changes only what you send.
- Taking an issue out of a release or milestone, or removing a relation, deletes nothing: the issues stay, and
  adding again restores it. Removing a relation uses the same `kind` it was made with, from the same side; one that
  is not there answers `404`.

## Attachments (`issue:read` / `issue:write`)

```sh
$Z GET /api/hub/issues/attachments/policy                      # {maxBytes, allowedExtensions, proxyMaxBytes}
$Z GET /api/hub/issues/ZEN-12/attachments                      # {attachments: [{id, publicId, name, size, uploadedBy, uploadedAt, downloadPath}]}
$Z GET /api/hub/issues/ZEN-12/attachments/<publicId>/download --out ./보고서.pdf   # saves the file; never overwrites
$Z POST /api/hub/issues/ZEN-12/attachments --file ./보고서.pdf   # 201 + one attachment, same shape as a list row
```

- Download with the row's **`publicId`** (not `id`). `downloadPath` is the same address without the `/api/hub` prefix.
  The helper saves the bytes to `--out` exactly as received; without `--out` it refuses (a file is not printed to the
  terminal). If Zenta hands the download over to its file store (`307`), the helper fetches that address **without
  the token**.
- One file per upload. Check `policy` first: a file over `maxBytes` is refused with `413`, an extension outside
  `allowedExtensions` or content that does not match the extension with `415`, other problems with `400`.
- Uploading shows up on the issue for everyone who can see it — confirm with the user first, and never upload a file
  that holds a token, a key or a password.
- Every download through Zenta is recorded under the token owner's name.
- **Deleting an attachment is not possible with a token** — tell the user to do it in Zenta.

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

## Chat: replies and reactions (`chat:read` / `chat:write`)

```sh
$Z GET /api/v1/messages/<message id>/replies                  # {messages: […]} oldest first
$Z GET /api/v1/messages/<message id>/replies --query after=<last reply id>   # the next ones
$Z GET /api/v1/messages/<message id>/reactions                # {reactions: [{emoji_name, users: [{user_id, full_name}]}]}
$Z POST /api/v1/messages/<message id>/reactions --form emoji_name=+1
$Z DELETE /api/v1/messages/<message id>/reactions --query emoji_name=+1 --yes   # take your own reaction off
$Z GET /api/v1/emoji                                          # every name the server accepts (about 3,000 — a large answer)
```

- Replies hang under a top-level message: ask with that message's id (a reply's own id answers `404`). To write a
  reply, post with `parent_id` (previous section).
- `emoji_name` is a name, not the character: `+1` `-1` `check` (✅ — `white_check_mark` is not a name here) `eyes`
  `tada` `heart` `pray` `rocket` `ok`. An unknown name is refused with `400`; look it up in `GET /api/v1/emoji`
  (`emoji` = built-in names, `custom` = the organization's own) only then.
- A reaction appears under the token owner's name. Adding the same one twice changes nothing. `DELETE` takes off
  the owner's own reaction of that name (not anyone else's); taking off one that is not there changes nothing.
- A message the owner cannot see answers `404`, like one that does not exist.

## Inbox (`issue:read` / `doc:read` / `chat:read`)

```sh
$Z GET /api/hub/notifications --query source=board --query unread=1    # issues — needs issue:read
$Z GET /api/hub/notifications --query source=doc --query unread=1      # documents — needs doc:read
$Z GET /api/hub/notifications --query source=chat --query unread=1     # mentions, direct messages, replies — needs chat:read
$Z POST '/api/hub/notifications/<notice id>/read?source=board'         # mark one read — needs issue:write (doc: doc:write · chat: chat:write)
```

- One `source` per call, and the token needs that source's read scope (`403 TOKEN_SCOPE` without it). No
  `source`, two of them or `source=all` answers `400` — to see everything, call once per source the token may read.
- `board` gives the notices about an issue (assigned, mentioned, commented, changed …). The other things a person
  sees in that tab — approval requests, import and export results, admin notices — do not come through a token.
  Only `source`, `unread`, `limit` and `offset` are accepted; any other field answers `400`.
- Answer: `{items: […], hasMore, unreadCount}`. `unreadCount` counts the chosen source only. An item has `id`,
  `kind`, `summary` (one line), `preview` (the text, when there is one), `actorName`, `createdAt`, `readAt` (null =
  unread), and where it points: `issueKey` + `projectKey` for an issue, `docPublicId` for a document,
  `channelId`/`dmId` + `messageId` for chat.
- `limit` (20 by default, up to 100) and `offset` page through it; `hasMore` says whether to go on. Unread items
  come first.
- **Reading changes nothing**: items stay unread for the person. Marking one read (`POST …/<id>/read?source=…`,
  `204`) needs the **write** scope of that source and the same `source` the item was listed under; it clears the
  item from the person's unread list, so do it only when the user asked you to handle or clear it. One item per
  call — marking everything read, marking unread and snoozing are not possible with a token. A number that is not in
  that source answers `204` too and changes nothing.

## Post as a bot (`bot token`)

An org admin makes a bot (설정 › 연동과 접수 › 연동 › 봇) and its token. A bot token only posts (no reading, no
reactions, no inbox), and only to the
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
