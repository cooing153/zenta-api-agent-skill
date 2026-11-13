# 젠타 API 스킬 — Claude Code · Codex

> **English:** An agent skill that lets Claude Code and Codex work in Zenta (젠타) — issues, documents and chat — with a scoped API token.
> Install: `claude plugin marketplace add cooing153/zenta-api-agent-skill` then `claude plugin install zenta-api@zenta` (Codex: clone into `~/.agents/skills/zenta-api`).
> License: MIT. The rest of this page is in Korean.

AI 에이전트(Claude Code, Codex)가 **회사 젠타에서 바로 일하게** 해 주는 스킬이에요.
설치하고 토큰만 넣으면 이렇게 말할 수 있어요.

- 「ZEN 프로젝트에 ‘배포 실패 확인’ 이슈 만들고, 원인 찾은 내용을 코멘트로 달아 줘」
- 「내 할 일 중 이번 주 마감인 것만 보여 줘」
- 「ZEN-12 를 완료로 옮기고 담당자를 김민수로 바꿔 줘」
- 「온보딩 문서를 찾아서 끝에 오늘 바뀐 절차를 덧붙여 줘」
- 「#배포알림 채널에 배포 끝났다고 올려 줘」

에이전트는 **토큰 주인의 권한 안에서만** 움직여요. 화면에서 못 하는 일은 API 로도 못 해요.

## 준비물

- Node.js 20 이상 (`node -v` 로 확인해요. 18 도 되지만 fetch 경고가 한 줄 나와요 — 고장은 아니에요)
- 젠타 API 토큰

## 1. 토큰 만들기

1. 젠타에서 **프로필·계정 설정 › API 토큰** 으로 가서 **토큰 만들기**를 눌러요.
2. 이름(예: `Claude`)을 적고, **할 일에 꼭 필요한 범위만** 골라요.

   | 하고 싶은 일 | 고를 범위 |
   |---|---|
   | 이슈 보기·찾기 · 라벨·스프린트·그룹·하위 이슈 목록 · 첨부 목록·내려받기 · 릴리스·마일스톤·관계·시간 기록 보기 | 이슈 보기 (`issue:read`) |
   | 이슈 만들기·고치기·코멘트·상태·담당자·라벨 · 스프린트에 담기·빼기 · 그룹 옮기기 · 하위 이슈 잇기·끊기 · 파일 올리기 · 릴리스·마일스톤에 담기·빼기 · 관계 맺기·끊기 · 시간 기록 적기 · 그룹·스프린트·릴리스·마일스톤 만들고 고치기 · 스프린트 시작·끝내기 · 릴리스 출시 | + 이슈 만들기·고치기 (`issue:write`) |
   | 문서 읽기·찾기 | 문서 보기 (`doc:read`) |
   | 문서 만들기·고치기·옮기기 | + 문서 쓰기 (`doc:write`) |
   | 채널 글 읽기 · 답글·반응 읽기 | 채팅 읽기 (`chat:read`) |
   | 채널에 글 보내기 · 답글 달기 · 반응 달기·빼기 | 채팅 보내기 (`chat:write`) |
   | 알림함 읽기 | 읽을 곳의 보기 범위(이슈 알림은 `issue:read`, 문서 알림은 `doc:read`, 채팅 알림은 `chat:read`) |
   | 알림을 읽음으로 바꾸기 | 그곳의 쓰기 범위(`issue:write` · `doc:write` · `chat:write`) |

3. 만료는 짧게(30일) 두는 걸 권해요. 토큰은 **만든 직후 한 번만** 보여요.
4. 토큰은 채팅창에 붙여 넣지 말고 환경 변수로 넣어요. 명령 줄에 토큰을 직접 적으면 셸 기록(history)에 남으니,
   아래처럼 `read -s` 로 붙여 넣어요(화면에도 기록에도 안 남아요).

```sh
read -rs ZENTA_TOKEN && export ZENTA_TOKEN     # 토큰을 붙여 넣고 Enter
```

파일로 두려면 나만 읽게 저장하고 `ZENTA_TOKEN_FILE` 을 써요. 괄호(서브셸) 안에서 하니 지금 셸의 umask 는 그대로예요.

```sh
( umask 077; read -rs t; printf '%s' "$t" > ~/.zenta-token )     # 토큰을 붙여 넣고 Enter
export ZENTA_TOKEN_FILE=~/.zenta-token
```

봇 이름으로 글만 올리려면 조직 관리자가 **설정 › 연동과 접수 › 연동 › 봇**에서 만든 **봇 토큰**을 써요.
봇 토큰은 관리자가 그 봇을 넣어 둔 채널에 글쓰기만 돼요.

## 2. 설치

### Claude Code — 플러그인으로 (권해요)

```sh
claude plugin marketplace add cooing153/zenta-api-agent-skill
claude plugin install zenta-api@zenta
```

Claude Code 안에서는 `/plugin marketplace add cooing153/zenta-api-agent-skill` 다음 `/plugin install zenta-api@zenta` 를 쳐요.
업데이트는 `claude plugin marketplace update zenta` 예요.

### Claude Code — 폴더 복사로

```sh
git clone https://github.com/cooing153/zenta-api-agent-skill ~/.claude/skills/zenta-api      # 내 모든 프로젝트
# 또는 한 프로젝트에만: <프로젝트>/.claude/skills/zenta-api
```

### Codex

```sh
git clone https://github.com/cooing153/zenta-api-agent-skill ~/.agents/skills/zenta-api      # 내 모든 저장소
# 또는 한 저장소에만: <저장소>/.agents/skills/zenta-api
```

Codex 를 다시 켜면 보여요(`/skills` 로 확인). Codex 의 기본 격리는 **인터넷 연결을 막아요.** 젠타에 닿게 하려면
네트워크를 허용해서 켜요.

```sh
codex -c sandbox_workspace_write.network_access=true
```

## 3. 확인

에이전트에게 **「젠타 연결 확인해 줘」** 라고 해요. 설치 방법과 상관없이 에이전트가 스킬 안의 도우미로 확인해요.

- 개인 토큰이면 「개인 토큰이에요 · 주인: (내 이름)」이 나와요. 준비 끝이에요.
- 봇 토큰이면 「봇 토큰이에요 · 범위: chat:write」가 나와요. 이것도 성공이에요 — 봇 토큰은 원래 글 보내기만 돼요.
  실제로 보내지는지는 봇이 든 채널에 글을 한 번 보내 보면 알아요.

**폴더로 복사했을 때**는 직접 돌려 볼 수도 있어요.

```sh
node ~/.claude/skills/zenta-api/scripts/zenta.mjs check     # Codex 면 ~/.agents/skills/zenta-api/…
```

(플러그인으로 설치했으면 스킬이 플러그인 폴더에 깔려서 이 경로가 없어요. 에이전트에게 물어보는 쪽을 써요.)

## 에이전트가 지키는 규칙

- 토큰을 화면·파일·커밋에 **절대 적지 않아요.** 도우미 스크립트가 토큰을 가려요.
- 다른 사람에게 보이는 일(채널 글, 코멘트, 남이 만든 이슈 고치기)은 **보내기 전에 물어요.**
- 그 사이 다른 사람이 고쳤으면(409) 덮어쓰지 않고 다시 읽어 물어요.
- 너무 자주 보내면(429) 기다렸다가 다시 보내요. 채팅 글은 토큰 하나에 1분 30개, 한 글 10,000자까지예요.
- 문서와 첨부 **지우기는 토큰으로 안 돼요.** 젠타에서 직접 지워요.

## 자주 막히는 것

| 보이는 말 | 까닭 | 할 일 |
|---|---|---|
| `401 UNAUTHORIZED` | 토큰이 틀렸거나 회수·만료됐어요. 비밀번호를 바꾸거나 «모든 기기에서 로그아웃»해도 끊겨요 | 새 토큰을 만들어요 |
| `403 TOKEN_SCOPE` | 토큰에 그 범위가 없어요(봇 토큰은 글 보내기만 돼요) | 필요한 범위로 새 토큰을 만들어요 |
| `… 파일을 읽지 못했어요` | `--markdown`·`--json-file` 로 준 파일이 없어요 | 파일 이름과 폴더를 확인해요 |
| `403 TOKEN_ROUTE` | 토큰으로 못 쓰는 기능이에요 | `references/endpoints.md` 에 있는 것만 돼요 |
| `403 TOKEN_POLICY_OFF` | 조직 관리자가 API 토큰을 꺼 두었어요 | 관리자에게 물어요 |
| `403 FORBIDDEN` | 내 역할로는 못 하는 일이에요(화면과 같아요) | 프로젝트 관리자에게 권한을 부탁해요 |
| `404 NOT_FOUND` | 없거나, 내가 볼 수 없는 것이에요 | 키·번호·프로젝트를 확인해요 |
| `젠타에 연결하지 못했어요` | 네트워크 문제예요. Codex 면 네트워크 허용을 켰는지 봐요 | 위 「Codex」 절 |

## 안에 든 것

| 파일 | 무엇 |
|---|---|
| `SKILL.md` | 에이전트가 읽는 안내 (Claude Code · Codex 공통) |
| `references/endpoints.md` | 토큰으로 쓸 수 있는 API 전부 — 젠타 서버의 표에서 만들어요 |
| `references/recipes.md` | 일마다 따라 하는 순서 |
| `scripts/zenta.mjs` | 요청 도우미 (토큰 가리기, 거절을 한국어로, 빼기·지우기 확인, 파일 올리기·저장, 429 기다리기) |
| `scripts/markdown-doc.mjs` | 마크다운 → 젠타 문서 모양 |
| `.claude-plugin/` | Claude Code 플러그인·마켓플레이스 정보 |
| `agents/openai.yaml` | Codex 앱에 보이는 이름 |

라이선스: MIT (`LICENSE`).
