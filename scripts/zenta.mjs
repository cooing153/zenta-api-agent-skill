#!/usr/bin/env node
// Zenta API helper for agents and scripts. Node 20+ recommended (18 works but prints one fetch warning), no dependencies.
//
//   node zenta.mjs check
//   node zenta.mjs GET  /api/hub/issues --query projectId=ZEN --query limit=20
//   node zenta.mjs POST /api/hub/issues --json '{"projectId":"ZEN","title":"배포 실패 확인"}'
//   node zenta.mjs POST /api/v1/messages --form to=배포알림 --form content='배포가 끝났어요'
//
// Reads ZENTA_URL and ZENTA_TOKEN (or ZENTA_TOKEN_FILE) from the environment. Never prints the token.
import { readFileSync } from 'node:fs'
import { docFromMarkdown, markdownFromDoc, pagePayload, unwritableKinds } from './markdown-doc.mjs'

const VERSION = '1.0.0' // keep equal to .claude-plugin/plugin.json "version" (the export script checks)
const HELP = `사용법: node zenta.mjs <check | METHOD PATH> [옵션]
  --query k=v        주소 뒤 ?k=v (여러 번)
  --json '<JSON>'    JSON 본문
  --json-file <파일>  JSON 본문을 파일에서 (- 이면 표준 입력)
  --form k=v         폼 본문 (여러 번, 메시지 보내기는 이 모양)
  --markdown <파일>   문서 만들기·고치기: 마크다운을 문서 내용(doc·body)으로 바꿔 JSON 본문에 넣어요 (- 이면 표준 입력)
  --append-markdown <파일>  문서 고치기: 지금 문서 끝에 마크다운을 덧붙여요(지금 판을 읽어 와요)
  --retry            429 면 Retry-After 만큼 기다렸다가 두 번까지 다시
  --yes              지우기(DELETE)를 정말 보낼 때
환경: ZENTA_URL (예: https://zenta.example.com) · ZENTA_TOKEN 또는 ZENTA_TOKEN_FILE`

const out = (s) => process.stdout.write(s + '\n')
const err = (s) => process.stderr.write(s + '\n')
const fail = (msg, code = 2) => {
  err(msg)
  process.exit(code)
}

// Reads an input file (or stdin for '-'); a missing file is one Korean line, not a stack trace.
function readInput(f, flag) {
  try {
    return readFileSync(f === '-' ? 0 : f, 'utf8')
  } catch (e) {
    fail(`${flag} 파일을 읽지 못했어요: ${f} (${e.code === 'ENOENT' ? '없는 파일이에요' : e.code ?? e.message})`)
  }
}

function token() {
  let t = process.env.ZENTA_TOKEN ?? ''
  const file = process.env.ZENTA_TOKEN_FILE
  if (!t && file) {
    try {
      t = readFileSync(file, 'utf8')
    } catch {
      fail(`ZENTA_TOKEN_FILE 을 읽지 못했어요: ${file}`)
    }
  }
  t = t.trim()
  if (!t) fail('ZENTA_TOKEN(또는 ZENTA_TOKEN_FILE)이 비어 있어요. 젠타 › 프로필·계정 설정 › API 토큰에서 만들어 넣어 주세요.')
  if (!t.startsWith('zt_')) fail('젠타 토큰은 zt_ 로 시작해요. 다른 값이 들어 있는지 확인해 주세요.')
  return t
}

function base() {
  const raw = (process.env.ZENTA_URL ?? '').trim().replace(/\/+$/, '')
  if (!raw) fail('ZENTA_URL 이 비어 있어요. 회사 젠타 주소를 넣어 주세요(예: https://zenta.example.com).')
  let u
  try {
    u = new URL(raw)
  } catch {
    fail(`ZENTA_URL 이 주소 모양이 아니에요: ${raw}`)
  }
  const local = ['localhost', '127.0.0.1', '::1', '[::1]'].includes(u.hostname)
  if (u.protocol === 'http:' && !local) err('주의: http 주소예요. 토큰이 암호화 없이 오가요. 가능하면 https 주소를 써 주세요.')
  if (u.protocol !== 'http:' && u.protocol !== 'https:') fail('ZENTA_URL 은 http(s) 주소여야 해요.')
  return raw
}

const hide = (s) => String(s).replace(/zt_[A-Za-z0-9_-]{8,}/g, 'zt_…').replace(/\/hooks\/in\/[A-Za-z0-9_-]{8,}/g, '/hooks/in/…')

function parseArgs(argv) {
  const a = { query: [], form: [], json: undefined, markdown: undefined, append: undefined, retry: false, yes: false, rest: [] }
  for (let i = 0; i < argv.length; i++) {
    const x = argv[i]
    const next = () => {
      if (i + 1 >= argv.length) fail(`${x} 뒤에 값이 필요해요.\n${HELP}`)
      return argv[++i]
    }
    if (x === '--query') a.query.push(next())
    else if (x === '--form') a.form.push(next())
    else if (x === '--json') a.json = next()
    else if (x === '--json-file') {
      a.json = readInput(next(), x)
    } else if (x === '--markdown' || x === '--append-markdown') {
      a[x === '--markdown' ? 'markdown' : 'append'] = readInput(next(), x)
    } else if (x === '--retry') a.retry = true
    else if (x === '--yes') a.yes = true
    else if (x === '-h' || x === '--help') {
      out(HELP)
      process.exit(0)
    } else if (x === '--version') {
      out(VERSION)
      process.exit(0)
    } else a.rest.push(x)
  }
  return a
}

const kv = (s, what) => {
  const i = s.indexOf('=')
  if (i < 1) fail(`${what} 는 이름=값 모양이어야 해요: ${s}`)
  return [s.slice(0, i), s.slice(i + 1)]
}

function explain(status, body, headers) {
  const code = body?.code ?? ''
  const msg = body?.msg ?? body?.message ?? ''
  const tip = {
    401: '토큰이 없거나, 틀렸거나, 회수·만료됐어요. 새 토큰을 만들어 넣어 주세요.',
    403:
      code === 'TOKEN_SCOPE'
        ? '이 토큰에 이 일의 권한 범위가 없어요. 필요한 범위로 토큰을 새로 만들어 주세요.'
        : code === 'TOKEN_ROUTE'
          ? '이 API 는 토큰으로 쓸 수 없어요. references/endpoints.md 의 목록만 돼요.'
          : code === 'TOKEN_POLICY_OFF'
            ? '회사 관리자가 API 토큰을 꺼 두었어요. 관리자에게 물어봐 주세요.'
            : '토큰 주인에게 이 일을 할 권한이 없어요(화면에서와 같은 규칙이에요).',
    404: '없거나, 토큰 주인이 볼 수 없는 것이에요. 키·번호와 projectId 를 확인해 주세요.',
    409: '그 사이 다른 사람이 바꿨어요. 다시 읽고, 덮어쓸지 사람에게 먼저 물어봐 주세요.',
    429: `너무 자주 보냈어요. ${headers.get('retry-after') ?? '잠시'}초 뒤에 다시 보내 주세요.`,
  }[status] ?? (status >= 500 ? '젠타 서버에 문제가 있어요. 잠시 뒤 다시 해 보고, 계속되면 관리자에게 알려 주세요.' : '')
  return [`요청이 거절됐어요 (${status}${code ? ` ${code}` : ''})`, msg && `서버: ${msg}`, tip && `할 일: ${tip}`].filter(Boolean).join('\n')
}

async function call(method, url, headers, body) {
  try {
    return await fetch(url, { method, headers, body, redirect: 'manual' })
  } catch (e) {
    fail(`젠타에 연결하지 못했어요(${url.origin}). 주소와 네트워크를 확인해 주세요. (${e.cause?.code ?? e.message})`, 1)
  }
}

// Turns --markdown / --append-markdown into the page's doc + body. Returns the JSON text to send.
async function withMarkdown(method, path, a, headers) {
  const page = /^\/api\/hub\/wiki(\/[^/?]+)?$/.exec(path)
  if (!(page && ((method === 'POST' && !page[1]) || (method === 'PUT' && page[1])))) fail('--markdown 은 문서 만들기(POST /api/hub/wiki)와 고치기(PUT /api/hub/wiki/{id})에만 써요.')
  let body
  try {
    body = a.json === undefined ? {} : JSON.parse(a.json)
  } catch (e) {
    fail(`--json 이 올바른 JSON 이 아니에요: ${e.message}`)
  }
  if (method === 'POST' && a.append !== undefined) fail('새 문서에는 --markdown 을 써요.')
  if (method === 'PUT') {
    const q = new URLSearchParams()
    if (body.projectId) q.set('projectId', String(body.projectId))
    if (body.scope) q.set('scope', String(body.scope))
    const r = await call('GET', new URL(`${base()}${path}?${q}`), headers)
    const cur = await r.json().catch(() => null)
    if (r.status !== 200) {
      err(hide(explain(r.status, cur, r.headers)))
      process.exit(1)
    }
    const odd = unwritableKinds(cur.doc)
    if (a.markdown !== undefined) {
      if (odd.length && !a.yes) fail(`이 문서에는 이 도구가 못 적는 내용(${odd.join(', ')})이 있어 통째로 바꾸면 사라져요. 사람에게 확인받은 뒤 --yes 를 붙이거나 --append-markdown 을 써 주세요.`)
      Object.assign(body, pagePayload(a.markdown))
    } else {
      const add = docFromMarkdown(a.append)
      const blocks = [...(cur.doc?.blocks ?? []), ...add.blocks]
      const tail = markdownFromDoc(add)
      body.doc = { ...(cur.doc ?? { v: 1, eol: false }), blocks }
      body.body = cur.body ? `${cur.body}\n\n${tail}` : tail
      body.revision ??= cur.revision
    }
    body.title ??= cur.title
    if (body.revision === undefined) fail('문서 고치기에는 읽을 때 받은 판 번호(revision)가 필요해요. 그사이 다른 사람이 고쳤으면 409 로 막아 줘요.')
  } else Object.assign(body, pagePayload(a.markdown))
  return JSON.stringify(body)
}

async function request(method, path, a) {
  if (!path?.startsWith('/api/')) fail(`주소는 /api/ 로 시작해야 해요: ${path ?? '(없음)'}\n${HELP}`)
  if (method === 'DELETE' && !a.yes) fail('지우기는 되돌릴 수 없어요. 사람에게 확인받은 뒤 --yes 를 붙여 다시 보내 주세요.')
  const url = new URL(base() + path)
  for (const q of a.query) url.searchParams.append(...kv(q, '--query'))
  const headers = { authorization: `Bearer ${token()}`, 'user-agent': `zenta-api-skill/${VERSION}` }
  let body
  if (a.json !== undefined && a.form.length) fail('--json 과 --form 은 함께 못 써요.')
  if (a.markdown !== undefined || a.append !== undefined) {
    headers['content-type'] = 'application/json'
    body = await withMarkdown(method, path, a, headers)
  } else if (a.json !== undefined) {
    try {
      JSON.parse(a.json)
    } catch (e) {
      fail(`--json 이 올바른 JSON 이 아니에요: ${e.message}`)
    }
    headers['content-type'] = 'application/json'
    body = a.json
  } else if (a.form.length) {
    headers['content-type'] = 'application/x-www-form-urlencoded'
    body = new URLSearchParams(a.form.map((f) => kv(f, '--form'))).toString()
  }
  for (let attempt = 0; ; attempt++) {
    const r = await call(method, url, headers, body)
    const text = await r.text()
    let data = null
    try {
      data = text ? JSON.parse(text) : null
    } catch {}
    if (r.status === 429 && a.retry && attempt < 2) {
      const wait = Math.min(Number(r.headers.get('retry-after')) || 5, 120)
      err(`429 — ${wait}초 기다렸다가 다시 보내요…`)
      await new Promise((res) => setTimeout(res, wait * 1000))
      continue
    }
    if (r.status >= 300 && r.status < 400) fail(`주소가 다른 곳으로 넘어가요(${r.status}). ZENTA_URL 이 맞는지 확인해 주세요.`, 1)
    if (r.status >= 400 || data?.result === 'error') {
      err(hide(explain(r.status, data, r.headers)))
      process.exit(1)
    }
    out(hide(data === null ? text || `(${r.status}, 본문 없음)` : JSON.stringify(data, null, 2)))
    return
  }
}

const a = parseArgs(process.argv.slice(2))
const [cmd, path] = a.rest
if (!cmd) fail(HELP)
if (cmd === 'check') {
  // Personal tokens may read /auth/me. Bot tokens may not (they only post messages), and the gate answers them with
  // 403 TOKEN_SCOPE only after the token matched a live bot — so that answer means «a working bot token», not a failure.
  const b = base()
  const headers = { authorization: `Bearer ${token()}`, 'user-agent': `zenta-api-skill/${VERSION}` }
  out(`주소: ${b}`)
  const r = await call('GET', new URL(`${b}/api/hub/auth/me`), headers)
  const data = await r.json().catch(() => null)
  if (r.status === 200) {
    const me = data?.user ?? data?.data?.user ?? {}
    out(`개인 토큰이에요 · 주인: ${me.name ?? '(이름 없음)'} — 준비됐어요. 쓸 수 있는 일은 토큰을 만들 때 고른 범위까지예요.`)
    out(hide(JSON.stringify(data, null, 2)))
  } else if (r.status === 403 && data?.code === 'TOKEN_SCOPE') {
    out('봇 토큰이에요 · 범위: chat:write(채널에 글 보내기) — 토큰은 살아 있어요.')
    out('봇은 조직 관리자가 그 봇을 넣어 둔 채널에만 글을 보낼 수 있어요. 이슈·문서·채널 읽기는 개인 토큰이 필요해요.')
    out('실제로 보내지는지는 사람에게 확인받은 뒤 그 채널에 글을 한 번 보내 보면 알 수 있어요(POST /api/v1/messages).')
  } else if (r.status >= 300 && r.status < 400) {
    fail(`주소가 다른 곳으로 넘어가요(${r.status}). ZENTA_URL 이 맞는지 확인해 주세요.`, 1)
  } else {
    err(hide(explain(r.status, data, r.headers)))
    process.exit(1)
  }
} else {
  const method = cmd.toUpperCase()
  if (!['GET', 'POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) fail(`모르는 명령이에요: ${cmd}\n${HELP}`)
  await request(method, path, a)
}
