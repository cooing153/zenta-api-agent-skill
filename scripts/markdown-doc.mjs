// Markdown ⇄ Zenta document tree, for the common blocks an agent writes:
// headings, paragraphs, lists (nested, numbered, to-do), quotes, code, rules, tables,
// and **bold** *italic* ~~strike~~ `code` [links](https://…).
// Zenta stores a page as a tree (`doc`) plus its markdown (`body`, used for search and history); send both.

const newId = () => {
  const a = 'abcdefghijklmnopqrstuvwxyz0123456789'
  let s = ''
  for (let i = 0; i < 11; i++) s += a[Math.floor(Math.random() * a.length)]
  return s
}

// ── inline ──
// Zenta nests marks in one fixed order (outer → inner) and groups neighbours that share the outer mark.
const MARK_ORDER = ['link', 'em', 'strong', 'strike']
const markKey = (m) => (m.kind === 'link' ? `link ${m.href}` : m.kind)

function runsOf(spans, marks = [], out = []) {
  for (const s of spans) {
    if (s.kind === 'text' || s.kind === 'break' || s.kind === 'code') out.push({ leaf: s, marks })
    else runsOf(s.spans, [...marks, s.kind === 'link' ? { kind: 'link', href: s.href } : { kind: s.kind }], out)
  }
  return out
}

function nest(runs, level = 0) {
  const out = []
  for (let i = 0; i < runs.length; ) {
    const outer = (r) => r.marks.filter((m) => MARK_ORDER.indexOf(m.kind) >= level).sort((a, b) => MARK_ORDER.indexOf(a.kind) - MARK_ORDER.indexOf(b.kind))[0]
    const m = outer(runs[i])
    if (!m) {
      const leaf = runs[i].leaf
      const last = out[out.length - 1]
      if (leaf.kind === 'text' && last?.kind === 'text') last.text += leaf.text
      else out.push({ ...leaf })
      i++
      continue
    }
    let j = i
    while (j < runs.length && outer(runs[j]) && markKey(outer(runs[j])) === markKey(m)) j++
    const inner = runs.slice(i, j).map((r) => ({ ...r, marks: r.marks.filter((x) => markKey(x) !== markKey(m)) }))
    const spans = nest(inner, MARK_ORDER.indexOf(m.kind))
    out.push(m.kind === 'link' ? { kind: 'link', href: m.href, spans } : { kind: m.kind, spans })
    i = j
  }
  return out
}

export function parseInline(src) {
  return nest(runsOf(parseRaw(src)))
}

function parseRaw(src) {
  const out = []
  let text = ''
  const flush = () => {
    if (text) out.push({ kind: 'text', text })
    text = ''
  }
  const push = (span) => {
    flush()
    out.push(span)
  }
  for (let i = 0; i < src.length; ) {
    const rest = src.slice(i)
    let m
    if (rest[0] === '\\' && i + 1 < src.length && /[\\`*_~[\]()#>+\-.!|]/.test(src[i + 1])) {
      text += src[i + 1]
      i += 2
    } else if (rest[0] === '\n') {
      push({ kind: 'break' })
      i++
    } else if ((m = /^(`+)([\s\S]*?[^`])\1(?!`)/.exec(rest))) {
      push({ kind: 'code', text: m[2] })
      i += m[0].length
    } else if ((m = /^\*\*(?=\S)((?:\*(?!\*)[^*]+?\*(?!\*)|[^*])+?)(?<=\S)\*\*()/.exec(rest)) || (m = /^__(?=\S)([\s\S]*?\S)__()/.exec(rest))) {
      push({ kind: 'strong', spans: parseRaw(m[1]) })
      i += m[0].length
    } else if ((m = /^~~(?=\S)([\s\S]*?\S)~~/.exec(rest))) {
      push({ kind: 'strike', spans: parseRaw(m[1]) })
      i += m[0].length
    } else if ((m = /^\*(?!\*)(?=\S)((?:\*\*[^*]+?\*\*|[^*])+?)(?<=\S)\*(?!\*)/.exec(rest)) || (/^_/.test(rest) && !/\w$/.test(text) && (m = /^_(?=\S)([\s\S]*?\S)_(?![\w])/.exec(rest)))) {
      push({ kind: 'em', spans: parseRaw(m[1]) })
      i += m[0].length
    } else if ((m = /^\[([^\]\n]+)\]\(([^)\s]+)\)/.exec(rest))) {
      push({ kind: 'link', href: m[2], spans: parseRaw(m[1]) })
      i += m[0].length
    } else {
      text += src[i]
      i++
    }
  }
  flush()
  return out
}

const leafMarkdown = (l) => (l.kind === 'text' ? l.text.replace(/`/g, '\\`') : l.kind === 'break' ? '\n' : '`' + l.text + '`')
const OPEN = { link: '[', em: '*', strong: '**', strike: '~~' }
const close = (m) => (m.kind === 'link' ? `](${m.href})` : OPEN[m.kind])

// Marks stay open while the next piece still has them (like the editor's writer); spaces never sit inside a delimiter.
export function inlineMarkdown(spans) {
  let out = ''
  let open = []
  const shut = (from) => {
    const ws = /\s*$/.exec(out)[0]
    out = out.slice(0, out.length - ws.length)
    for (let k = open.length - 1; k >= from; k--) out += close(open[k])
    out += ws
    open = open.slice(0, from)
  }
  for (const r of runsOf(spans)) {
    const keys = new Set(r.marks.map(markKey))
    const firstGone = open.findIndex((m) => !keys.has(markKey(m)))
    if (firstGone >= 0) shut(firstGone)
    let body = leafMarkdown(r.leaf)
    const adds = r.marks.filter((m) => !open.some((o) => markKey(o) === markKey(m))).sort((x, y) => MARK_ORDER.indexOf(x.kind) - MARK_ORDER.indexOf(y.kind))
    if (adds.length) {
      const lead = /^\s*/.exec(body)[0]
      out += lead
      body = body.slice(lead.length)
      for (const m of adds) out += OPEN[m.kind]
      open = [...open, ...adds]
    }
    out += body
  }
  shut(0)
  return out
}

// ── blocks ──
const FENCE = /^(\s*)(`{3,}|~{3,})\s*([\w+-]*)\s*$/
const HEADING = /^(#{1,6})\s+(.*?)\s*#*\s*$/
const RULE = /^\s*([-*_])(\s*\1){2,}\s*$/
const ITEM = /^(\s*)([-*+]|\d{1,9}[.)])\s+(.*)$/
const QUOTE = /^\s*>\s?(.*)$/
const TABLE_SEP = /^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)*\|?\s*$/

const cells = (line) =>
  line
    .trim()
    .replace(/^\|/, '')
    .replace(/(?<!\\)\|$/, '')
    .split(/(?<!\\)\|/)
    .map((c) => c.trim().replace(/\\\|/g, '|'))

function blocksOf(lines, withIds) {
  const blocks = []
  const add = (b) => blocks.push(withIds ? { id: newId(), ...b } : b)
  let i = 0
  const startsBlock = (l, next) => FENCE.test(l) || HEADING.test(l) || RULE.test(l) || ITEM.test(l) || QUOTE.test(l) || (l.includes('|') && next !== undefined && TABLE_SEP.test(next))
  while (i < lines.length) {
    const line = lines[i]
    if (line.trim() === '') {
      i++
      continue
    }
    let m
    if ((m = FENCE.exec(line))) {
      const close = new RegExp(`^\\s*${m[2][0] === '`' ? '`' : '~'}{${m[2].length},}\\s*$`)
      const body = []
      i++
      while (i < lines.length && !close.test(lines[i])) body.push(lines[i++])
      i++
      add({ kind: 'code', lang: m[3], text: body.join('\n') })
    } else if ((m = HEADING.exec(line))) {
      add({ kind: 'heading', level: m[1].length, spans: parseInline(m[2]) })
      i++
    } else if (RULE.test(line) && !(ITEM.test(line) && !/^\s*([-*_]\s*){3,}$/.test(line))) {
      add({ kind: 'rule' })
      i++
    } else if (line.includes('|') && i + 1 < lines.length && TABLE_SEP.test(lines[i + 1])) {
      const aligns = cells(lines[i + 1]).map((c) => (c.startsWith(':') && c.endsWith(':') ? 'center' : c.endsWith(':') ? 'right' : c.startsWith(':') ? 'left' : null))
      const cell = (t, k) => ({ spans: parseInline(t), align: aligns[k] ?? null })
      const head = cells(line).map(cell)
      const rows = []
      i += 2
      while (i < lines.length && lines[i].includes('|') && lines[i].trim() !== '') {
        const r = cells(lines[i++])
        rows.push(head.map((_, k) => cell(r[k] ?? '', k)))
      }
      add({ kind: 'table', head, rows })
    } else if (QUOTE.test(line)) {
      const parts = []
      while (i < lines.length && QUOTE.test(lines[i])) parts.push(QUOTE.exec(lines[i++])[1])
      add({ kind: 'quote', spans: parseInline(parts.join('\n')) })
    } else if ((m = ITEM.exec(line))) {
      const ordered = /\d/.test(m[2])
      const base = m[1].length
      const items = []
      while (i < lines.length) {
        const im = ITEM.exec(lines[i])
        if (!im || im[1].length !== base || /\d/.test(im[2]) !== ordered) break
        const pad = base + im[2].length + 1
        let first = im[3]
        const item = {}
        const task = /^\[( |x|X)\]\s+/.exec(first)
        if (task) {
          first = first.slice(task[0].length)
          item.checked = task[1] !== ' '
        }
        const own = [first]
        const inner = []
        i++
        while (i < lines.length) {
          const l = lines[i]
          const indent = l.length - l.trimStart().length
          if (l.trim() === '') {
            if (i + 1 < lines.length && lines[i + 1].trim() !== '' && lines[i + 1].length - lines[i + 1].trimStart().length >= pad) {
              inner.push('')
              i++
              continue
            }
            break
          }
          if (indent >= pad || (indent > base && ITEM.test(l))) inner.push(l.slice(Math.min(indent, pad)))
          else if (inner.length === 0 && !startsBlock(l, lines[i + 1])) own.push(l.trim())
          else break
          i++
        }
        const spans = parseInline(own.join('\n'))
        items.push({ spans, ...(inner.length ? { blocks: blocksOf(inner, false) } : {}), ...item })
        if (i < lines.length && lines[i].trim() === '' && i + 1 < lines.length && ITEM.test(lines[i + 1]) && ITEM.exec(lines[i + 1])[1].length === base) i++
      }
      add({ kind: 'list', ordered, start: ordered ? Number.parseInt(m[2], 10) : 1, items })
    } else {
      const para = []
      while (i < lines.length && lines[i].trim() !== '' && (para.length === 0 || !startsBlock(lines[i], lines[i + 1]))) para.push(lines[i++].replace(/\s+$/, '').replace(/\\$/, ''))
      add({ kind: 'paragraph', spans: parseInline(para.join('\n')) })
    }
  }
  return blocks
}

export function docFromMarkdown(md) {
  return { v: 1, blocks: blocksOf(String(md).replace(/\r\n?/g, '\n').split('\n'), true), eol: false }
}

function blockMarkdown(b, indent) {
  const ind = (s) => s.split('\n').map((l) => (l === '' ? '' : indent + l)).join('\n')
  switch (b.kind) {
    case 'heading':
      return ind('#'.repeat(b.level) + ' ' + inlineMarkdown(b.spans))
    case 'paragraph':
      return ind(inlineMarkdown(b.spans))
    case 'quote':
      return ind(
        inlineMarkdown(b.spans)
          .split('\n')
          .map((l) => (l === '' ? '>' : '> ' + l))
          .join('\n'),
      )
    case 'code':
      return ind('```' + (b.lang ?? '') + '\n' + b.text + '\n```')
    case 'rule':
      return ind('---')
    case 'table': {
      const row = (cs) => '| ' + cs.map((c) => inlineMarkdown(c.spans).replace(/\|/g, '\\|')).join(' | ') + ' |'
      const sep = '| ' + b.head.map((c) => ({ left: ':--', center: ':-:', right: '--:' })[c.align] ?? '---').join(' | ') + ' |'
      return ind([row(b.head), sep, ...b.rows.map(row)].join('\n'))
    }
    case 'list':
      return b.items
        .map((it, k) => {
          const marker = b.ordered ? `${b.start + k}.` : '-'
          const box = it.checked === undefined ? '' : it.checked ? '[x] ' : '[ ] '
          const head = indent + marker + ' ' + box + inlineMarkdown(it.spans).replace(/\n/g, '\n' + indent + ' '.repeat(marker.length + 1))
          const kids = (it.blocks ?? []).map((c) => (c.kind === 'list' ? '\n' : '\n\n') + blockMarkdown(c, indent + ' '.repeat(marker.length + 1)))
          return head + kids.join('')
        })
        .join('\n')
    default:
      throw new Error(`이 도구가 마크다운으로 못 적는 블록이에요: ${b.kind}`)
  }
}

export function markdownFromDoc(tree) {
  return tree.blocks.map((b) => blockMarkdown(b, '')).join('\n\n')
}

// Kinds this helper can write back; a page holding others (cards, columns, files…) should be edited in Zenta itself.
export const WRITABLE = new Set(['heading', 'paragraph', 'quote', 'code', 'rule', 'table', 'list'])
export const unwritableKinds = (tree) => [...new Set((tree?.blocks ?? []).map((b) => b.kind).filter((k) => !WRITABLE.has(k)))]

export function pagePayload(md) {
  const doc = docFromMarkdown(md)
  return { doc, body: markdownFromDoc(doc) }
}
