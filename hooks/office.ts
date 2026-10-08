// The agents panel as an office seen from above: one SVG, pixel sprites on a
// 2px grid, text in the system font. Pure: data in, markup out.

export type DeskStatus = 'running' | 'done' | 'failed' | 'planned'

export type Desk = {
  key: string
  title: string
  /** `opus`, `sonnet`, `haiku`, `fable` or `other`: the chair's color. */
  family: string
  /** The badge: `Opus 4.6 · high`, or what a planned task's tier runs on. */
  model: string
  status: DeskStatus
  /** 0..1 when the worker reports steps; null draws no bar. */
  progress: number | null
  /** `3/5 · writing tests` */
  steps: string
  /** A planned task's number and what it waits for. */
  n?: number
  after?: number[]
}

export type Boss = {
  status: 'working' | 'idle'
  task: string
  family: string
  model: string
  /** Context fill, 0..100. */
  ctx: number
}

export type Part = { cost: string; tokens: string; time: string }

export type Words = {
  main: string
  subagents: string
  total: string
  cost: string
  tokens: string
  time: string
  idle: string
  pantry: string
  floor: string
  after: string
}

export type Office = {
  boss: Boss
  desks: Desk[]
  board: { main: Part; subs: Part; total: Part }
  words: Words
  /** `light` or `dark` pins one palette (previews); `auto` follows the system. */
  theme?: 'auto' | 'light' | 'dark'
}

const FONT = "-apple-system,BlinkMacSystemFont,'SF Pro Text','Segoe UI',sans-serif"

export const FAMILY_COLOR: Record<string, string> = {
  opus: '#8f8cf4',
  sonnet: '#4f9de0',
  haiku: '#3fb58a',
  fable: '#e0a33a',
  other: '#9a9a96',
}

export const colorOfFamily = (family: string): string => FAMILY_COLOR[family] ?? '#9a9a96'

export const familyOf = (model: string): string => {
  const m = /(fable|mythos|opus|sonnet|haiku)/i.exec(model)
  const f = (m?.[1] ?? '').toLowerCase()
  return f === 'mythos' ? 'fable' : f || 'other'
}

const xml = (s: string): string =>
  s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c] ?? c)

const charEm = (ch: string): number =>
  /[\s.,:;'|!il1()[\]]/.test(ch) ? 0.3 : /[A-ZА-ЯЁmwшщжюМШЩЖЮ@%]/.test(ch) ? 0.72 : 0.56

export const textWidth = (s: string, size: number): number => [...s].reduce((w, ch) => w + charEm(ch) * size, 0)

export const fitText = (s: string, size: number, maxW: number): string => {
  if (textWidth(s, size) <= maxW) return s
  let out = ''
  for (const ch of s) {
    if (textWidth(out + ch + '…', size) > maxW) break
    out += ch
  }
  return out + '…'
}

// ---------------------------------------------------------------------------
// Palette: classes, so one drawing serves both themes.

const LIGHT = `.fl{fill:#f4f2ed}.gr{fill:#ebe8e1}.wl{fill:#e3dfd6}.wn{fill:#d6e9f5}.dk{fill:#dcc9a8}.dke{fill:#c7b28d}
.mo{fill:#2b2b2e}.kb{fill:#c9c6bf}.sk{fill:#e9b48f}.hr{fill:#5a4636}.sh{fill:#e7e4dd}.pl{fill:#cfccc4}
.bl{fill:#ffffff;stroke:#dcd9d1}.bd{fill:#ffffff;stroke:#dcd9d1}.t{fill:#1f1f1f}.s{fill:#6b6b68}.m{fill:#a3a39e}
.tr{fill:#e6e3dc}.cp{fill:#ebe5da}.ct{fill:#d5ccbc}.lf{fill:#6aa56f}.pt{fill:#c8b8a0}.ds{stroke:#c9c5bc}`

const DARK = `.fl{fill:#1e1e1d}.gr{fill:#232322}.wl{fill:#2a2a28}.wn{fill:#2c3a44}.dk{fill:#4d4236}.dke{fill:#3c342b}
.mo{fill:#0f0f10}.kb{fill:#5b5853}.sk{fill:#d9a07b}.hr{fill:#3b2e24}.sh{fill:#3a3936}.pl{fill:#4a4844}
.bl{fill:#2c2c2b;stroke:#3d3d3b}.bd{fill:#262625;stroke:#3a3a38}.t{fill:#ececec}.s{fill:#a8a8a4}.m{fill:#6f6f6b}
.tr{fill:#2e2e2c}.cp{fill:#262421}.ct{fill:#3a342c}.lf{fill:#4f8a55}.pt{fill:#5a4c3c}.ds{stroke:#4a4844}`

const MOTION = `.on .sc{animation:sc 2.4s steps(2) infinite}@keyframes sc{50%{opacity:.55}}
.on .hl{animation:ty .36s steps(1) infinite}.on .hr2{animation:ty .36s steps(1) infinite -.18s}
@keyframes ty{50%{transform:translateY(-2px)}}
.live{animation:lv 1.6s ease-in-out infinite}@keyframes lv{50%{opacity:.3}}
.sip{animation:sp 3s steps(1) infinite}@keyframes sp{80%{transform:translateY(-2px)}}
@media (prefers-reduced-motion: reduce){.on .sc,.on .hl,.on .hr2,.live,.sip{animation:none}}`

const style = (theme: Office['theme']): string => {
  if (theme === 'light') return `<style>${LIGHT}${MOTION}</style>`
  if (theme === 'dark') return `<style>${DARK}${MOTION}</style>`
  return `<style>${LIGHT}@media (prefers-color-scheme: dark){${DARK}}${MOTION}</style>`
}

// ---------------------------------------------------------------------------
// Sprites. `r` draws a rect on the 2px grid from (x, y) in grid units.

const P = 2
const rect = (x: number, y: number, w: number, h: number, cls: string, extra = ''): string =>
  `<rect x="${x}" y="${y}" width="${w}" height="${h}" class="${cls}"${extra}/>`
const rectFill = (x: number, y: number, w: number, h: number, fill: string, extra = ''): string =>
  `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${fill}"${extra}/>`

/** Someone seated, seen from above, facing up at the desk; hands on the keys when typing. */
const seated = (cx: number, top: number, chair: string, isTyping: boolean): string => {
  const x = cx - 6 * P
  return `<g>
${rectFill(x - P, top + 3 * P, 14 * P, 10 * P, chair, ' rx="3"')}
${rectFill(x - P, top + 11 * P, 14 * P, 2 * P, chair, ' opacity=".7" rx="1"')}
${rect(x + P, top + 5 * P, 10 * P, 5 * P, 'sh', ' rx="2"')}
${rect(x + 3 * P, top + 1 * P, 6 * P, 5 * P, 'hr', ' rx="3"')}
${isTyping ? `<g class="hl">${rect(x + P, top - P, 2 * P, 2 * P, 'sk')}</g><g class="hr2">${rect(x + 9 * P, top - P, 2 * P, 2 * P, 'sk')}</g>` : rect(x + 0, top + 6 * P, 2 * P, 3 * P, 'sk') + rect(x + 10 * P, top + 6 * P, 2 * P, 3 * P, 'sk')}
</g>`
}

/** Someone standing with a cup, seen from above. */
const standing = (cx: number, top: number, shirt: string): string => {
  const x = cx - 5 * P
  return `<g class="sip">
${rectFill(x, top + 4 * P, 10 * P, 5 * P, shirt, ' rx="2"')}
${rect(x + 2 * P, top, 6 * P, 5 * P, 'hr', ' rx="3"')}
${rect(x + 9 * P, top + 5 * P, 3 * P, 3 * P, 'bl', ' rx="1"')}
</g>`
}

/** A desk: top, monitor (lit when someone works), keyboard, a mug. */
const desk = (cx: number, top: number, w: number, isLit: boolean, isDim: boolean, monitors = 1): string => {
  const x = cx - w / 2
  const mw = 13 * P
  const screens = Array.from({ length: monitors }, (_, i) => {
    const mx = cx - (monitors * mw + (monitors - 1) * 3 * P) / 2 + i * (mw + 3 * P)
    return `${rect(mx, top + P, mw, 3 * P, 'mo', ' rx="1"')}${isLit ? `<rect class="sc" x="${mx + P}" y="${top + 4 * P}" width="${mw - 2 * P}" height="${P}" fill="#8fd3ff"/>` : ''}`
  }).join('')
  return `<g${isDim ? ' opacity=".55"' : ''}>
${rect(x, top, w, 11 * P, 'dk', ' rx="2"')}
${rect(x, top + 10 * P, w, P, 'dke')}
${screens}
${rect(cx - 5 * P, top + 6 * P, 10 * P, 2 * P, 'kb', ' rx="1"')}
${rect(x + w - 6 * P, top + 5 * P, 3 * P, 3 * P, 'bl', ' rx="2"')}
</g>`
}

const plant = (x: number, y: number): string =>
  `${rect(x, y + 6 * P, 6 * P, 4 * P, 'pt', ' rx="1"')}${rect(x - P, y, 3 * P, 4 * P, 'lf', ' rx="2"')}${rect(x + 2 * P, y - P, 3 * P, 6 * P, 'lf', ' rx="2"')}${rect(x + 4 * P, y + P, 3 * P, 4 * P, 'lf', ' rx="2"')}`

const statusMark = (x: number, y: number, status: DeskStatus, color: string): string => {
  if (status === 'running') return `<circle class="live" cx="${x}" cy="${y}" r="3.5" fill="${color}"/>`
  if (status === 'done')
    return `<circle cx="${x}" cy="${y}" r="7" fill="#3B9C5F"/><path d="M${x - 3.2} ${y}l2.2 2.2 4.2-4.6" fill="none" stroke="#fff" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>`
  if (status === 'failed')
    return `<circle cx="${x}" cy="${y}" r="7" fill="#D0453F"/><path d="M${x - 2.6} ${y - 2.6}l5.2 5.2M${x + 2.6} ${y - 2.6}l-5.2 5.2" stroke="#fff" stroke-width="1.6" stroke-linecap="round"/>`
  return ''
}

/** A speech balloon over (cx, bottom) with a line of text and an optional thin bar. */
const balloon = (cx: number, bottom: number, w: number, text: string, progress: number | null, color: string): string => {
  const h = progress === null ? 20 : 24
  const x = Math.round(cx - w / 2)
  const y = bottom - h - 5
  const bar =
    progress === null
      ? ''
      : `<rect class="tr" x="${x + 7}" y="${y + h - 7}" width="${w - 14}" height="2.5" rx="1.25"/><rect x="${x + 7}" y="${y + h - 7}" width="${Math.round((w - 14) * progress)}" height="2.5" rx="1.25" fill="${color}"/>`
  return `<g>
<rect class="bl" x="${x}" y="${y}" width="${w}" height="${h}" rx="6" stroke-width="1"/>
<path class="bl" d="M${cx - 4} ${y + h - 0.5}l4 5 4-5" stroke-width="1"/>
<rect class="bl" x="${cx - 5}" y="${y + h - 2}" width="10" height="2" stroke="none"/>
<text class="t" x="${x + 7}" y="${y + 13}" font-family="${FONT}" font-size="11">${xml(fitText(text, 11, w - 14))}</text>
${bar}
</g>`
}

const badge = (x: number, y: number, text: string, color: string, maxW: number): string => {
  const label = fitText(text, 10, maxW - 14)
  return `<g><circle cx="${x + 3}" cy="${y - 3.5}" r="3" fill="${color}"/><text class="s" x="${x + 10}" y="${y}" font-family="${FONT}" font-size="10">${xml(label)}</text></g>`
}

// ---------------------------------------------------------------------------
// Layout.

const PAD = 12
const WALL = 14
const CELL_W = 150
const CELL_H = 128
const ROWS_PER_FLOOR = 2
const BOARD_W = 214
const BOARD_H = 76

const floorTiles = (y: number, W: number, h: number): string => {
  const out = [rect(0, y, W, h, 'fl')]
  for (let gx = 24; gx < W; gx += 24) out.push(rect(gx, y, 1, h, 'gr'))
  for (let gy = y + 24; gy < y + h; gy += 24) out.push(rect(0, gy, W, 1, 'gr'))
  return out.join('')
}

const wall = (y: number, W: number): string => {
  const out = [rect(0, y, W, WALL, 'wl')]
  for (let x = 40; x + 46 < W; x += 120) out.push(rect(x, y + 4, 46, 6, 'wn', ' rx="1"'))
  return out.join('')
}

const board = (x: number, y: number, o: Office): string => {
  const w = o.words
  const colW = (BOARD_W - 62) / 3
  const head = [w.main, w.subagents, w.total]
    .map((h, i) => `<text class="s" x="${x + 62 + colW * (i + 1) - 8}" y="${y + 17}" text-anchor="end" font-family="${FONT}" font-size="10">${xml(fitText(h, 10, colW - 4))}</text>`)
    .join('')
  const row = (label: string, k: keyof Part, i: number) => {
    const ry = y + 34 + i * 15
    const cells = [o.board.main, o.board.subs, o.board.total]
      .map(
        (p, c) =>
          `<text class="${c === 2 ? 't' : 's'}" x="${x + 62 + colW * (c + 1) - 8}" y="${ry}" text-anchor="end" font-family="${FONT}" font-size="11"${c === 2 ? ' font-weight="600"' : ''} font-variant-numeric="tabular-nums">${xml(p[k])}</text>`,
      )
      .join('')
    return `<text class="m" x="${x + 10}" y="${ry}" font-family="${FONT}" font-size="10">${xml(label)}</text>${cells}`
  }
  return `<g>
<rect class="bd" x="${x}" y="${y}" width="${BOARD_W}" height="${BOARD_H}" rx="8" stroke-width="1"/>
${head}
<rect class="tr" x="${x + 10}" y="${y + 22}" width="${BOARD_W - 20}" height="1"/>
${row(w.cost, 'cost', 0)}${row(w.tokens, 'tokens', 1)}${row(w.time, 'time', 2)}
</g>`
}

const bossZone = (x: number, y: number, w: number, o: Office): string => {
  const b = o.boss
  const color = colorOfFamily(b.family)
  const cx = x + Math.min(w, 260) / 2
  const isWorking = b.status === 'working'
  const deskTop = y + 34
  const label = isWorking ? b.task || '…' : o.words.idle
  return `<g class="${isWorking ? 'on' : ''}">
${rect(cx - 70, y + 26, 140, 66, 'cp', ' rx="6" opacity=".6"')}
${plant(cx + 76, deskTop + 4)}
${desk(cx, deskTop, 112, isWorking, false, 2)}
${seated(cx, deskTop + 12 * P, color, isWorking)}
${isWorking ? balloon(cx, deskTop - 2, Math.min(w - 8, 240), label, null, color) : `<text class="m" x="${cx}" y="${deskTop - 8}" text-anchor="middle" font-family="${FONT}" font-size="11">${xml(label)}</text>`}
<text class="t" x="${cx}" y="${deskTop + 33 * P + 2}" text-anchor="middle" font-family="${FONT}" font-size="11.5" font-weight="600">${xml(o.words.main)}</text>
${badge(cx - Math.min(textWidth(b.model, 10) + 14, w) / 2, deskTop + 33 * P + 16, `${b.model} · ctx ${b.ctx}%`, color, w)}
${statusMark(cx + 62, deskTop + 2, isWorking ? 'running' : 'planned', color)}
</g>`
}

const deskCell = (x: number, y: number, w: number, d: Desk, words: Words): string => {
  const color = colorOfFamily(d.family)
  const cx = x + w / 2
  const deskTop = y + 34
  const isWorking = d.status === 'running'
  const isPlanned = d.status === 'planned'
  const title = isPlanned && d.n ? `${d.n}. ${d.title}` : d.title
  const top = isWorking
    ? balloon(cx, deskTop - 2, w - 16, d.steps ? `${d.title} · ${d.steps}` : d.title, d.progress, color)
    : ''
  // An empty chair waits at a desk nobody sits at.
  const chair = isWorking
    ? seated(cx, deskTop + 12 * P, color, true)
    : `${rectFill(cx - 7 * P, deskTop + 15 * P, 14 * P, 10 * P, color, ` rx="3" opacity="${isPlanned ? 0.35 : 0.8}"`)}${rectFill(cx - 7 * P, deskTop + 23 * P, 14 * P, 2 * P, color, ` rx="1" opacity="${isPlanned ? 0.25 : 0.55}"`)}`
  const sub = isPlanned
    ? [d.model, d.after?.length ? `${words.after} ${d.after.join(', ')}` : ''].filter(Boolean).join(' · ')
    : d.model
  return `<g class="${isWorking ? 'on' : ''}">
${isPlanned ? `<rect class="ds" x="${cx - 38}" y="${deskTop - 3}" width="76" height="${11 * P + 6}" rx="4" fill="none" stroke-dasharray="3 3"/>` : ''}
${desk(cx, deskTop, 64, isWorking, isPlanned)}
${chair}
${top}
${statusMark(cx + 30, deskTop + 1, d.status, color)}
<text class="${isPlanned ? 's' : 't'}" x="${cx}" y="${deskTop + 33 * P + 2}" text-anchor="middle" font-family="${FONT}" font-size="11"${isPlanned ? '' : ' font-weight="600"'}>${xml(fitText(title, 11, w - 12))}</text>
${badge(cx - Math.min(textWidth(sub, 10) + 14, w - 12) / 2, deskTop + 33 * P + 16, sub, color, w - 12)}
</g>`
}

const pantry = (y: number, W: number, people: Desk[], o: Office): string => {
  const h = 58
  const max = Math.max(1, Math.floor((W - 150) / 30))
  const shown = people.slice(0, max)
  const more = people.length - shown.length
  return `<g>
${rect(0, y, W, h, 'cp')}
${rect(PAD, y + 10, 56, 14, 'ct', ' rx="2"')}${rect(PAD + 6, y + 6, 12, 12, 'mo', ' rx="2"')}${rect(PAD + 26, y + 9, 8, 8, 'bl', ' rx="2"')}
<circle class="ct" cx="${PAD + 100}" cy="${y + 30}" r="13"/>
<text class="m" x="${PAD}" y="${y + h - 8}" font-family="${FONT}" font-size="10">${xml(o.words.pantry)}</text>
${shown.map((p, i) => standing(PAD + 136 + i * 30, y + 14, colorOfFamily(p.family))).join('')}
${more > 0 ? `<text class="s" x="${PAD + 136 + shown.length * 30}" y="${y + 30}" font-family="${FONT}" font-size="11">+${more}</text>` : ''}
</g>`
}

export type Drawn = { svg: string; height: number }

/** The whole office at width W; its height follows the number of desks. */
export const officeSvg = (W: number, o: Office): Drawn => {
  const isNarrow = W < BOARD_W + 280
  const cols = Math.max(1, Math.floor((W - 2 * PAD) / CELL_W))
  const cellW = (W - 2 * PAD) / cols
  const perFloor = cols * ROWS_PER_FLOOR
  const floors: Desk[][] = []
  for (let i = 0; i < o.desks.length; i += perFloor) floors.push(o.desks.slice(i, i + perFloor))

  const parts: string[] = []
  let y = 0
  // Ground floor: the wall, the boss, the scoreboard.
  const bossH = 138 + (isNarrow ? BOARD_H + 10 : 0)
  parts.push(floorTiles(0, W, WALL + bossH))
  parts.push(wall(0, W))
  parts.push(bossZone(PAD, WALL + 4, isNarrow ? W - 2 * PAD : W - 2 * PAD - BOARD_W - 12, o))
  parts.push(board(isNarrow ? PAD : W - PAD - BOARD_W, isNarrow ? WALL + 142 : WALL + 12, o))
  y = WALL + bossH

  floors.forEach((list, f) => {
    const rows = Math.ceil(list.length / cols)
    const h = 22 + rows * CELL_H
    parts.push(floorTiles(y, W, h))
    if (f > 0 || floors.length > 1)
      parts.push(`${rect(0, y, W, 18, 'wl')}<text class="s" x="${PAD}" y="${y + 13}" font-family="${FONT}" font-size="10">${xml(o.words.floor.replace('{n}', String(f + 1)))}</text>`)
    else parts.push(rect(PAD, y + 6, W - 2 * PAD, 1, 'gr'))
    list.forEach((d, i) => parts.push(deskCell(PAD + (i % cols) * cellW, y + 18 + Math.floor(i / cols) * CELL_H, cellW, d, o.words)))
    y += h
  })

  const done = o.desks.filter(d => d.status === 'done')
  parts.push(pantry(y, W, done, o))
  y += 58

  return {
    height: y,
    svg: `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${y}" viewBox="0 0 ${W} ${y}" shape-rendering="crispEdges">${style(o.theme)}${parts.join('')}</svg>`,
  }
}

// ---------------------------------------------------------------------------
// The band above the prompt: one thin line in the office's colors.

export type Band = {
  title: string
  /** `Tasks 3/7`, `Plan`, or the main session's state. */
  label: string
  /** 0..1, or null when nothing is planned (main session alone). */
  progress: number | null
  cost: string
  isWorking: boolean
  isFinished: boolean
  family: string
  theme?: 'auto' | 'light' | 'dark'
}

export const BAND_H = 22

export const bandSvg = (W: number, b: Band): string => {
  const color = b.isFinished ? '#3B9C5F' : colorOfFamily(b.family)
  const title = fitText(b.title, 12.5, Math.max(60, W * 0.35))
  const tx = 18 + textWidth(title, 12.5) + 10
  const label = fitText(b.label, 11.5, 140)
  const lx = tx
  const barX = Math.round(lx + textWidth(label, 11.5) + 12)
  const costW = textWidth(b.cost, 11.5) + 6
  const barW = Math.max(0, W - barX - costW - 10)
  const y = BAND_H / 2
  const bar =
    b.progress === null || barW < 40
      ? ''
      : `<rect class="tr" x="${barX}" y="${y - 1.5}" width="${barW}" height="3" rx="1.5"/><rect x="${barX}" y="${y - 1.5}" width="${Math.round(barW * b.progress)}" height="3" rx="1.5" fill="${color}"/>`
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${BAND_H}" viewBox="0 0 ${W} ${BAND_H}">${style(b.theme)}
<g class="${b.isWorking ? 'on' : ''}">${rect(1, 6, 10, 7, 'mo', ' rx="1"')}${b.isWorking ? `<rect class="sc" x="2" y="12" width="8" height="2" fill="#8fd3ff"/>` : ''}${rectFill(3, 15, 6, 4, color, ' rx="1"')}</g>
<text class="t" x="18" y="${y + 4.3}" font-family="${FONT}" font-size="12.5" font-weight="600">${xml(title)}</text>
<text class="s" x="${lx}" y="${y + 4}" font-family="${FONT}" font-size="11.5" font-variant-numeric="tabular-nums">${xml(label)}</text>
${bar}
<text class="s" x="${W - 2}" y="${y + 4}" text-anchor="end" font-family="${FONT}" font-size="11.5" font-variant-numeric="tabular-nums">${xml(b.cost)}</text>
</svg>`
}
