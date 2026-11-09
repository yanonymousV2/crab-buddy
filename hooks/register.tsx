import type { Register } from 'claude-code'

const FRAME_MS = 300
// A command running longer than this gets a bored crab.
const BORED_AFTER_MS = 20_000

const COLORS: Record<string, string> = {
  orange: '#D97757',
  blue: '#6A9BD8',
  green: '#7BC47F',
  purple: '#B48EF0',
  pink: '#E88AB5',
}

type Mode =
  | 'idle'
  | 'sleeping'
  | 'thinking'
  | 'talking'
  | 'reading'
  | 'searching'
  | 'editing'
  | 'running'
  | 'browsing'
  | 'delegating'
  | 'waiting'
  | 'compacting'
  | 'oops'
  | 'done'

type Look = {
  eyes: 'open' | 'blink' | 'left' | 'right' | 'up' | 'shut'
  arms: 'out' | 'up' | 'down' | 'wave'
  legs: 'stand' | 'stepA' | 'stepB' | 'tuck'
  hop: boolean
  shift: number
  bubble: string
  prop: string[]
}

const CAPTION: Record<Mode, string> = {
  idle: 'Idle',
  sleeping: 'Sleeping',
  thinking: 'Thinking',
  talking: 'Writing a reply',
  reading: 'Reading',
  searching: 'Searching',
  editing: 'Editing',
  running: 'Running',
  browsing: 'Browsing the web',
  delegating: 'Sending a helper',
  waiting: 'Waiting for you',
  compacting: 'Compacting',
  oops: 'Oops',
  done: 'Done!',
}

type Doing = { mode: Mode; detail: string }

// Module state: a reload starts the crab over at idle, which is fine.
let mode: Mode = 'idle'
let detail = ''
let changedAt = Date.now()
let tick = 0
let isHidden = false
// The call a permission prompt or question is holding, while one is.
let waitingFor: string | undefined
const running = new Map<string, Doing>()

const setMode = (next: Mode, nextDetail = '') => {
  if (next === mode && nextDetail === detail) return
  mode = next
  detail = nextDetail
  changedAt = Date.now()
}

// What the crab shows once nothing holds it: the newest call still running.
const settle = (fallback: Mode = 'thinking') => {
  const left = [...running.values()].pop()
  if (left) setMode(left.mode, left.detail)
  else setMode(fallback)
}

const helpers = () => [...running.values()].filter(one => one.mode === 'delegating').length

const short = (text: string, room: number) => {
  const one = text.replace(/\s+/g, ' ').trim()
  return one.length > room ? `${one.slice(0, room - 1)}…` : one
}

const base = (path: string) => path.split('/').filter(Boolean).pop() ?? path

const field = (e: object, name: string): string => {
  const value = (e as Record<string, unknown>)[name]
  return typeof value === 'string' ? value : ''
}

const forTool = (tool: string, e: object): Doing => {
  switch (tool) {
    case 'Read':
    case 'NotebookRead':
      return { mode: 'reading', detail: base(field(e, 'file_path')) }
    case 'Grep':
    case 'Glob':
    case 'ToolSearch':
      return { mode: 'searching', detail: field(e, 'pattern') || field(e, 'query') }
    case 'Edit':
    case 'MultiEdit':
    case 'Write':
    case 'NotebookEdit':
      return {
        mode: 'editing',
        detail: base(field(e, 'file_path') || field(e, 'notebook_path')),
      }
    case 'Bash':
      return { mode: 'running', detail: field(e, 'command') }
    case 'WebFetch':
      return { mode: 'browsing', detail: field(e, 'url') }
    case 'WebSearch':
      return { mode: 'browsing', detail: field(e, 'query') }
    case 'Agent':
    case 'Task':
      return { mode: 'delegating', detail: field(e, 'description') }
    case 'AskUserQuestion':
      return { mode: 'waiting', detail: 'a question for you' }
    case 'ExitPlanMode':
      return { mode: 'waiting', detail: 'a plan to approve' }
    default:
      return { mode: 'running', detail: tool.replace(/^mcp__/, '').replace(/__/g, ' · ') }
  }
}

const blinking = (t: number, eyes: Look['eyes'] = 'open') =>
  t % 14 === 0 ? 'blink' : eyes
const cycle = <T,>(t: number, items: T[]) => items[t % items.length]!
// Back and forth along 0..max: the crab walks sideways.
const pace = (t: number, max: number) => {
  const at = t % (max * 2)
  return at <= max ? at : max * 2 - at
}

const lookFor = (m: Mode, t: number, isBored: boolean): Look => {
  const still: Look = {
    eyes: blinking(t),
    arms: 'out',
    legs: 'stand',
    hop: false,
    shift: 2,
    bubble: '',
    prop: ['', '', ''],
  }
  switch (m) {
    case 'idle':
      return { ...still, hop: t % 24 === 0 }
    case 'sleeping':
      return {
        ...still,
        eyes: 'shut',
        arms: 'down',
        legs: 'tuck',
        bubble: cycle(t >> 1, ['z', 'z Z', 'z Z z', '']),
      }
    case 'thinking':
      return {
        ...still,
        eyes: blinking(t, cycle(t >> 2, ['up', 'right', 'up', 'left'])),
        arms: t % 8 < 4 ? 'out' : 'wave',
        bubble: cycle(t, ['·', '· ∘', '· ∘ ○', '· ∘ ○ ?', '· ∘ ○ ?']),
      }
    case 'talking':
      return {
        ...still,
        arms: cycle(t, ['out', 'wave']),
        hop: t % 4 === 0,
        bubble: cycle(t, ['▁▃', '▃▅▂', '▅▂▆▃', '▂▆▃']),
      }
    case 'reading':
      return {
        ...still,
        eyes: blinking(t, cycle(t >> 1, ['left', 'open', 'right', 'open'])),
        arms: 'down',
        prop: ['┌───┐', cycle(t >> 1, ['│≡≡≡│', '│≡≡ │', '│≡  │']), '└───┘'],
      }
    case 'searching':
      return {
        ...still,
        eyes: cycle(t >> 1, ['left', 'right']),
        legs: cycle(t, ['stepA', 'stepB']),
        shift: pace(t, 4),
        prop: ['', cycle(t, [' ⌕', '  ⌕', ' ⌕', '⌕']), ''],
      }
    case 'editing':
      return {
        ...still,
        eyes: 'open',
        arms: cycle(t, ['wave', 'out']),
        prop: ['', cycle(t, ['✎ ▁', '✎▁▁', ' ✎▁▁▁', '  ✎▁▁▁▁']), ''],
      }
    case 'running':
      // A long command: he stops pacing, slumps and yawns.
      return isBored
        ? {
            ...still,
            eyes: t % 10 < 4 ? 'shut' : 'open',
            arms: 'down',
            bubble: cycle(t >> 2, ['…', '', 'yawn', '']),
            prop: ['', cycle(t, ['>_', '>_▌']), ''],
          }
        : {
            ...still,
            eyes: 'open',
            legs: cycle(t, ['stepA', 'stepB']),
            hop: t % 2 === 0,
            shift: pace(t, 5),
            prop: ['', cycle(t, ['>_', '>_▌', '>_']), ''],
          }
    case 'browsing':
      return {
        ...still,
        eyes: cycle(t >> 1, ['left', 'right']),
        prop: ['', cycle(t >> 1, ['◐', '◓', '◑', '◒']), ''],
      }
    case 'delegating':
      return {
        ...still,
        arms: 'up',
        bubble: cycle(t, ['→', ' →', '  →', '   ▝▜▛▘']),
      }
    case 'waiting':
      // Waving at you, both arms in turn, until you answer.
      return {
        ...still,
        eyes: blinking(t),
        arms: cycle(t, ['up', 'wave']),
        hop: t % 6 === 0,
        bubble: cycle(t >> 1, ['hey!', 'hey!', '', '']),
      }
    case 'compacting':
      // Squashed flat, then springing back, as the conversation is summarized.
      return {
        ...still,
        eyes: t % 4 < 2 ? 'shut' : 'open',
        arms: 'down',
        legs: t % 4 < 2 ? 'tuck' : 'stand',
        bubble: cycle(t >> 1, ['⇊', '⇊ ⇊', '⇊ ⇊ ⇊']),
      }
    case 'oops':
      return { ...still, eyes: 'shut', arms: 'up', bubble: '!' }
    case 'done':
      return {
        ...still,
        eyes: 'blink',
        arms: cycle(t, ['up', 'out']),
        hop: t % 2 === 0,
        bubble: cycle(t >> 1, ['✦', '✧ ✦', '✦ ✧ ✦']),
      }
  }
}

// Clawd at the size of the welcome-screen logo: a 10 by 6 pixel grid, two
// pixels to a character cell, so three rows of text.
const W = 10
const H = 6

const drawCrab = (look: Look): string[] => {
  const px = Array.from({ length: H }, () => Array<boolean>(W).fill(false))
  const top = look.hop ? 0 : 1
  const fill = (row: number, from: number, to: number, isLit = true) => {
    const line = px[top + row]
    if (!line) return
    for (let col = from; col <= to; col++) line[col] = isLit
  }

  for (let row = 0; row < 4; row++) fill(row, 2, 7)

  const eyeCols = { open: [3, 6], left: [3, 5], right: [4, 6], up: [4, 6], blink: [], shut: [] }[
    look.eyes
  ]
  for (const col of eyeCols) fill(1, col, col, false)

  const leftArm = { out: 2, up: 0, wave: 0, down: 3 }[look.arms]
  const rightArm = { out: 2, up: 0, wave: 2, down: 3 }[look.arms]
  fill(leftArm, 0, 1)
  fill(rightArm, 8, 9)

  const legCols = { stand: [2, 4, 5, 7], stepA: [2, 3, 6, 7], stepB: [3, 4, 5, 6], tuck: [] }[
    look.legs
  ]
  for (const col of legCols) fill(4, col, col)

  const rows: string[] = []
  for (let y = 0; y < H; y += 2) {
    let line = ''
    for (let x = 0; x < W; x++) {
      const up = px[y]![x]!
      const down = px[y + 1]![x]!
      line += up && down ? '█' : up ? '▀' : down ? '▄' : ' '
    }
    rows.push(' '.repeat(look.shift) + line)
  }
  return rows
}

export const register: Register = (on, options) => {
  const crabColor = COLORS[String(options.color)] ?? COLORS.orange!
  const sleepAfterMs = Math.max(10, Number(options.sleepAfterSeconds) || 90) * 1000
  const showStatus = options.showStatus !== false

  on('session.start', async ($, e, next) => {
    await $.command.register({
      name: 'crab',
      description: 'Show or hide the crab above the prompt',
    })
    $.clock.every(FRAME_MS, () => {
      if (mode === 'idle' && Date.now() - changedAt > sleepAfterMs) {
        setMode('sleeping')
      }
      if ((mode === 'done' || mode === 'oops') && Date.now() - changedAt > 4000) {
        setMode('idle')
      }
      tick += 1
      if (!isHidden) $.ui.invalidate('ui.render')
    })

    return next(e)
  })

  on('command.run', { command: 'crab' }, async $ => {
    isHidden = !isHidden
    $.ui.invalidate('ui.render')

    return { text: isHidden ? 'Crab hidden. /crab brings it back.' : 'Crab is back.' }
  })

  on('turn.start', ($, e, next) => {
    setMode('thinking')
    return next(e)
  })

  on('turn.step', async function* ($, e, next) {
    // Only the main thread's model stream drives the crab; a subagent's
    // tool calls still show through tool.call.
    const isFree = () => e.agentId === undefined && running.size === 0 && !waitingFor
    if (isFree()) setMode('thinking')
    for await (const chunk of next(e)) {
      if (isFree()) {
        if (chunk.kind === 'thinking') setMode('thinking')
        else if (chunk.kind === 'text') setMode('talking')
      }
      yield chunk
    }
  })

  on('tool.call', async ($, e, next) => {
    const what = forTool(e.tool, e)
    running.set(e.tool_use_id, what)
    if (!waitingFor) setMode(what.mode, what.detail)
    if (what.mode === 'waiting') waitingFor = e.tool_use_id
    const ran = await next(e)
    running.delete(e.tool_use_id)
    if (waitingFor === e.tool_use_id) waitingFor = undefined
    if (waitingFor) return ran
    if (running.size === 0 && ran.deny === undefined && ran.isError === true) setMode('oops', e.tool)
    else settle()

    return ran
  }).catch(($, e, next) => next(e))

  // A permission prompt: the engine's notification says the newest call is
  // waiting on the person. The crab only watches; the decision stays theirs.
  on('classic.Notification', ($, e, next) => {
    const asking = [...running.keys()].pop()
    if (e.notification_type === 'permission_prompt' && asking !== undefined) {
      waitingFor = asking
      const tool = /use (\S+)/.exec(e.message)?.[1]
      setMode('waiting', tool ? `may I use ${tool}?` : 'may I go ahead?')
    }

    return next(e)
  }).catch(($, e, next) => next(e))

  // The run-in-background hint shows only once a call is running, so a call
  // that was waiting on the person has been allowed.
  on('ui.render', { component: 'ToolProgress' }, ($, e, next) => {
    if (waitingFor !== undefined && e.props.tool_use_id === waitingFor) {
      waitingFor = undefined
      const what = running.get(e.props.tool_use_id)
      setMode(what?.mode ?? 'running', what?.detail ?? '')
    }

    return next(e)
  })

  on('session.compact', async ($, e, next) => {
    if (e.agentId !== undefined) return next(e)
    setMode('compacting', 'summarizing the conversation')
    try {
      return await next(e)
    } finally {
      settle('idle')
    }
  }).catch(($, e, next) => next(e))

  on('turn.complete', ($, e, next) => {
    running.clear()
    waitingFor = undefined
    setMode('done')
    return next(e)
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    if (isHidden || e.props.hasSurvey) return next(e)

    const { Box, Text } = $.ui.resolve(e)
    const elapsedMs = Date.now() - changedAt
    const look = lookFor(mode, tick, elapsedMs > BORED_AFTER_MS)
    const elapsed = Math.round(elapsedMs / 1000)
    const out = helpers()
    const what = mode === 'delegating' && out > 1 ? `${out} helpers out` : detail
    const caption = (
      <Text bold color={crabColor}>
        {CAPTION[mode]}
        {mode !== 'idle' && mode !== 'sleeping' && elapsed >= 2 ? (
          <Text dimColor> {elapsed}s</Text>
        ) : null}
      </Text>
    )

    // Too little room for Clawd: just the caption on one line.
    if (e.props.maxRows < 3) {
      return (
        <Box flexDirection="row">
          {caption}
          {what ? <Text dimColor> {short(what, e.props.bodyColumns - 24)}</Text> : null}
        </Box>
      )
    }

    const crab = drawCrab(look).map(row => row.padEnd(W + 6))
    const prop = look.prop.map(row => (row || '').padEnd(8))
    const room = Math.max(10, e.props.bodyColumns - (W + 6) - 8)

    return (
      <Box flexDirection="row">
        <Box flexDirection="column">
          {crab.map(row => (
            <Text mono color={crabColor}>
              {row}
            </Text>
          ))}
        </Box>
        <Box flexDirection="column">
          {prop.map(row => (
            <Text mono dimColor>
              {row}
            </Text>
          ))}
        </Box>
        {showStatus ? (
          <Box flexDirection="column">
            <Box flexDirection="row">
              {caption}
              {look.bubble ? <Text dimColor>  {look.bubble}</Text> : null}
            </Box>
            <Text dimColor>{what ? short(what, room) : ' '}</Text>
            <Text dimColor>
              {running.size > 1 && mode !== 'delegating' ? `${running.size} tools at once` : ' '}
            </Text>
          </Box>
        ) : (
          <Box flexDirection="column">
            <Text dimColor>{look.bubble || ' '}</Text>
          </Box>
        )}
      </Box>
    )
  })
}
