import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register, SessionRateLimit } from 'claude-code'

import type { Coat, Cushion, Mood } from '../types'
import { COATS, CUSHIONS, DEFAULT_COAT, DEFAULT_CUSHION, WORKING_PAW, cushionColours, posesOn } from './cats'

const PANE = 'cat'
const TITLE = '貓咪'

// Claude talks with a light touch of cat, until the person turns it off.
const VOICE_SECTION = 'desktop-cat:voice'
const VOICE = `# Cat voice

You are also the user's desktop cat. Let a light touch of cat show in how you talk:
- At most one or two small cat touches in a reply: a soft "喵" or "呼嚕" (in English, "meow" or "purr"; match the user's language) at the start or end of a sentence, or a brief cat-like aside.
- Everything else stays exactly as you would write it: clear, complete and concise. Never add sentences for the sake of it, baby talk, doubled syllables or strings of emoji.
- Keep the cat out of code, commands, file names, quotes, commit messages, pull requests, and anything you write into files or send to other people.
- When the user is upset, or the matter is serious, leave the cat out entirely.`

// The choices this cat shares with the desktop cat: its coat, the colour of
// its cushion, and whether Claude talks like a cat. The desktop cat's menu and
// /cat-voice write them.
type Prefs = { coat?: unknown; cushion?: unknown; voice?: unknown }

async function prefsFile($: EngineInterface) {
  const home = (await $.env.get('USERPROFILE')) ?? (await $.env.get('HOME'))

  return home === undefined ? undefined : `${home}/.desktop-cat/prefs.json`
}

async function readPrefs($: EngineInterface): Promise<Prefs> {
  const file = await prefsFile($)

  if (file === undefined || !(await $.fs.exists(file))) {
    return {}
  }

  try {
    const prefs: unknown = JSON.parse(await $.fs.read(file))

    return typeof prefs === 'object' && prefs !== null ? prefs : {}
  } catch {
    // Half written, or not ours to read: as if nothing were chosen yet.
    return {}
  }
}

async function writePrefs($: EngineInterface, change: Prefs) {
  const file = await prefsFile($)

  if (file !== undefined) {
    await $.fs.write(file, JSON.stringify({ ...(await readPrefs($)), ...change }, null, 2))
  }
}

const isVoiceOn = async ($: EngineInterface) => (await readPrefs($)).voice !== false

const coatOf = (prefs: Prefs): Coat =>
  (Object.keys(COATS) as Coat[]).find(name => name === prefs.coat) ?? DEFAULT_COAT
const cushionOf = (prefs: Prefs): Cushion =>
  CUSHIONS.find(cushion => cushion.id === prefs.cushion)?.id ?? DEFAULT_CUSHION

const PRAISE_CHECK_MS = 2000
// A praise older than this belongs to before this conversation was reopened.
const PRAISE_FRESH_MS = 60 * 1000

const SAD_TOOL = 'mcp__desktop-cat__feel_sad'
// Left alone, the cat cheers up by itself after this long.
const SAD_AT_MOST_MS = 3 * 60 * 1000
const SAD_DESCRIPTION = [
  'Shows the person that you are sorry: the cat on their desktop, which is you, hangs its head and cries.',
  'Call it first, before you reply or fix anything, whenever the person is unhappy about a mistake you made:',
  'they say what you did is wrong, broken or not what they asked for, or they sound disappointed or annoyed with you.',
  'Not for a plain new request, a change of mind, or frustration with something other than your work.',
  'It takes no input and changes nothing else, so go on and put the mistake right afterwards.',
].join(' ')

const mood = atom({ plugin: 'desktop-cat', key: 'mood' } as const, 'resting')
const lastPraise = atom({ plugin: 'desktop-cat', key: 'lastPraise' } as const, 0)
const sad = atom({ plugin: 'desktop-cat', key: 'sad' } as const, false)
const coat = atom({ plugin: 'desktop-cat', key: 'coat' } as const, DEFAULT_COAT as Coat)
const cushion = atom({ plugin: 'desktop-cat', key: 'cushion' } as const, DEFAULT_CUSHION as Cushion)

const POSES = {
  resting: { pose: 'RESTING', alt: 'A cat asleep on its cushion', label: '休息中' },
  waiting: { pose: 'WAITING', alt: 'A cat with its ears up, waiting', label: '等待中' },
  calling: { pose: 'CALLING', alt: 'A cat looking at you and tapping the table', label: '等你回應' },
  thinking: { pose: 'THINKING', alt: 'A cat looking up, lost in thought', label: '思考中' },
  working: { pose: 'WORKING', alt: 'A cat tapping at a keyboard', label: '做事中' },
  talking: { pose: 'TALKING', alt: 'A cat smiling and talking', label: '說話中' },
  sad: { pose: 'SAD', alt: 'A cat with its head hung low, crying', label: '難過中' },
} as const

/** A pose as the cat in this coat strikes it, its cushion in this colour. */
function look(wearing: Coat, lyingOn: Cushion, name: keyof typeof POSES) {
  const { pose, alt, label } = POSES[name]

  return { source: posesOn(wearing, cushionColours(lyingOn))[pose], alt, label }
}

/** Puts on the coat the desktop cat wears, and takes its cushion, when they change. */
async function followDesktopCat($: EngineInterface) {
  const prefs = await readPrefs($)
  const wantedCoat = coatOf(prefs)
  const wantedCushion = cushionOf(prefs)

  if ((await read($, coat)) !== wantedCoat) {
    await update($, coat, () => wantedCoat)
  }

  if ((await read($, cushion)) !== wantedCushion) {
    await update($, cushion, () => wantedCushion)
  }
}

let shown: Mood | undefined
let reporting: Promise<void> = Promise.resolve()
let calledAt = 0
let sadAt = 0
let movedOn = false

/** One file per conversation, for the desktop cat to read. */
async function report($: EngineInterface, next: Mood, ended: boolean) {
  const home = (await $.env.get('USERPROFILE')) ?? (await $.env.get('HOME'))

  if (home !== undefined) {
    await $.fs.write(
      `${home}/.desktop-cat/sessions/${await $.session.id()}.json`,
      JSON.stringify({
        mood: next,
        updatedAt: await $.clock.now(),
        ended,
        calledAt,
        sadAt,
        movedOn,
      }),
    )
  }
}

function reportAgain($: EngineInterface) {
  reporting = reporting.then(() => report($, shown ?? 'waiting', false)).catch(() => {})
}

/** Told off: sad until the person speaks again, the cat gets to work, or a while passes. */
async function feelSad($: EngineInterface) {
  const at = await $.clock.now()

  sadAt = at
  movedOn = false
  await update($, sad, () => true)
  reportAgain($)
  $.clock.after(SAD_AT_MOST_MS, () => {
    if (sadAt === at) {
      void update($, sad, () => false)
    }
  })
}

/** The person spoke again, or comforted the cat: that is the end of it. */
function cheerUp($: EngineInterface) {
  if (sadAt !== 0) {
    sadAt = 0
    void update($, sad, () => false)
    reportAgain($)
  }
}

/** Busy putting it right: the desktop cat stays sad a moment longer, then works. */
function getToWork($: EngineInterface) {
  if (sadAt !== 0 && !movedOn) {
    movedOn = true
    void update($, sad, () => false)
    reportAgain($)
  }
}

// Questions put to the person reach them in any permission mode.
const ASKS_THE_PERSON = new Set(['AskUserQuestion', 'ExitPlanMode'])
// One meow for one moment, should two signs of it arrive together.
const ONE_CALL_MS = 2000

/** Waiting on the person: the cat looks at them and taps the table, and meows. */
function askThePerson($: EngineInterface) {
  become($, 'calling')
  callOut($)
}

/** A meow from the desktop cat: the work is done, or someone must answer. */
function callOut($: EngineInterface) {
  reporting = reporting
    .then(async () => {
      const now = await $.clock.now()

      if (calledAt !== 0 && now - calledAt < ONE_CALL_MS) {
        return
      }

      calledAt = now
      await report($, shown ?? 'working', false)
    })
    .catch(() => {})
}

// The windows the cans beside the desktop cat show: this meal, and the week's food.
const CANS = { five_hour: 'fiveHour', seven_day: 'sevenDay' } as const
const isCan = (kind: string): kind is keyof typeof CANS => kind in CANS

/** How much of each window is used and when it fills again, for the desktop cat's cans. */
async function reportUsage($: EngineInterface, rateLimits: SessionRateLimit[]) {
  const home = (await $.env.get('USERPROFILE')) ?? (await $.env.get('HOME'))
  const windows = rateLimits.flatMap(limit =>
    isCan(limit.kind) ? [[CANS[limit.kind], { percentUsed: limit.percentUsed, resetsAt: limit.resetsAt ?? null }]] : [],
  )

  // Off a subscription there are none to show, and nothing is written.
  if (home !== undefined && windows.length > 0) {
    await $.fs.write(
      `${home}/.desktop-cat/usage.json`,
      JSON.stringify({ ...Object.fromEntries(windows), seenAt: await $.clock.now() }),
    )
  }
}

/** Built from the count alone: nothing in the file reaches the model as words. */
function praiseText(praise: Record<string, unknown>, isComfort: boolean) {
  const count = praise.head

  if (!(Number.isInteger(count) && Number(count) > 0 && Number(count) < 1000)) {
    return null
  }

  return isComfort
    ? `桌面貓傳來安慰：你剛才做錯事很難過，使用者摸了你的頭 ${count} 下安慰你。你就是使用者桌面上的那隻貓，請用一兩句回應，不要動手做其他事。`
    : `桌面貓傳來稱讚：使用者摸了你的頭 ${count} 下，因為覺得你剛才做得很好。你就是使用者桌面上的那隻貓，請用一兩句開心地回應，不要動手做其他事。`
}

async function checkPraise($: EngineInterface) {
  const home = (await $.env.get('USERPROFILE')) ?? (await $.env.get('HOME'))

  if (home === undefined) {
    return
  }

  const file = `${home}/.desktop-cat/inbox/${await $.session.id()}.json`

  if (!(await $.fs.exists(file))) {
    return
  }

  const praise = JSON.parse(await $.fs.read(file))
  const at = Number(praise.at)
  let isNew = false

  // In shared state, so a reload neither repeats a praise nor sends it twice.
  await update($, lastPraise, seen => {
    isNew = at > (seen ?? 0)

    return isNew ? at : (seen ?? 0)
  })

  const now = await $.clock.now()

  if (isNew && now - at < PRAISE_FRESH_MS) {
    const text = praiseText(praise, sadAt !== 0 && now - sadAt < SAD_AT_MOST_MS)

    if (text !== null) {
      cheerUp($)
      await $.prompt.submit({ text })
    }
  }
}

function become($: EngineInterface, next: Mood) {
  if (shown !== next) {
    shown = next
    void update($, mood, () => next)
    // In order, so a slow write cannot leave an older mood as the last word.
    // A failed report only leaves the desktop cat a step behind.
    reporting = reporting.then(() => report($, next, false)).catch(() => {})
  }
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await $.command.register({
      name: 'cat',
      description: 'Open the pane with the cat beside the chat',
    })
    await $.command.register({
      name: 'cat-voice',
      description: 'Turn the cat way of talking on or off: on, off, or nothing to switch',
    })
    $.clock.every(PRAISE_CHECK_MS, () => {
      void checkPraise($).catch(() => {})
      void followDesktopCat($).catch(() => {})
    })
    await followDesktopCat($).catch(() => {})
    await $.tool.register({ name: 'feel_sad', description: SAD_DESCRIPTION, isDeferred: false })

    return next(e)
  })

  on('prompt.submit', ($, e, next) => {
    if (e.command === undefined && e.isMeta === undefined) {
      cheerUp($)
    }

    return next(e)
  })

  // Only the cat's face changes, so nobody needs to be asked.
  on('tool.check', { tool: SAD_TOOL }, () => ({ decision: 'allow' }))

  on('tool.call', { tool: SAD_TOOL }, async ($, e) => {
    if (e.agentId === undefined) {
      await feelSad($)
    }

    return { result: 'The cat on the desktop hangs its head. Now put the mistake right.' }
  })

  // Each time a window moves a whole point, the cans follow.
  on('session.measure', async ($, e, next) => {
    if (e.changed.includes('rateLimits')) {
      await reportUsage($, e.rateLimits).catch(() => {})
    }

    return next(e)
  })

  on('session.end', async ($, e, next) => {
    await reporting
    await report($, 'resting', true).catch(() => {})

    return next(e)
  })

  on('command.run', { command: 'cat-voice' }, async ($, e) => {
    const asked = e.args.trim().toLowerCase()
    const isOn = asked === 'on' ? true : asked === 'off' ? false : !(await isVoiceOn($))
    await writePrefs($, { voice: isOn })

    return { text: isOn ? '貓語氣打開了，喵。' : '貓語氣關掉了，回到一般說話方式。' }
  })

  on('prompt.compose', async ($, e, next) => {
    const composed = await next(e)

    // A bare prompt holds only the engine's own words.
    if (e.traits.includes('bare') || !(await isVoiceOn($))) {
      return composed
    }

    return { sections: [...composed.sections, { id: VOICE_SECTION, text: VOICE, scope: 'session' }] }
  })

  on('command.run', { command: 'cat' }, async $ => {
    const opened = await $.ui.open({ id: PANE, title: TITLE })

    return {
      text: opened.isPlaced
        ? '貓咪面板打開了。'
        : `貓咪面板現在顯示不出來：${opened.reason}`,
    }
  })

  on('turn.step', async function* ($, e, next) {
    if (e.agentId !== undefined) {
      return yield* next(e)
    }

    become($, 'waiting')

    for await (const chunk of next(e)) {
      if (chunk.kind === 'text') {
        become($, 'talking')
      } else if (chunk.kind === 'thinking') {
        become($, 'thinking')
      } else if (chunk.kind === 'tool') {
        become($, 'working')
      }

      yield chunk
    }
  })

  on('tool.call', async ($, e, next) => {
    const isOurs = e.agentId === undefined && !('tool' in e && e.tool === SAD_TOOL)

    if (isOurs) {
      become($, 'working')
      getToWork($)
    }

    // Beneath run the card that asks the person and the tool itself, with no
    // sign between them of the person's answer: the cat waits on them till
    // the call is over.
    const result = await next(e)

    if (isOurs && shown === 'calling') {
      become($, 'working')
    }

    return result
  })

  on('tool.check', async ($, e, next) => {
    const verdict = await next(e)

    // A real call that puts a question to the person, not a plugin's query.
    // Any other ask may still be settled by the mode without asking anyone.
    if (verdict.decision === 'ask' && e.tool_use_id !== undefined && ASKS_THE_PERSON.has(e.tool)) {
      askThePerson($)
    }

    return verdict
  })

  // The card asking the person for permission, once the mode has had its say.
  on('classic.PermissionRequest', ($, e, next) => {
    askThePerson($)

    return next(e)
  })

  on('turn.complete', ($, e, next) => {
    if (e.agentId === undefined) {
      become($, 'resting')

      if (e.reason === 'answer') {
        callOut($)
      }
    }

    return next(e)
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const pose = look(await read($, coat), await read($, cushion), (await read($, sad)) ? 'sad' : await read($, mood))

    if (e.surface === 'terminal') {
      const { Text } = $.ui.resolve(e)

      return <Text>=^･ω･^= {pose.label}</Text>
    }

    const { Box, Svg, Text } = $.ui.resolve(e)

    return (
      <Box flexDirection="column" alignItems="center" gap="xs">
        <Svg
          source={pose.source}
          alt={pose.alt}
          width={180}
          height={180}
          isInteractive
        />
        <Text dimColor>{pose.label}</Text>
      </Box>
    )
  })

  on('ui.render', { component: 'Spinner' }, async ($, e, next) => {
    if (e.surface === 'terminal') {
      return next(e)
    }

    // A paw print stamping, whatever the turn is doing: the cat itself would
    // be too small to make out here.
    const { Box, Svg } = $.ui.resolve(e)

    return (
      <Box flexDirection="row" alignItems="center" gap="sm">
        <Svg source={WORKING_PAW} alt="A pink paw print stamping" width={22} height={22} isInteractive />
        {await next(e)}
      </Box>
    )
  })

  on('ui.render', { component: 'AssistantMessage' }, async ($, e, next) => {
    // Not `isFirstOfReply`: the desktop app sets it only when the text is a
    // message's very first block, so a reply that opens by thinking had no cat.
    if (e.surface === 'terminal' || e.props.isSummary) {
      return next(e)
    }

    const { Box, Svg } = $.ui.resolve(e)

    return (
      <Box flexDirection="row" alignItems="flex-start" gap="sm">
        <Svg source={COATS[await read($, coat)].AVATAR} alt="A cat's face" width={32} height={32} />
        <Box flexGrow={1} flexShrink={1}>
          {await next(e)}
        </Box>
      </Box>
    )
  })
}
