import { expect, test } from 'claude-code/testing'

const BAND = {
  plugin: 'crab-buddy',
  component: 'AbovePrompt',
  props: {
    hasSurvey: false,
    isWorking: true,
    maxRows: 10,
    bodyColumns: 80,
    scroll: { offset: 0, bodyRows: 10 },
    view: {},
  },
} as const

const CRAB_COMMAND = {
  command: 'crab',
  args: '',
  origin: { kind: 'composer' },
  presentation: { isFullscreen: false, columns: 100 },
} as const

// A tool call the engine holds open until the test lets it finish.
const held = () => {
  let finish = () => {}
  const done = new Promise<{ result: object }>(resolve => {
    finish = () => resolve({ result: {} })
  })
  return { done, finish }
}

test('a running Read shows Reading and the file, on every surface', async ($, on) => {
  const call = held()
  on('tool.call', () => call.done)

  const running = $.tool.call({ tool: 'Read', file_path: '/repo/src/notes.md' })

  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await $.ui.mount({ ...BAND, surface })
    expect((await ui.find({ type: 'Text', text: /Reading/ }))?.text).toMatch(/^Reading/)
    expect(await ui.find({ type: 'Text', text: 'notes.md' })).toBeTruthy()
    await ui.unmount()
  }

  call.finish()
  await running
})

test('a question for the person shows Waiting for you', async ($, on) => {
  const call = held()
  on('tool.call', () => call.done)

  const asking = $.tool.call({
    tool: 'AskUserQuestion',
    questions: [{ question: 'Which?', header: 'Pick', multiSelect: false, options: [] }],
  } as never)

  const ui = await $.ui.mount({ ...BAND, surface: 'terminal' })
  expect(await ui.find({ type: 'Text', text: /Waiting for you/ })).toBeTruthy()
  expect(await ui.find({ type: 'Text', text: 'a question for you' })).toBeTruthy()
  await ui.unmount()

  call.finish()
  await asking
})

test('several subagents at once are counted', async ($, on) => {
  const calls = [held(), held(), held()]
  let next = 0
  on('tool.call', () => calls[next++]!.done)

  const spawned = ['auth', 'billing', 'search'].map(area =>
    $.tool.call({ tool: 'Agent', description: `Explore ${area}`, prompt: 'look' } as never),
  )

  const ui = await $.ui.mount({ ...BAND, surface: 'terminal' })
  expect(await ui.find({ type: 'Text', text: /Sending a helper/ })).toBeTruthy()
  expect(await ui.find({ type: 'Text', text: '3 helpers out' })).toBeTruthy()
  await ui.unmount()

  calls.forEach(call => call.finish())
  await Promise.all(spawned)
})

test('the status text can be turned off', { options: { showStatus: false } }, async ($, on) => {
  const call = held()
  on('tool.call', () => call.done)
  const running = $.tool.call({ tool: 'Read', file_path: '/repo/a.ts' })

  const ui = await $.ui.mount({ ...BAND, surface: 'terminal' })
  expect(await ui.find({ type: 'Text', text: /Reading/ })).toBeFalsy()
  await ui.unmount()

  call.finish()
  await running
})

test('/crab hides the crab and hands the band back', async ($, on) => {
  on('command.register', () => ({ value: { command: 'crab' } }))
  on('ui.render', ($, e) => {
    const { Text } = $.ui.resolve(e)
    return <Text>engine</Text>
  })

  const hidden = await $.command.run(CRAB_COMMAND)
  expect(hidden.text).toMatch(/hidden/)

  const ui = await $.ui.mount({ ...BAND, surface: 'terminal' })
  expect((await ui.find({ type: 'Text' }))?.text).toBe('engine')
  await ui.unmount()

  const back = await $.command.run(CRAB_COMMAND)
  expect(back.text).toMatch(/back/)
})
