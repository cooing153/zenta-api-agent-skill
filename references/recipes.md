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

## Search by words (`issue:read`)

```sh
$Z GET /api/hub/search --query kind=issue --query q=로그인                       # {items: [{kind, id, key, title, …}]}
$Z GET /api/hub/search --query kind=comment --query q=배포 --query projectId=ZEN # comments that mention it
```

- `kind` is required and takes **one** value: `issue` or `comment`. Documents have their own search
  (`/api/hub/wiki/search`, `doc:read`).
- Only what the token owner can see comes back. Optional: `projectId`, `limit` (30 by default, up to 300), and
  `after` / `before` (`YYYY-MM-DD`; `after` includes that day, `before` stops before it). The dates compare an
  issue's **last change** but a comment's **creation** — an old comment edited today is not «after today». Other filters are refused with `400` — to filter by status, assignee
  or label use `GET /api/hub/issues` instead.

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

```sh
$Z POST /api/hub/issues/ZEN-12/comments/<comment id> --json '{"projectId":"ZEN","body":"원인은 **캐시**였어요"}'
```

Editing works only on a comment the token owner wrote (`403` otherwise); the id is in `comments` when you read the
issue. The new `body` replaces the old one. Deleting a comment is not possible with a token.

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
  posts have their own limit of 30; a bulk call counts once per issue in it). The next one gets `429 RATE_LIMITED` with `Retry-After`; wait that long
  (`--retry` does) instead of retrying at once.
- `{"noLongerVisible": true}` means the change hid the issue from you (e.g. you removed yourself); it was saved.

## Change several issues at once (`issue:write`)

```sh
$Z POST /api/hub/issues/bulk --json '{"projectId":"ZEN","issueIds":["ZEN-12","ZEN-13"],"priority":{"mode":"set","value":2}}'
$Z POST /api/hub/issues/bulk --json '{"projectId":"ZEN","issueIds":["ZEN-12","ZEN-13"],"labels":{"mode":"add","ids":["<label id>"]},"dueDate":{"mode":"set","value":"2026-12-01"}}'
$Z POST /api/hub/issues/bulk/move --json '{"projectId":"ZEN","toProjectId":"<target key>","items":[{"issueId":"ZEN-12","statusId":"<status id>"}]}'
```

- Watching works the same way: `$Z POST /api/hub/issues/bulk/watch --json '{"projectId":"ZEN","issueIds":["ZEN-12","ZEN-13"],"watch":true}'`
  (`"watch":false` stops watching).
- A token sends **at most 50 issues per call** (`400` above that — split the list), and every issue in the call
  counts as one write against the 120-per-minute limit: 50 issues are 50 writes. A call that does not fit answers
  `429 RATE_LIMITED` with `Retry-After` and changes nothing.
- One value fields (`status`, `priority`, `dueDate`, `startDate`) take `{"mode":"set","value":…}` with the same
  values as a single-issue change (`priority` 0–4, dates `YYYY-MM-DD`); for the dates `"value":null` empties the
  field. List fields (`labels`, `assignees`) take `{"mode":"add"|"remove"|"replace"|"clear","ids":[…]}`.
  A field you leave out is not touched. `status` takes a status id (`/api/hub/workflow/states`).
- The answer is `{succeeded, failed: [{issueId, reason, message}], requested, …}` — **read `failed`**: the call is
  `200` even when some issues could not be changed (no permission, not visible, a status that issue type does not
  have). Tell the user how many succeeded and which failed, not «done».
- This changes many issues in one step and there is no undo with a token. Show the user the list and the change,
  and get a clear yes first. `notify: true` also notifies new assignees; leave it out unless asked.
- Bulk move follows the single move's rules for every issue (new keys, what is dropped — ask for one issue's plan
  with `dryRun` first to pick the `statusId`). Deleting several issues at once is not possible with a token.

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
- Assigning a department takes a department id from `/api/hub/org/tree` (see «People and departments»).
- `assignees` is the whole new list — read the issue first and keep the people who should stay.
- Several people share a name: show the user the matches (name, department) and ask which one.
- `403 FORBIDDEN` «담당자를 지정할 권한이 없어요»: the token owner's project role may not assign.

## Custom fields (`issue:read` / `issue:write`)

```sh
$Z GET /api/hub/fields/definitions --query projectId=ZEN     # [{id, name, type, options, …}]
$Z GET /api/hub/fields/values/ZEN-12
$Z POST /api/hub/fields/values/ZEN-12 --json '{"values":[{"fieldId":"<id>","value":"높음"}]}'
```

## Watch, blocked, vote, move, history (`issue:read` / `issue:write`)

```sh
$Z POST '/api/hub/issues/ZEN-12/watch?projectId=ZEN'                                   # 204 — the owner now gets its notifications
$Z DELETE /api/hub/issues/ZEN-12/watch --query projectId=ZEN --yes                     # 204
$Z POST /api/hub/issues/ZEN-12/block --json '{"projectId":"ZEN","reason":"디자인 시안을 기다려요"}'   # {blockedReason}
$Z DELETE /api/hub/issues/ZEN-12/block --query projectId=ZEN --yes                     # 204
$Z POST '/api/hub/issues/ZEN-12/vote?projectId=ZEN'                                    # {vote: {count, …}}
$Z DELETE /api/hub/issues/ZEN-12/vote --query projectId=ZEN --yes

$Z GET /api/hub/activity/issue/ZEN-12                                                  # [{action, actor: {id, name}, at, …}], newest first

$Z POST /api/hub/issues/ZEN-12/move --json '{"projectId":"ZEN","toProjectId":"OPS","dryRun":true}'   # the plan, nothing changes
$Z POST /api/hub/issues/ZEN-12/move --json '{"projectId":"ZEN","toProjectId":"OPS","statusId":"<id from the plan>"}'
```

- Watching, the blocked mark and the vote belong to the token owner's own view of the issue or to the issue's
  state — taking them off (`DELETE`, needs `--yes`) deletes nothing. `reason` is required, up to 200 characters;
  marking an issue blocked needs the right to edit it.
- **History** comes a page at a time. When there is more, the helper prints the `--query cursor=…` to add for the
  next page.
- **Moving an issue to another project gives it a new key** (`ZEN-12` becomes the next number of the target project); the old key keeps working as a
  link. Always ask for the plan first (`dryRun`): it lists the target's `statuses` and `types`, the suggested
  `statusId`/`typeId`, and `drops`. In `drops`, these are **removed** by the move: `sprint`, `release`, `group`,
  `parent` (true/false), `milestones` and `customFields` (how many). These are **kept but worth telling**:
  `peopleOutside` (assignees and watchers who are not members of the target project — they stay on the issue),
  `deptsOutside` (assigned departments with no member there — they stay too) and `membersOnly` (the issue is
  visible to project members only, so after the move only the target project's members see it). Show the user
  both lists and confirm before the real call. Leaving `statusId`/`typeId` out uses the suggested ones.
- Moving needs the right to edit and delete issues in the source project and to create issues in the target
  (`403 MOVE_SOURCE_FORBIDDEN` / `MOVE_TARGET_FORBIDDEN`). An issue with sub-issues cannot be moved
  (`409 MOVE_HAS_CHILDREN`) — move or unlink the sub-issues first. If `MOVE_SOURCE_FORBIDDEN` comes back although
  the owner may edit and delete there, tell the user to move it in Zenta or ask a project admin.

## Tree, comment reactions, recently seen, trash (`issue:read` / `issue:write`)

```sh
$Z GET /api/hub/issues/ZEN-12/tree --query projectId=ZEN         # the issue with all its sub-issues, nested in children
$Z GET /api/hub/issues/ZEN-12/ancestors --query projectId=ZEN    # {ancestors: [{id, key, title, …}]} — nearest parent first
$Z POST /api/hub/issues/ZEN-12/comments/<comment id>/reactions --json '{"projectId":"ZEN","emoji":"check"}'
$Z DELETE /api/hub/issues/ZEN-12/comments/<comment id>/reactions --query projectId=ZEN --query emoji=check --yes
$Z GET /api/hub/issues/recent                                    # {items: [{key, title, projectKey, status, seenAt}]} — what the owner opened last
$Z GET /api/hub/issues/deleted --query projectId=ZEN             # {items: [{id, key, title, deletedAt, deletedBy, purgeAt}], nextCursor}
$Z POST '/api/hub/issues/ZEN-12/restore?projectId=ZEN'           # 204 — back from the trash
$Z GET /api/hub/sprints/<sprint id>/burndown --query projectId=ZEN   # {points: […], velocity, unit, unestimated}
```

- A comment reaction is one of `check`, `+1`, `eyes`; it needs the right to comment on that issue. The answer is
  `{reactions: [{emoji, count, mine, people}]}`. Taking off removes the owner's own reaction only.
- The trash list reads newest deletions first; pass `nextCursor` back as `cursor` to go on. `purgeAt` is when the
  issue is removed for good.
- Restoring needs the right to delete issues in that project (`403` otherwise); an issue that is not in the trash
  answers `409 NOT_DELETED`, and one whose parent is still in the trash `409 PARENT_DELETED` (restore the parent
  first; the message names it when the owner can see it). **Deleting an issue is not possible with a token.**
- An issue or project the owner cannot see answers `404`, like one that does not exist.

## Parent issue, commits, pull requests, department issues (`issue:read` / `issue:write`)

```sh
$Z GET /api/hub/issues/ZEN-12/parent-options --query projectId=ZEN --query q=결제   # {items: [{id, key, title, typeName}], hasMore, rule?}
$Z PUT /api/hub/issues/ZEN-12/parent --json '{"projectId":"ZEN","parentId":"ZEN-10"}'   # ZEN-12 goes under ZEN-10
$Z DELETE /api/hub/issues/ZEN-12/parent --query projectId=ZEN --yes                     # 204 — both issues stay
$Z GET /api/hub/issues/ZEN-10/child-options --query projectId=ZEN                       # issues that may go under ZEN-10
$Z GET /api/hub/issues/ZEN-12/commits                                                    # {commits: [{sha, message, author, url, repository, branch, committedAt}], nextCursor?}
$Z GET /api/hub/issues/ZEN-12/pull-requests                                              # {pullRequests: [{repo, number, title, state, url, author, branch, reviewers}]}
$Z GET /api/hub/issues/department                                                        # {items, hasMore, nextOffset, departments} — issues assigned to the owner's department
```

- `PUT …/parent` is the same link as `POST …/subtasks` seen from the child. When the project has a hierarchy,
  `rule` in parent-options tells which issue type the parent must be, and in child-options which types may go
  under this issue (`excluded` lists the ones left out and why); a link that breaks it answers `400`.
- Send `"ifParentId":"ZEN-9"` (or `--query ifParentId=ZEN-9` when taking off) to change the parent only if it
  still is that issue — `409` otherwise, also when the owner cannot see the issue named there.
- Commits and pull requests are the ones Git sent in for this issue (they stay after the connection is removed);
  an issue with none answers an empty list. More commits: `--query cursor=<nextCursor>`. Author e-mails are left
  out.
- Department issues are the issues **assigned to a department** (the owner's own department and the ones under it;
  `--query departmentId=<department id>` from `/api/hub/org/tree` for another). Only issues the owner can see are
  listed.

## On-call alerts, deploys, project commits (`issue:read` / `issue:write`)

```sh
$Z GET /api/hub/projects/ZEN/oncall                          # {schedules, policies: [{id, name, enabled, steps}], people, openAlerts, canHandle}
$Z GET /api/hub/projects/ZEN/oncall/alerts                   # {alerts: [{id, title, status, policyName, createdAt}], counts: {open, acked, resolved}}
$Z GET /api/hub/projects/ZEN/oncall/alerts --query status=resolved    # active (default) · open · acked · resolved · all
$Z GET /api/hub/projects/ZEN/oncall/alerts/<alert id>        # one alert with its events (who was notified, when)
$Z POST /api/hub/projects/ZEN/oncall/alerts --json '{"title":"결제 오류가 늘었어요","detail":"5분 동안 실패 40건","policyId":"<policy id>"}'   # {id}
$Z POST /api/hub/projects/ZEN/oncall/alerts/<alert id>/ack       # 204 — «I am on it»: the alert stops moving to the next step
$Z POST /api/hub/projects/ZEN/oncall/alerts/<alert id>/unack     # 204 — back to waiting
$Z POST /api/hub/projects/ZEN/oncall/alerts/<alert id>/resolve   # 204 — closed
$Z POST /api/hub/projects/ZEN/oncall/alerts/<alert id>/reopen    # 204
$Z POST /api/hub/projects/ZEN/oncall/alerts/<alert id>/reassign --json '{"userId":"<user id>"}'   # 204 — that person is notified at once
$Z GET /api/hub/projects/ZEN/dora                            # {frequency, lead, failure, recovery, rework, trend, window}
$Z GET /api/hub/projects/ZEN/deploys                         # {items: [{id, service, environment, status, sha, finishedAt}], nextCursor}
$Z GET /api/hub/projects/ZEN/deploys/<deploy id>             # {deploy, commits, issues, incidents, mergedPrs}
$Z GET /api/hub/projects/ZEN/commits                         # {commits, nextCursor, from, to, olderExists} — the last 30 days
$Z GET /api/hub/projects/ZEN/commits --query range=all       # every commit; or --query from=<unix seconds> --query to=<unix seconds>
$Z GET /api/hub/projects/ZEN/commit-stats --query range=all  # {total, authors: [{name, count}], repos}
$Z GET /api/hub/projects/ZEN/hierarchy                       # {on, levels, types: [{id, name, levelId}]}
$Z POST /api/hub/projects/ZEN/favorite --json '{"favorite":true}'   # put the project among my favorites (false takes it out)
```

- **Raising an alert notifies people at once** — the first step of the escalation policy, then the next steps until
  someone acknowledges. Raise one only when the user asked for it, and pick the policy with them
  (`policies[].id` from the overview; a disabled policy does not notify). Raising and reassigning share a small
  budget — 5 a minute and 30 an hour per token; past it the answer is `429` with `Retry-After`.
- An alert is `open` (waiting), `acked` (someone is on it) or `resolved`. Acknowledging twice answers `409`.
- Acknowledging, resolving and reassigning act as the token's owner — do them only when the user said so for that
  alert. Reassigning takes a member of the project or an organization admin.
- Duty rosters and escalation policies are read in the overview and changed on the screen; deploy settings and
  Git connections are on the screen only.
- `dora` takes `from` and `to` together (unix seconds); without them it answers the default window.
- Commit answers carry the author's name, never the e-mail address; `issueIds` lists only issues the token's
  owner can see.

## Boards, dashboards, reports, sprint time (`issue:read` / `issue:write`)

```sh
$Z GET /api/hub/boards                                       # {boards: [{id, name, share, filter, columns, revision, canManage}]}
$Z GET /api/hub/boards/<board id>/issues                     # {board, issues, columnOf: {issueId: columnId}, counts, states}; first=N limits each column
$Z POST /api/hub/boards --json '{"name":"이번 달 버그","filterId":"<filter id>"}'      # a board shows a saved filter; private at first
$Z PUT /api/hub/boards/<board id> --json '{"name":"이번 달 버그","filterId":"<filter id>","share":"org","swimlane":"assignee","columns":[…],"quickFilters":[],"adminIds":[…],"revision":2}'
$Z POST /api/hub/boards/<board id>/rank --json '{"issueId":"<moved issue id>","order":["<issue id>","<issue id>"]}'   # 204
$Z GET /api/hub/dashboards                                   # {dashboards: [{publicId, name, share, gadgetCount, mine}]}
$Z GET /api/hub/dashboards/<publicId>                        # {dashboard: {…, gadgets: [{id, kind, groupBy, width}]}}
$Z POST /api/hub/dashboards --json '{"name":"팀 현황"}'
$Z POST /api/hub/dashboards/<publicId> --json '{"share":"org"}'              # only the fields sent change
$Z POST /api/hub/dashboards/<publicId>/gadgets --json '{"kind":"filter-counts","filterId":"<filter id>","groupBy":"status"}'
$Z POST /api/hub/dashboards/<publicId>/gadgets/<gadget id> --json '{"width":"wide"}'
$Z POST /api/hub/dashboards/<publicId>/gadgets/reorder --json '{"ids":["<gadget id>","<gadget id>"]}'
$Z GET /api/hub/dashboards/<publicId>/gadgets/<gadget id>/data               # e.g. {kind, total, by, groups: [{id, name, count}]}
$Z GET /api/hub/dashboards/<publicId>/gadgets/<gadget id>/issues --query row=<group id>   # the issues behind one group
$Z GET /api/hub/reports --query projectId=ZEN                # weekly, monthly and quarterly reports, newest first
$Z GET /api/hub/reports/cycle --query projectId=ZEN --query from=2026-10-01 --query to=2026-10-31   # how long issues took
$Z POST /api/hub/reports/regenerate --query projectId=ZEN --json '{"id":"<report id>"}'
$Z GET /api/hub/sprints/<sprint id>/capacity --query projectId=ZEN            # {rows: [{capacityMinutes, loggedMinutes, remainingMinutes}], totalCapacityMinutes}
$Z POST /api/hub/sprints/<sprint id>/capacity --query projectId=ZEN --json '{"userId":"<user id>","minutes":1200}'
$Z POST /api/hub/sprints/backlog/rank --query projectId=ZEN --json '{"issueId":"<issue id>","beforeId":"<issue id>"}'   # 204
$Z GET /api/hub/search/files --query kind=issue --query q=계약서                # or kind=chat (needs chat:read)
```

- **Saving a board sends everything.** Read the board, change what you need and send it all back with the
  `revision` you read: `columns` (each with its `id`, `name`, `categories`, `stateIds`, `wipMax`), `swimlane`
  (`none`, `assignee`, `project`, `priority`, `parent`), `share` (`private`, `team` + `teamId`, `org`). A stale
  `revision` answers `409 BOARD_CHANGED` — read again.
- `rank` takes the moved issue and the whole column in its new order (the ids from `issues` whose `columnOf` is
  that column).
- A dashboard is named by its `publicId`. Gadget numbers come from `dashboard.gadgets[].id`. Issue gadgets count
  the issues the token's owner can see, so two people may read different numbers from the same dashboard; deploy
  and on-call gadgets follow the owner's access to that project.
- `minutes: null` (or leaving it out) takes a person's set time away. Setting time and making a report again need the project
  settings permission.
- `backlog/rank` moves one issue that is not in a sprint above (`beforeId`) or below (`afterId`) another — send
  exactly one of the two.
- Deleting a board, a dashboard or a gadget, and the exports, are not possible with a token.

## Plans, teams, who to ask (`issue:read` / `issue:write`)

```sh
$Z GET /api/hub/plans                                        # plans the owner can see: {id, publicId, name, projectCount, viewerRole, canEdit}
$Z GET /api/hub/plans/<publicId>                             # + projects and viewers
$Z GET /api/hub/plans/<publicId>/summary                     # {plan, projects: […progress per project], window}
$Z GET /api/hub/plans/<publicId>/summary --query windowKind=absolute --query from=2026-10-01 --query to=2026-12-31
$Z POST /api/hub/plans --json '{"name":"하반기 출시 계획","projectIds":["<project id>"]}'
$Z POST /api/hub/plans/<publicId> --json '{"name":"하반기 출시 계획","description":"10월 출시까지"}'    # send both
$Z POST /api/hub/plans/<publicId>/projects --json '{"projectId":"ZEN"}'
$Z POST /api/hub/plans/<publicId>/viewers --json '{"userId":"<user id>","role":"view"}'               # view or edit
$Z POST /api/hub/plans/<publicId>/viewers/<user id>/role --json '{"role":"edit"}'
$Z DELETE /api/hub/plans/<publicId>/viewers/<user id> --yes                                          # the person and the plan stay
$Z GET /api/hub/plans/<publicId>/capacity                    # {lanes: [{id, weeklyCapacity}], teams, projects, unassigned, weeks, totals}
$Z POST /api/hub/plans/<publicId>/capacity/lanes --json '{"teamId":"<team id>","projectId":"<project id>"}'   # {id}
$Z POST /api/hub/plans/<publicId>/capacity/lanes/<lane id> --json '{"weeklyCapacity":12.5}'           # 204
$Z GET /api/hub/plans/<publicId>/capacity/lanes/<lane id>/velocity      # {sprints, unit} — what the team finished before
$Z POST /api/hub/plans/<publicId>/capacity/items --json '{"projectId":"<project id>","releaseId":"<release id>","laneId":"<lane id>"}'   # 204
$Z GET /api/hub/teams                                        # [{id, name, memberCount}]
$Z GET /api/hub/teams/<team id>/members                      # [{userId, name, addedAt}]
$Z GET /api/hub/users/who-to-ask --query projectId=ZEN       # {orgAdmins, projectManagers} — whom to ask for access
```

- A plan gathers several projects into one long-range view. It is named by its `publicId`. The summary's default
  window is relative to today; `windowKind=relative` takes `toNow`, `fromNow` and `unit` (`days`, `weeks`,
  `months`), `windowKind=absolute` takes `from` and `to`.
- Viewers are the people a plan is shared with (`view` reads, `edit` changes). The plan's owner and organization
  admins manage them.
- A lane is one team working on one project of the plan. Its `weeklyCapacity` is a number you set — read
  `…/velocity` and send its weekly figure; `null` clears it and the lane is no longer scheduled.
- `capacity/items` puts a release on a lane by hand. Leave `laneId` out to go back to automatic assignment (a
  project with a single lane then uses that lane); leave `releaseId` out for the open issues outside an unreleased
  release.
- Taking a project out of a plan, deleting a lane or a plan, and making or changing teams are done on the screen:
  the first two delete what was planned there, and a team's members inherit its roles.
- `who-to-ask` is the answer to «I cannot see or change this — who can let me?».

## Goals (`issue:read` / `issue:write`)

```sh
$Z GET /api/hub/goals                                             # [{id, title, state, progress, owner, targetDate, canEdit}] — add --query archived=1 for archived ones
$Z POST /api/hub/goals --json '{"title":"3분기 출시","targetDate":"2026-09-30"}'
$Z POST /api/hub/goals/<goal id> --json '{"state":"achieved"}'    # only the fields you send change
$Z POST /api/hub/goals/<goal id>/archive --json '{"archived":true}'
$Z GET /api/hub/goals/<goal id>/issues                            # {items: […], hidden: <count the owner cannot see>}
$Z POST /api/hub/goals/<goal id>/issues --json '{"issueIds":["<issue id>"]}'   # up to 50 a call
$Z DELETE /api/hub/goals/<goal id>/issues/ZEN-12 --yes            # the issue and the goal both stay
```

- Goals belong to the organization, not to a project. `state` is `active`, `achieved` or `missed`; `mode` is
  `issues` (progress counted from linked issues) or `manual` (send `manualPercent`, 0–100).
- Changing or archiving a goal is for the person who made it, its owner, or an organization admin (`403`
  otherwise). Linking or taking off an issue also needs the right to edit that issue; an issue the token owner
  cannot see answers like one that does not exist.
- Linking takes issue **numbers** (the `id` of an issue), not keys; taking off accepts a key or a number. Every
  linked issue counts as one write against the 120-per-minute limit; a call that does not fit answers `429` and
  links nothing.
- There is no way to delete a goal — archive it.

## Approvals (`issue:read` / `issue:write` / `approval:decide`)

```sh
$Z GET /api/hub/approvals                                # waiting for the token owner's decision
$Z GET /api/hub/approvals --query mine=drafted           # the ones the owner requested (handled · done also work)
$Z GET /api/hub/approvals/<approval id>                  # {title, body, state, steps: [{approverName, state, isCurrent}], canWithdraw}
$Z GET /api/hub/approvals/issue/ZEN-12                   # approvals tied to an issue
$Z GET /api/hub/approvals/line/suggest                   # {approvers: [{userId, name, departmentName}], basis}
$Z POST /api/hub/approvals --json '{"title":"연차 신청","body":"12월 1일부터 사흘","approverIds":["<user id>"]}'
$Z POST /api/hub/approvals/<approval id>/withdraw
$Z POST /api/hub/approvals/<approval id>/approve --json '{"comment":"확인했어요"}'      # needs approval:decide; comment optional
$Z POST /api/hub/approvals/<approval id>/reject --json '{"comment":"예산 근거를 더해 주세요"}'   # a reason is required
```

- An approval answers to its number (`id`) and to its public id (`publicId`, the one a document review hands out).
- `state` is `pending`, `approved`, `rejected` or `withdrawn`. `GET /api/hub/approvals` comes 200 at a time; when
  200 arrive, ask again with `--query offset=200`. The approvals of one issue come all at once.
- `approverIds` is the approval line in order (up to 10 organization members, not the requester and not guests). Add `"issueId":"<issue id>"`
  to tie the request to an issue the owner can see.
- Only the requester can withdraw, while the request is pending and nobody has approved a step yet. Read
  `canWithdraw` on the approval before trying.
- **Approving and rejecting need the `approval:decide` scope**, which the issue scopes do not include. They work
  only when it is the token owner's turn in the line (otherwise `400`), answer `{approval, transition?}`, and cannot
  be undone. The last approval can move the tied issue to its next status. Each decision counts as one write
  against the 120-per-minute limit.
- **Decide only when the user asked for that decision on that approval.** Read the approval first, tell the user
  what it is, and never approve or reject on your own judgment or in bulk.
- A masked body or comment (`bodyMasked`, `commentMasked`) cannot be opened with a token.

## Saved filters (`issue:read` / `issue:write`)

```sh
$Z GET /api/hub/filters --query projectId=ZEN            # the project's filters (built-in ones first)
$Z GET /api/hub/filters --query scope=org                # filters that span projects
$Z GET /api/hub/filters/starred
$Z GET /api/hub/filters/<filter id>                      # name and `query`
$Z GET /api/hub/filters/<filter id>/issues --query limit=50
$Z POST /api/hub/filters --json '{"projectId":"ZEN","name":"급한 일","query":{"priorities":[3,4],"statusCategories":["todo","doing"]}}'
$Z POST /api/hub/filters/<filter id> --json '{"name":"이번 주 급한 일"}'
$Z POST /api/hub/filters/<filter id>/star --json '{"on":true}'
```

- Running a filter answers `{issues, nextCursor}` — at most 200 per page; pass `nextCursor` back as `cursor` until
  it is absent. Only issues the token owner can see are listed.
- `400` «목록의 다음 위치가 올바르지 않아요» on a later page means the cursor went stale (the issue it points at was
  moved or hidden meanwhile): read again from the first page instead of treating it as the end.
- `query` is the same conditions object the screen saves. Read an existing filter to learn the shape before writing
  one. Common keys: `priorities` (0–4), `statusCategories` (`todo` · `doing` · `hold` · `done` · `closed`),
  `statusIds`, `assigneeIds`, `assigneeMe`, `labelIds`, `search`. A wrong shape or an unknown category is `400`
  with the reason; an id that matches nothing is accepted and simply finds no issues — check ids before saving.
- A new filter is private. `"shared": true` shows a project filter to everyone in the project; a filter that spans
  projects (`"scope":"org"`, no `projectId`) takes `"share": "private" | "team" | "org"` (`teamId` with `team`).
  Sharing changes what other people see in their lists — confirm with the user first.
- Editing sends only what changes; `query` replaces the whole conditions object. You can edit your own filters;
  built-in ones cannot be changed.
- A filter you cannot see answers `404` like one that does not exist — also your own filter in a project you are
  no longer a member of. Deleting a filter, exporting its result and
  the weekly mail are not possible with a token.

## People and departments (`issue:read`)

```sh
$Z GET /api/hub/users/<person id>                        # name, department, title (never an e-mail address)
$Z GET /api/hub/org/tree                                 # departments as a tree (ids for department assignees)
$Z GET /api/hub/org/departments/<department id>/members --query limit=50 --query includeDescendants=true
```

- With `limit` the members answer is `{items, nextCursor}` (at most 200 per page); without it, a plain list.
- A department that does not exist answers an empty list, not an error. A person the token owner may not look up
  answers `404` like one that does not exist.
- Use `/api/hub/users/search` (see «Assign») to find a person by name; these routes read what you already have an
  id for.

## Projects: make and change (`issue:write`)

```sh
$Z POST /api/hub/projects --json '{"title":"모바일 앱","key":"APP","template":"software"}'   # {project: {id, key, name, …}}
$Z POST /api/hub/projects/APP --json '{"description":"2027 상반기 출시"}'                    # only the fields you send
$Z POST /api/hub/projects/APP --json '{"archived":true}'                                    # archive; false brings it back
```

- A new project cannot be removed with a token (deleting is done in Zenta) — confirm the name and key with the
  user first. At first only the token owner (as its admin) and organization admins see it; adding members is done
  in Zenta. `key` is the prefix of its issue keys (key `APP` → issues `APP` + a number); leave it out and
  Zenta derives one from the name. `template` is one of `general` · `software` · `support` · `approval` ·
  `marketing` · `sales`.
- A token sends only `title`, `key`, `emoji` and `template` when creating. Copying another project, an organization
  template, members and document spaces are done in Zenta (`400` otherwise).
- Editing needs the right to manage that project (`403` otherwise): `title`, `description`, `emoji`, `hexColor`
  (`#rrggbb`, `""` for none) and `archived`. Archiving hides the project from the lists but keeps everything.

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
$Z GET /api/hub/wiki/<id>/revisions --query projectId=ZEN       # {revisions: [{revision, title, author, createdAt}], nextCursor?}
$Z GET /api/hub/wiki/<id>/revisions/3 --query projectId=ZEN     # that version's title and body
$Z GET /api/hub/wiki/<id>/comments --query projectId=ZEN        # {threads: [{id, blockId, resolvedAt, comments: [{authorName, body, …}]}], resolvedTotal}
```

- The revision list is newest first, a page at a time: pass `nextCursor` back as `--query cursor=…`. Going back to
  an old version is done in Zenta — with a token you can read it and, if the user wants, write its body back as a
  new version (`PUT`, see below).
- Comments hang on a paragraph (`blockId`). Each entry of `threads` is one thread: the first comment and its
  replies. A missing revision number answers `400`.

## Comment on documents (`doc:write`)

```sh
$Z POST /api/hub/wiki/<id>/comments --query projectId=ZEN --json '{"blockId":"<block id>","x":0,"y":0,"body":"이 숫자를 확인해 주세요"}'
$Z POST /api/hub/wiki/<id>/comments/<thread id>/replies --query projectId=ZEN --json '{"body":"고쳤어요"}'
$Z POST /api/hub/wiki/<id>/comments/<thread id>/resolve --query projectId=ZEN --json '{"resolved":true}'
```

- `blockId` is the `id` of a block in `doc.blocks` from reading the page — pick the paragraph the comment is about.
  `x` and `y` place the marker inside that paragraph (0 to 1); send `0` for both when you have no reason to choose.
- A comment is up to 4,000 characters. Starting a new thread answers `400` when the page already has 200 open
  ones — resolve some first. `resolved: false` reopens a thread. Confirm the text with the user first: people and
  departments mentioned in it are notified (those who can read the page).
- Editing or deleting a comment is not possible with a token.

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

## Documents: drafts, publishing, review, news, upkeep (`doc:read` / `doc:write`)

```sh
$Z POST /api/hub/wiki --json '{"projectId":"ZEN","title":"배포 절차","draft":true}' --markdown deploy.md   # a private draft: only the owner sees it
$Z GET /api/hub/wiki/my-drafts                                                  # the owner's private drafts
$Z PUT /api/hub/wiki/<id>/draft --json '{"projectId":"ZEN","revision":3}' --markdown whole.md   # change a published page as a revision draft
$Z POST /api/hub/wiki/<draft id>/publish --query projectId=ZEN --json '{"memo":"절차를 고쳤어요"}'    # readers now see it
$Z POST /api/hub/wiki/<draft id>/review --query projectId=ZEN --json '{"approverIds":["<user id>"],"note":"확정해 주세요"}'
$Z PUT /api/hub/wiki/<id>/kind --query projectId=ZEN --json '{"kind":"news"}'    # show it as news ("doc" takes it back)
$Z PUT /api/hub/wiki/<id>/upkeep --query projectId=ZEN --json '{"ownerId":"<user id>","due":"2026-12-31"}'
$Z GET /api/hub/wiki/<id>/access --query projectId=ZEN                           # who may read and who may edit
$Z GET /api/hub/wiki/<id>/views --query projectId=ZEN                            # {uniqueViewers, viewCount, viewers: […]} — author and admins only
$Z GET /api/hub/wiki/<id>/scope                                                  # {scope: "project", projectKey} or {scope: "org"}
$Z PATCH /api/hub/wiki/<id>/comments/<thread id>/comments/<comment id> --query projectId=ZEN --json '{"body":"숫자를 고쳤어요"}'
```

- **Two ways to change a published page.** `PUT /api/hub/wiki/<id>` saves a new version at once — everyone sees
  it. `PUT …/<id>/draft` starts a **revision draft** instead: the answer is the draft (its own `id`, `draft.draftOf`
  = the published page) and readers keep seeing the old text until the draft is published or approved. Keep
  editing the draft with `PUT /api/hub/wiki/<draft id>` (its own `revision`).
- If someone already has a revision draft open on that page, `PUT …/draft` answers `409`; read the page
  (`draft.editing.draftId`) and join that draft with `POST …/<id>/draft` instead of starting another.
- Publishing a revision draft answers `409 PUBLISHED_CHANGED` when the published page changed since the draft
  started. Show the user both and send `"force":true` only if they say the draft should win.
- A review request goes to the approvals: the page is locked for editing (`409 IN_REVIEW`) until the approvers
  decide, and their approval publishes it. The answer carries `draft.review.approvalId` — read it with
  `GET /api/hub/approvals/<approvalId>` and take the request back with `POST …/<approvalId>/withdraw`. Confirm the
  approvers with the user first.
- `upkeep` sets both fields at once: `"ownerId":""` and `"due":null` clear them.
- Only the person who wrote a comment can edit it. Deleting a comment, changing who may read a page, public links
  and going back to an old version are not possible with a token.

## Documents: copy, folders, labels, favorite, watch, restore (`doc:read` / `doc:write`)

```sh
$Z POST /api/hub/wiki/<id>/copy --query projectId=ZEN --json '{"toProjectId":"ZEN","withChildren":true}'   # {page, docs}
$Z POST /api/hub/wiki-folders --json '{"projectId":"ZEN","title":"회의록"}'
$Z PATCH /api/hub/wiki-folders/<folder id> --json '{"projectId":"ZEN","title":"주간 회의록"}'
$Z PUT /api/hub/wiki/<id>/labels --query projectId=ZEN --json '{"labelIds":["<label id>"]}'   # the whole new list
$Z POST /api/hub/wiki/<id>/favorite --json '{"projectId":"ZEN","favorite":true}'
$Z GET /api/hub/wiki/<id>/watch --query projectId=ZEN
$Z POST /api/hub/wiki/<id>/watch --query projectId=ZEN --json '{"watching":true}'
$Z GET /api/hub/wiki/templates --query projectId=ZEN
$Z POST /api/hub/wiki/<id>/undelete --json '{"projectId":"ZEN"}'                               # bring back from the trash
```

- Where the project goes differs per route: copy, labels, watch and templates read it from the query
  (`--query projectId=…` or `--query scope=org`); folders, favorite and restore take it in the JSON.
- Copy needs a destination (`toProjectId` or `"toScope":"org"`), also for a copy in the same place; `parentId` puts
  the copy under a document, `withChildren` copies the sub-documents too (up to 200 documents a call). Every copied
  document counts as one write against the 120-per-minute limit; a call that does not fit answers `429` and copies
  nothing. A copy of a document with restricted viewing stays restricted, open to the token owner only, and cannot
  go to the company space.
- `labelIds` replaces the document's labels (an empty list removes all); read the document first and keep the ones
  that should stay. Favorite and watch are the token owner's own settings.
- A document, folder or project the owner cannot see answers `404` «문서를 찾을 수 없어요», like one that does not
  exist.
- Deleting a document or a folder is not possible with a token; restoring a deleted document is.

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

## Chat: direct conversations, search, pins, members (`chat:read` / `chat:write`)

```sh
$Z GET /api/v1/dms                                             # the owner's direct conversations: {dms: […]}
$Z POST /api/v1/dms --form user_id=<person id>                 # open one (answers the existing one if there is): {dm_id}
$Z GET /api/v1/dms/<dm id>/messages --query num_before=50
$Z POST /api/v1/dms/<dm id>/messages --form content='확인했어요'
$Z GET /api/v1/messages/search --query q=배포                  # {results, hasMore} — only what the owner can see
$Z GET /api/v1/unread                                          # unread counts per channel and conversation
$Z GET /api/v1/streams/<channel id>/members --query limit=50   # {members, total, nextCursor}
$Z GET /api/v1/streams/<channel id>/pins                       # pinned messages
$Z POST /api/v1/streams/<channel id>/join                      # public channels only
$Z PATCH /api/v1/messages/<message id> --json '{"content":"고친 글이에요"}'   # your own message
$Z POST /api/v1/messages/<message id>/pin
$Z DELETE /api/v1/messages/<message id>/pin --yes              # unpin; the message stays
```

- A direct message goes straight to a person and appears under the token owner's name — confirm the person and
  the text first. Several `user_id` values open a group conversation; none opens the owner's note-to-self.
  Direct messages share the 30-per-minute posting limit with channel posts.
- Opening and sending are **form** bodies; editing a message is JSON. Editing works on the owner's own messages
  only and cannot leave the text empty; deleting a message is not possible with a token.
- A private channel is entered by invitation only: joining one the owner is not in answers `404`, like a channel
  that does not exist. So does a conversation the owner is not part of, and a message the owner cannot see.
- A blank direct message is refused (`400`), as in channels.
- Answers carry names and ids of people, never other people's e-mail addresses.

## Chat: my drawer, reminders, following replies, forward, links (`chat:read` / `chat:write`)

```sh
$Z POST /api/v1/messages/<message id>/save                                   # into the owner's drawer
$Z PUT /api/v1/messages/<message id>/remind --json '{"at":"2026-12-01T09:00:00+09:00"}'   # remind me then (also saves it)
$Z GET /api/v1/saved                                                         # {messages: […], nextCursor?} — add --query done=1 or archived=1
$Z PUT /api/v1/messages/<message id>/save_done --json '{"done":true}'        # tick it off (save_archive works the same with "archived")
$Z DELETE /api/v1/messages/<message id>/save --yes                           # out of the drawer; the message stays
$Z POST /api/v1/messages/<message id>/follow                                 # get notified of replies (DELETE …/follow --yes stops)
$Z POST /api/v1/streams/<channel id>/follow_all --json '{"on":true}'         # follow every thread of a channel
$Z POST /api/v1/streams/<channel id>/mute --json '{"level":"mentions"}'      # all · mentions · none
$Z POST /api/v1/messages/<message id>/forward --json '{"targets":[{"kind":"stream","id":<channel id>}],"note":"참고해 주세요"}'
$Z GET /api/v1/messages/sent                                                 # what the owner posted, newest first
$Z GET /api/v1/messages/<message id>/linked-issues                           # issues made from or linked to the message
$Z GET /api/v1/streams/<channel id>/links                                    # links posted in a channel (…/dms/<dm id>/links for a conversation)
$Z GET /api/v1/streams/<channel id>/tabs                                     # the channel's tabs and pinned links
```

- The drawer, reminders, following and the notification level are the token owner's own settings — nobody else
  sees them. A reminder time must be in the future.
- Forwarding posts a message in each target in the owner's name — confirm the targets and the note first. A target
  is `{"kind":"stream","id":…}` (a channel the owner is in) or `{"kind":"dm","id":…}`, up to 10 a call. Every target
  counts as one message against the 30-per-minute posting limit; a call that does not fit answers `429` and sends
  nowhere.
- A message or channel the owner cannot see answers like one that does not exist.
- More of a list: `--query cursor=<nextCursor>`.

## Chat: channels — browse, make, change, invite, leave (`chat:read` / `chat:write`)

```sh
$Z GET /api/v1/streams/browse --query q=배포 --query limit=50        # public channels: {streams: [{stream_id, name, joined, members}]}
$Z POST /api/v1/streams --json '{"name":"배포-알림","description":"배포 소식"}'           # {stream: {stream_id, …}}
$Z POST /api/v1/streams --json '{"name":"인사-논의","invite_only":true}'                   # a private channel
$Z PATCH /api/v1/streams/<channel id> --json '{"description":"배포 소식과 장애 알림"}'
$Z PATCH /api/v1/streams/<channel id> --json '{"is_archived":true}'                        # false brings it back
$Z POST /api/v1/streams/<channel id>/invite --json '{"user_ids":["<person id>"]}'          # {added, already, skipped}
$Z POST /api/v1/streams/<channel id>/leave
```

- A channel name is unique in the organization (`400` «같은 이름의 채널이 이미 있어요» otherwise). The token owner
  is in the channel they make.
- Changing a channel and inviting people is for an organization admin or the person who made the channel (`403`
  otherwise). `PATCH` takes `name`, `description`, `is_archived`, `is_private`; at most 100 people per invite,
  and every person counts as one write against the 120-per-minute limit (a call that does not fit answers `429`
  and adds nobody).
- Archiving hides the channel for everyone, and `"is_private": false` opens a private channel's history to the
  whole organization — show the user what will change and get a clear yes first.
- Deleting a channel and changing how long messages are kept are not possible with a token (`400` «토큰으로는 …
  칸을 쓸 수 없어요»).
- Leaving a channel the owner is not in answers `400`; a private channel the owner cannot see answers like one that
  does not exist.

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
$Z POST '/api/hub/notifications/<notice id>/unread?source=board'       # back to unread — same scopes
$Z POST '/api/hub/notifications/read-all?source=board'                 # everything of that source read — same scopes; {ids: […]}
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
  item from the person's unread list, so do it only when the user asked you to handle or clear it. A number that is
  not in that source answers `204` too and changes nothing.
- `POST …/<id>/unread?source=…` puts one item back to unread (`204`); a number that is not in that source answers
  `404`, and `409` means a newer notice from the same place is already unread. `POST …/read-all?source=…` marks
  everything the token can list under that source as read and answers the changed `ids`; it clears the person's
  whole list for that source, so do it only when the user asked for exactly that. Both take `source` only.
  Snoozing is not possible with a token.

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
