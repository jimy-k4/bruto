/**
 * The launch video: the example project driven by a script, with a title,
 * captions, the keys pressed and an end card. Frames come straight from
 * Chrome, as it paints them, and are put together at 30 fps and 1920×1080
 * with the ffmpeg that Playwright installs (VP8 only, so WebM, which YouTube
 * takes).
 *
 * Run with `npm run video`; it writes launch/bruto-launch.webm.
 */
import { spawn } from 'node:child_process'
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { homedir, tmpdir } from 'node:os'
import { join } from 'node:path'
import { chromium, expect, test, type Locator, type Page } from '@playwright/test'

/** 1728×972 drawn at 10/9: 1920×1080 frames, with the app a little larger than on a laptop. */
const VIEWPORT = { width: 1728, height: 972 }
const SCALE = 10 / 9
const FPS = 30
const OUTPUT = 'launch/bruto-launch.webm'

const TASK = 'Waitlist for full slots'

/** What the agent writes back into the note, as it would through the MCP server. */
const ANSWER = {
  status: 'review',
  aiResponse: [
    'Added a waitlist to full slots.',
    '',
    '- **Join the waitlist** on every full slot',
    '- An email when a spot opens',
    '',
    'Apply the migration:',
    '',
    '```bash',
    'npx supabase db push',
    '```',
  ].join('\n'),
  aiFilePaths: [
    'app/calendar/Waitlist.tsx',
    'app/api/waitlist/route.ts',
    'supabase/migrations/20260301_waitlist.sql',
  ],
}

/**
 * Drawn over the app in every page: a cursor, click marks, captions, the keys
 * pressed, a terminal and full-screen cards. Serialised into the page, so it
 * can only use what it declares.
 */
function overlays() {
  const CSS = `
    #v-root { position: fixed; inset: 0; z-index: 2147483646; pointer-events: none; }
    #v-root * { box-sizing: border-box; }
    #v-cursor { position: fixed; left: 0; top: 0; pointer-events: none; width: 30px; height: 34px; z-index: 2147483647; transform: translate(-200px, -200px); }
    .v-click { position: fixed; width: 16px; height: 16px; border: 3px solid #ff6b2c; translate: -50% -50%; animation: v-click 500ms ease-out forwards; }
    @keyframes v-click { to { width: 64px; height: 64px; opacity: 0; } }
    #v-caption { position: fixed; left: 50%; bottom: 58px; display: flex; border: 3px solid #edece5; background: #1a1a19; color: #edece5; box-shadow: 8px 8px 0 #ff6b2c; translate: -50% 24px; opacity: 0; transition: opacity 260ms, translate 320ms cubic-bezier(0.2, 0.9, 0.3, 1); }
    #v-caption.is-on { translate: -50% 0; opacity: 1; }
    #v-caption .n { display: grid; place-items: center; min-width: 76px; padding: 0 16px; border-right: 3px solid #edece5; background: #ff6b2c; color: #151514; font: 400 34px/1 'Archivo Black', sans-serif; }
    #v-caption .t { display: grid; gap: 6px; padding: 14px 26px 16px 22px; }
    #v-caption b { font: 400 30px/1.05 'Archivo Black', sans-serif; font-weight: 400; text-transform: uppercase; white-space: nowrap; }
    #v-caption span { color: #b7b6ae; font: 500 17px/1.35 'IBM Plex Mono', monospace; white-space: nowrap; }
    #v-keys { position: fixed; right: 44px; bottom: 58px; display: flex; gap: 12px; }
    .v-key { display: grid; place-items: center; min-width: 70px; height: 70px; padding: 0 16px; border: 3px solid #151514; background: #edece5; color: #151514; font: 400 28px/1 'Archivo Black', sans-serif; box-shadow: 0 6px 0 #8d8c86, 6px 10px 0 #ff6b2c; animation: v-key 220ms cubic-bezier(0.2, 0.9, 0.3, 1.4); }
    @keyframes v-key { from { transform: translateY(16px) scale(0.8); opacity: 0; } }
    #v-term { position: fixed; left: 300px; top: 330px; width: 660px; border: 3px solid #edece5; background: #151514; color: #edece5; box-shadow: 8px 8px 0 #ff6b2c; opacity: 0; translate: 0 20px; transition: opacity 260ms, translate 320ms cubic-bezier(0.2, 0.9, 0.3, 1); }
    #v-term.is-on { opacity: 1; translate: 0 0; }
    #v-term header { display: flex; justify-content: space-between; padding: 8px 14px; border-bottom: 3px solid #edece5; background: #edece5; color: #151514; font: 600 13px/1 'IBM Plex Mono', monospace; letter-spacing: 0.12em; text-transform: uppercase; }
    #v-term pre { min-height: 190px; margin: 0; padding: 16px 18px; font: 400 17px/1.6 'IBM Plex Mono', monospace; white-space: pre-wrap; }
    #v-term .dim { color: #8d8c86; } #v-term .ok { color: #7fc98a; } #v-term .sig { color: #ff6b2c; }
    #v-card { position: fixed; inset: 0; display: grid; place-content: center; justify-items: start; gap: 0; padding: 0 160px; background-color: #1a1a19; background-image: linear-gradient(rgba(237,236,229,0.08) 2px, transparent 2px), linear-gradient(90deg, rgba(237,236,229,0.08) 2px, transparent 2px), linear-gradient(rgba(237,236,229,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(237,236,229,0.04) 1px, transparent 1px); background-size: 160px 160px, 160px 160px, 32px 32px, 32px 32px; color: #edece5; clip-path: inset(0 0 0 0); transition: clip-path 700ms cubic-bezier(0.7, 0, 0.2, 1); }
    #v-card.is-off { clip-path: inset(0 0 100% 0); }
    #v-card::after { content: ''; position: absolute; left: 0; right: 0; bottom: 0; height: 12px; background: #ff6b2c; }
    #v-card .eyebrow { color: #b7b6ae; font: 600 20px/1 'IBM Plex Mono', monospace; letter-spacing: 0.2em; text-transform: uppercase; }
    #v-card .word { margin: 22px 0 0 -8px; font: 400 230px/0.86 'Archivo Black', sans-serif; text-shadow: 12px 12px 0 #ff6b2c; animation: v-rise 700ms cubic-bezier(0.2, 0.9, 0.3, 1) both; }
    #v-card .line { margin-top: 44px; font: 400 34px/1.45 'IBM Plex Mono', monospace; animation: v-rise 700ms 150ms cubic-bezier(0.2, 0.9, 0.3, 1) both; }
    #v-card .line b { padding: 0 10px; background: #edece5; color: #1a1a19; font-weight: 600; }
    #v-card .facts { display: flex; gap: 14px; margin-top: 40px; animation: v-rise 700ms 250ms cubic-bezier(0.2, 0.9, 0.3, 1) both; }
    #v-card .facts span { padding: 8px 14px; border: 3px solid #edece5; font: 600 20px/1 'IBM Plex Mono', monospace; letter-spacing: 0.08em; text-transform: uppercase; }
    #v-card .url { margin-top: 44px; padding: 16px 24px; border: 3px solid #edece5; background: #edece5; color: #151514; font: 400 40px/1 'Archivo Black', sans-serif; box-shadow: 10px 10px 0 #ff6b2c; animation: v-rise 700ms 350ms cubic-bezier(0.2, 0.9, 0.3, 1) both; }
    #v-card .handles { margin-top: 34px; color: #b7b6ae; font: 600 22px/1 'IBM Plex Mono', monospace; letter-spacing: 0.08em; animation: v-rise 700ms 450ms cubic-bezier(0.2, 0.9, 0.3, 1) both; }
    @keyframes v-rise { from { opacity: 0; transform: translateY(40px); } }
  `

  const CURSOR = `<svg viewBox="0 0 30 34" width="30" height="34"><path d="M3 2 L3 27 L10 21 L15 32 L20 30 L15 19 L25 19 Z" fill="#edece5" stroke="#151514" stroke-width="2.5" stroke-linejoin="round"/></svg>`

  const setup = () => {
    if (document.getElementById('v-root')) return

    const style = document.createElement('style')
    const root = document.createElement('div')
    const cursor = document.createElement('div')

    style.textContent = CSS
    root.id = 'v-root'
    cursor.id = 'v-cursor'
    cursor.innerHTML = CURSOR
    document.head.append(style)
    document.body.append(root, cursor)

    addEventListener(
      'mousemove',
      (event) =>
        (cursor.style.transform = `translate(${event.clientX - 3}px, ${event.clientY - 2}px)`),
      true,
    )
    addEventListener(
      'mousedown',
      (event) => {
        const mark = document.createElement('div')

        mark.className = 'v-click'
        mark.style.left = `${event.clientX}px`
        mark.style.top = `${event.clientY}px`
        root.append(mark)
        setTimeout(() => mark.remove(), 600)
      },
      true,
    )
  }

  const element = (id: string, tag = 'div') => {
    setup()

    const existing = document.getElementById(id)

    if (existing) return existing

    const created = document.createElement(tag)

    created.id = id
    document.getElementById('v-root')!.append(created)

    return created
  }

  const video = {
    caption(number: string, title: string, text: string) {
      const caption = element('v-caption')

      caption.classList.remove('is-on')
      setTimeout(
        () => {
          caption.innerHTML = `<div class="n">${number}</div><div class="t"><b>${title}</b><span>${text}</span></div>`
          caption.classList.add('is-on')
        },
        caption.innerHTML ? 260 : 0,
      )
    },
    hideCaption() {
      element('v-caption').classList.remove('is-on')
    },
    keys(keys: string[]) {
      const box = element('v-keys')

      box.innerHTML = keys.map((key) => `<span class="v-key">${key}</span>`).join('')
      clearTimeout((box as HTMLElement & { timer?: number }).timer)
      ;(box as HTMLElement & { timer?: number }).timer = window.setTimeout(
        () => (box.innerHTML = ''),
        1300,
      )
    },
    async terminal(title: string, lines: string[]) {
      const term = element('v-term')

      term.innerHTML = `<header><span>${title}</span><span>MCP</span></header><pre></pre>`
      term.classList.add('is-on')

      const pre = term.querySelector('pre')!

      for (const line of lines) {
        const row = document.createElement('div')

        pre.append(row)
        // Commands are typed; what the tools answer shows up at once.
        if (line.startsWith('$') || line.startsWith('>')) {
          for (let end = 1; end <= line.length; end++) {
            row.textContent = line.slice(0, end)
            await new Promise((resolve) => setTimeout(resolve, 22))
          }
        } else {
          row.innerHTML = line
        }
        await new Promise((resolve) => setTimeout(resolve, 260))
      }
    },
    hideTerminal() {
      element('v-term').classList.remove('is-on')
    },
    // No cursor over a card: nothing there to point at.
    card(html: string) {
      const card = element('v-card')

      card.classList.remove('is-off')
      card.innerHTML = html
      document.getElementById('v-cursor')!.style.visibility = 'hidden'
    },
    hideCard() {
      element('v-card').classList.add('is-off')
      document.getElementById('v-cursor')!.style.visibility = ''
    },
  }

  Object.assign(window, { video })

  if (document.body) setup()
  else document.addEventListener('DOMContentLoaded', setup)
}

type Video = {
  caption(number: string, title: string, text: string): void
  hideCaption(): void
  keys(keys: string[]): void
  terminal(title: string, lines: string[]): Promise<void>
  hideTerminal(): void
  card(html: string): void
  hideCard(): void
}

const TITLE_CARD = `
  <p class="eyebrow">Project notes for coding with AI</p>
  <p class="word">BRUTO</p>
  <p class="line">A task board that lives in <b>your repo</b>.<br />For you and your AI.</p>
`

const END_CARD = `
  <p class="word">BRUTO</p>
  <div class="facts"><span>Free</span><span>Open source</span><span>No account</span><span>Works offline</span></div>
  <p class="url">jimy-k4.github.io/bruto</p>
  <p class="handles">github.com/jimy-k4/bruto &nbsp;·&nbsp; @brutoboard</p>
`

/** Where the visible cursor is. */
let cursor = { x: VIEWPORT.width * 0.62, y: VIEWPORT.height * 0.7 }

/** Moves the visible cursor like a hand would: eased, never a jump. */
async function moveTo(page: Page, target: Locator | { x: number; y: number }, duration = 650) {
  const point =
    'x' in target
      ? target
      : await target.boundingBox({ timeout: 10_000 }).then((box) => ({
          x: box!.x + box!.width / 2,
          y: box!.y + box!.height / 2,
        }))
  const from = cursor
  const steps = Math.max(10, Math.round(duration / 18))

  for (let step = 1; step <= steps; step++) {
    const t = step / steps
    const eased = t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2

    await page.mouse.move(from.x + (point.x - from.x) * eased, from.y + (point.y - from.y) * eased)
    await page.waitForTimeout(8)
  }
  cursor = point
}

async function click(page: Page, target: Locator | { x: number; y: number }, duration?: number) {
  await moveTo(page, target, duration)
  await page.waitForTimeout(120)
  await page.mouse.down()
  await page.mouse.up()
}

const call = <K extends keyof Video>(page: Page, name: K, ...args: Parameters<Video[K]>) =>
  page.evaluate(
    ([name, args]) =>
      (window as unknown as { video: Record<string, (...a: unknown[]) => unknown> }).video[name](
        ...args,
      ),
    [name, args] as const,
  )

async function press(page: Page, keys: string[], chord: string) {
  await call(page, 'keys', keys)
  await page.waitForTimeout(250)
  await page.keyboard.press(chord)
}

/** Progress on the console: the recording runs in real time. */
const step = (name: string) => console.log(`${new Date().toISOString().slice(11, 19)} ${name}`)

/** The ffmpeg Playwright downloads with its browsers. */
function ffmpegPath(): string {
  const base =
    process.platform === 'win32'
      ? join(process.env.LOCALAPPDATA ?? join(homedir(), 'AppData', 'Local'), 'ms-playwright')
      : process.platform === 'darwin'
        ? join(homedir(), 'Library', 'Caches', 'ms-playwright')
        : join(homedir(), '.cache', 'ms-playwright')
  const folder = readdirSync(base).find((name) => name.startsWith('ffmpeg'))

  if (!folder) throw new Error('No ffmpeg in ms-playwright: run `npx playwright install ffmpeg`')

  const binary = readdirSync(join(base, folder)).find((name) => name.startsWith('ffmpeg-'))

  return join(base, folder, binary!)
}

test('launch video', async ({ baseURL }) => {
  test.setTimeout(30 * 60_000)

  const profile = mkdtempSync(join(tmpdir(), 'bruto-video-'))
  const frameDir = mkdtempSync(join(tmpdir(), 'bruto-frames-'))
  const context = await chromium.launchPersistentContext(profile, {
    channel: 'chrome',
    headless: true,
    baseURL,
    viewport: VIEWPORT,
    deviceScaleFactor: SCALE,
    permissions: ['clipboard-read', 'clipboard-write'],
  })
  const page = context.pages()[0] ?? (await context.newPage())

  await page.addInitScript(() => {
    localStorage.setItem('bruto-language', 'en')
    localStorage.setItem('bruto-theme', 'dark')
  })
  await page.addInitScript(overlays)
  await page.goto('/')
  await page.evaluate(() => document.fonts.ready)
  await call(page, 'card', TITLE_CARD)
  await page.mouse.move(cursor.x, cursor.y)
  await page.waitForTimeout(500)

  // Recording: every frame Chrome paints, with its time.
  const cdp = await context.newCDPSession(page)
  const frames: { time: number; file: string }[] = []

  cdp.on('Page.screencastFrame', ({ data, sessionId }) => {
    const file = join(frameDir, `${frames.length}.jpg`)

    writeFileSync(file, Buffer.from(data, 'base64'))
    // Arrival time, on the same clock as the end of the recording.
    frames.push({ time: Date.now() / 1000, file })
    void cdp.send('Page.screencastFrameAck', { sessionId }).catch(() => undefined)
  })
  await cdp.send('Page.startScreencast', {
    format: 'jpeg',
    quality: 92,
    maxWidth: 1920,
    maxHeight: 1080,
    everyNthFrame: 1,
  })

  // Title, then the landing page.
  step('Title, then the landing page')
  await page.waitForTimeout(3200)
  await call(page, 'hideCard')
  await page.waitForTimeout(1400)
  await click(page, page.locator('.landing__hero .landing__actions button').last(), 900)
  await expect(page.locator('.save-status')).toBeVisible()
  await page.waitForTimeout(1500)

  // 1. Write the task.
  step('1. Write the task')
  await call(
    page,
    'caption',
    '01',
    'Write the task',
    'Notes live in your repo, in .bruto/workspace.json',
  )
  await page.waitForTimeout(1200)
  await press(page, ['N'], 'n')
  await page.waitForTimeout(500)
  await click(page, page.getByLabel('Title'), 500)
  await page.keyboard.press('Control+a')
  await page.keyboard.type(TASK, { delay: 55 })
  await page.waitForTimeout(300)
  await click(page, page.getByLabel('Description'), 500)
  await page.keyboard.type(
    'When a slot is full, climbers join a waitlist and get an email if a spot opens.',
    {
      delay: 22,
    },
  )
  await page.waitForTimeout(300)
  await moveTo(page, page.getByLabel('Status'), 450)
  await page.getByLabel('Status').selectOption('todo')
  await page.waitForTimeout(700)
  await press(page, ['Ctrl', 'Enter'], 'Control+Enter')
  await page.waitForTimeout(900)

  // Onto the free column, right of the top row.
  const task = page.locator('.note', { hasText: TASK })
  const top = (await page.locator('.note', { hasText: 'Double booking' }).boundingBox())!
  const from = (await task.locator('.note__header').boundingBox())!

  await moveTo(page, { x: from.x + 40, y: from.y + from.height / 2 }, 500)
  await page.mouse.down()
  // Low enough to clear the zoom buttons.
  await moveTo(page, { x: top.x + 360 + 40, y: top.y + 56 + from.height / 2 }, 900)
  await page.mouse.up()
  await page.waitForTimeout(900)

  // 2. Q copies it for the AI.
  step('2. Q copies it for the AI')
  await call(page, 'caption', '02', 'Press Q', 'Your AI gets exactly the context it needs')
  await page.waitForTimeout(900)
  await press(page, ['Q'], 'q')
  await page.waitForTimeout(1500)
  await press(page, ['A'], 'a')
  await page.waitForTimeout(2600)
  await press(page, ['Esc'], 'Escape')
  await page.waitForTimeout(600)

  // 3. An agent answers in the note, through the MCP server.
  step('3. An agent answers in the note, through the MCP server')
  await call(
    page,
    'caption',
    '03',
    'Your AI answers in the note',
    'Paste it in any chat, or let an agent work the board over MCP',
  )
  await page.waitForTimeout(400)
  await call(page, 'terminal', 'Claude Code', [
    '> Work on the notes to do',
    `<span class="dim">bruto ·</span> list_notes <span class="dim">status:</span> todo`,
    `<span class="dim">bruto ·</span> set_status <span class="sig">in progress</span> · ${TASK}`,
    '<span class="ok">✓</span> app/calendar/Waitlist.tsx',
    '<span class="ok">✓</span> app/api/waitlist/route.ts',
    `<span class="dim">bruto ·</span> answer_note <span class="sig">to review</span> · 3 files`,
  ])
  // The note is on disk before the agent writes over it.
  await expect(page.locator('.save-status')).toHaveText(/saved/i)
  await page.evaluate(
    async ({ title, answer }) => {
      const root = await navigator.storage.getDirectory()
      const project = await root.getDirectoryHandle('atlas')

      // The files the agent wrote, so the note lists them with their size.
      for (const path of answer.aiFilePaths) {
        const parts = path.split('/')
        let folder = project

        for (const part of parts.slice(0, -1)) {
          folder = await folder.getDirectoryHandle(part, { create: true })
        }

        const writable = await (
          await folder.getFileHandle(parts.at(-1)!, { create: true })
        ).createWritable()

        await writable.write(`// ${parts.at(-1)}: the waitlist for full slots.\n`)
        await writable.close()
      }

      const bruto = await project.getDirectoryHandle('.bruto')
      const handle = await bruto.getFileHandle('workspace.json')
      const workspace = JSON.parse(await (await handle.getFile()).text())
      const note = workspace.notes.find((item: { title: string }) => item.title === title)

      Object.assign(note, answer, { updatedAt: new Date().toISOString() })

      const file = await handle.createWritable()

      await file.write(JSON.stringify(workspace, null, 2))
      await file.close()
    },
    { title: TASK, answer: ANSWER },
  )
  await expect(task.getByText('To review')).toBeVisible({ timeout: 8000 })
  await page.waitForTimeout(700)
  await call(page, 'hideTerminal')
  await page.waitForTimeout(400)
  await click(page, task.locator('.note__ai-toggle'), 700)
  await page.waitForTimeout(3200)

  // 4. Standing rules.
  step('4. Standing rules')
  await call(
    page,
    'caption',
    '04',
    'Rules for every task',
    'Standing rules ride along with every copy',
  )
  await page.waitForTimeout(500)
  // Its editor says what a rule is; Done closes it.
  await click(
    page,
    page.locator('.note', { hasText: 'Run the tests' }).locator('.note__title'),
    900,
  )
  await page.waitForTimeout(3000)
  await click(page, page.getByRole('button', { name: 'Done Ctrl Enter' }), 800)
  await page.waitForTimeout(600)

  // 5. The project, drawn.
  step('5. The project, drawn')
  await call(
    page,
    'caption',
    '05',
    'Your project, drawn',
    'Screens, API routes and database tables, with your notes on them',
  )
  await page.waitForTimeout(600)
  await press(page, ['M'], 'm')
  await page.waitForTimeout(1600)
  await click(page, page.locator('.structure__lens').nth(1), 700)
  await page.waitForTimeout(1200)
  await click(page, page.locator('.lens-screen', { hasText: '/checkout' }), 700)
  await page.waitForTimeout(1600)
  await click(page, page.locator('.structure__lens').nth(2), 600)
  await page.waitForTimeout(1600)
  await click(page, page.locator('.structure__lens').last(), 600)
  await page.waitForTimeout(900)
  await click(page, page.locator('.lens-search input'), 600)
  await page.keyboard.type('user', { delay: 140 })
  await page.waitForTimeout(2600)

  // 6. Search.
  step('6. Search')
  // Escape clears the table search; the button takes you back to the board.
  await press(page, ['Esc'], 'Escape')
  await page.waitForTimeout(400)
  await click(page, page.getByRole('button', { name: /back to the board/i }), 700)
  await page.waitForTimeout(800)
  await moveTo(page, { x: VIEWPORT.width * 0.62, y: VIEWPORT.height * 0.55 }, 400)
  await call(page, 'caption', '06', 'Find anything', 'By text, path, status, or what a note has')
  await page.waitForTimeout(500)
  await press(page, ['Ctrl', 'F'], 'Control+f')
  await page.waitForTimeout(300)
  await page.keyboard.type('booking', { delay: 110 })
  await page.waitForTimeout(700)
  await click(page, page.locator('.board-search__trait').first(), 700)
  await page.waitForTimeout(2600)

  // End card.
  step('End card')
  await call(page, 'hideCaption')
  await call(page, 'card', END_CARD)
  await page.waitForTimeout(5200)

  // Chrome only sends a frame when something changes: the still end card lasts until here.
  const stopped = Date.now() / 1000

  await cdp.send('Page.stopScreencast')
  await context.close()

  // A frame every 1/30 s: the last one Chrome painted by then.
  mkdirSync('launch', { recursive: true })

  const encoder = spawn(
    ffmpegPath(),
    [
      '-loglevel',
      'error',
      '-y',
      '-f',
      'image2pipe',
      '-c:v',
      'mjpeg',
      '-framerate',
      String(FPS),
      '-i',
      'pipe:0',
      '-an',
      // Chrome paints at the viewport's size: 1728×972 up to 1080p.
      '-vf',
      'scale=1920:1080:flags=lanczos',
      '-c:v',
      'libvpx',
      '-b:v',
      '12M',
      '-crf',
      '4',
      '-qmin',
      '0',
      '-qmax',
      '20',
      '-deadline',
      'good',
      '-cpu-used',
      '4',
      '-threads',
      '8',
      '-slices',
      '4',
      '-g',
      String(FPS * 3),
      '-auto-alt-ref',
      '0',
      OUTPUT,
    ],
    { stdio: ['pipe', 'inherit', 'inherit'] },
  )
  const done = new Promise<number>((resolve) => encoder.on('close', resolve))
  const start = frames[0].time
  const end = stopped
  let index = 0

  for (let time = start; time <= end; time += 1 / FPS) {
    while (index + 1 < frames.length && frames[index + 1].time <= time) index++
    if (!encoder.stdin.write(readFileSync(frames[index].file))) {
      await new Promise((resolve) => encoder.stdin.once('drain', resolve))
    }
  }
  encoder.stdin.end()

  expect(await done).toBe(0)
  rmSync(frameDir, { recursive: true, force: true })
  rmSync(profile, { recursive: true, force: true })
  console.log(`${OUTPUT}: ${frames.length} frames painted, ${((end - start) | 0) + 1} s`)
})
