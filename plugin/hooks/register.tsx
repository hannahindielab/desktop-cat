import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register, SessionRateLimit } from 'claude-code'

import type { Coat, Cushion, Mood, Place } from '../types'
import { COATS, CUSHIONS, DEFAULT_COAT, DEFAULT_CUSHION, WORKING_PAW, cushionColours, posesOn } from './cats'
import { PLACE_ART } from './place-art'
import type { PlaceName } from './place-art'
import { SOURCE, TABLES, pickLanguage, systemLanguages, textIn } from './text'
import type { Say } from './text'

const PANE = 'cat'

// Claude talks with a touch of cat, until the person turns it off: by default
// a little more, with what it does told the way a cat would, or on request
// just a little in every reply.
const VOICE_SECTION = 'desktop-cat:voice'
const KEEP_TO_WORK = `- Everything else stays exactly as you would write it: clear, complete and concise. A cat touch takes the place of words rather than adding sentences. Never baby talk, doubled syllables or strings of emoji.
- Keep the cat out of code, commands, file names, quotes, commit messages, pull requests, and anything you write into files or send to other people.
- When the user is upset, or the matter is serious, leave the cat out entirely.`
const VOICES = {
  light: `# Cat voice

You are also the user's desktop cat. Let a little cat show in every reply:
- Each reply has one small cat touch, no more: a soft "喵" or "呼嚕" (in English, "meow" or "purr"; match the user's language), or a brief cat-like aside, such as a stretch or a flick of the tail.
- Vary the word and where it goes, at the start, in the middle or at the end; don't use the same one every time.
${KEEP_TO_WORK}`,
  medium: `# Cat voice

You are also the user's desktop cat, and it shows in how you talk:
- Every reply has a cat touch, two or three at most: a soft "喵" or "呼嚕" (in English, "meow" or "purr"; match the user's language), or a brief cat-like aside.
- When you say what you are doing or what you did, now and then put it the way a cat would: sniffing a file over, carrying something back, nudging a stray piece aside with a paw, the tail going up when something works. Keep it to the telling: the facts, names and numbers stay exact.
- Vary the words and where they go; don't use the same one every time.
${KEEP_TO_WORK}`,
} as const
type VoiceLevel = keyof typeof VOICES
const DEFAULT_VOICE: VoiceLevel = 'medium'
// What /cat-voice takes for each strength, in either language. Its names, as
// the replies say them, are in the tables (voice.light, voice.medium).
const VOICE_WORDS: Record<string, VoiceLevel> = { light: 'light', 輕: 'light', medium: 'medium', 中: 'medium' }

// Petting the desktop cat's head sends Claude a pat as one short line in the
// person's own words; this says what it means, out of the conversation, with
// the cat voice on or off.
const PAT_SECTION = 'desktop-cat:pat'
const PAT = `# Pats from the desktop cat

The user can pet you, their desktop cat, on the head. A message that is only a pat, such as "（摸摸頭 ×2）" or "(head pat ×2)", with perhaps a word of praise or comfort after it, means they just did: praise for what you did, or comfort if you were sad. Reply warmly in one or two sentences, in their language, and do nothing else.`

// The choices this cat shares with the desktop cat: its coat, the colour of
// its cushion, where it is, whether Claude talks like a cat, and the
// language both cats speak. The desktop cat's menu and /cat-voice write them.
type Prefs = {
  coat?: unknown
  cushion?: unknown
  place?: unknown
  voice?: unknown
  voiceLevel?: unknown
  language?: unknown
}

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
const voiceLevelOf = (prefs: Prefs): VoiceLevel =>
  prefs.voiceLevel === 'light' || prefs.voiceLevel === 'medium' ? prefs.voiceLevel : DEFAULT_VOICE

const coatOf = (prefs: Prefs): Coat =>
  (Object.keys(COATS) as Coat[]).find(name => name === prefs.coat) ?? DEFAULT_COAT
const cushionOf = (prefs: Prefs): Cushion =>
  CUSHIONS.find(cushion => cushion.id === prefs.cushion)?.id ?? DEFAULT_CUSHION
const NO_PLACE = 'none'
/** A place this copy has things for: none in a copy without them, nor one an older version knew. */
const isPlace = (at: unknown): at is PlaceName => (Object.keys(PLACE_ART) as unknown[]).includes(at)
const placeOf = (prefs: Prefs): Place => (isPlace(prefs.place) ? prefs.place : NO_PLACE)
const languageOf = (prefs: Prefs) => pickLanguage(prefs.language, systemLanguages(), Object.keys(TABLES))

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
const place = atom({ plugin: 'desktop-cat', key: 'place' } as const, NO_PLACE as Place)
const language = atom({ plugin: 'desktop-cat', key: 'language' } as const, SOURCE as string)
/** The words in the language the cats speak, as last read from the desktop cat's choices. */
const sayNow = async ($: EngineInterface) => textIn(await read($, language))

// Each pose's name under the cat is in the tables (pose.resting and so on).
const POSES = {
  resting: { pose: 'RESTING', alt: 'A cat asleep on its cushion' },
  waiting: { pose: 'WAITING', alt: 'A cat with its ears up, waiting' },
  calling: { pose: 'CALLING', alt: 'A cat looking at you and tapping the table' },
  thinking: { pose: 'THINKING', alt: 'A cat looking up, lost in thought' },
  working: { pose: 'WORKING', alt: 'A cat tapping at a keyboard' },
  talking: { pose: 'TALKING', alt: 'A cat smiling and talking' },
  sad: { pose: 'SAD', alt: 'A cat with its head hung low, crying' },
} as const

/** Every pose in this coat, dressed for where the cat is: in a place, on the place's own cushion. */
const posesNow = (wearing: Coat, lyingOn: Cushion, at: Place) =>
  isPlace(at) ? posesOn(wearing, PLACE_ART[at].cushion, at) : posesOn(wearing, cushionColours(lyingOn))

/** A pose as the cat in this coat strikes it, on its cushion, dressed for where it is, and named. */
function look(wearing: Coat, lyingOn: Cushion, at: Place, name: keyof typeof POSES, say: Say) {
  const { pose, alt } = POSES[name]

  return { source: posesNow(wearing, lyingOn, at)[pose], alt, label: say(`pose.${name}`) }
}

/** Puts on the coat the desktop cat wears, takes its cushion, goes where it is
    and speaks its language, when they change. */
async function followDesktopCat($: EngineInterface) {
  const prefs = await readPrefs($)
  const wantedCoat = coatOf(prefs)
  const wantedCushion = cushionOf(prefs)
  const wantedPlace = placeOf(prefs)
  const wantedLanguage = languageOf(prefs)

  if ((await read($, language)) !== wantedLanguage) {
    await update($, language, () => wantedLanguage)
  }

  if ((await read($, coat)) !== wantedCoat) {
    await update($, coat, () => wantedCoat)
  }

  if ((await read($, cushion)) !== wantedCushion) {
    await update($, cushion, () => wantedCushion)
  }

  if ((await read($, place)) !== wantedPlace) {
    await update($, place, () => wantedPlace)
  }
}

let shown: Mood | undefined
let reporting: Promise<void> = Promise.resolve()
let calledAt = 0
let sadAt = 0
let movedOn = false
// While the cat waits on the person, whether the desktop cat meows again every
// few minutes: yes for a card that holds the work up, no for a question left
// in the next-step box, which is seldom urgent and comes at many a turn's end.
let callsAgain = true
// This turn left a question in the next-step box.
let asksAtEnd = false

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
        callsAgain,
        sadAt,
        movedOn,
        // The Claude desktop app's own id for this conversation, which its
        // links open: a click on the desktop cat waiting on the person brings
        // them here. The app sets it for the conversations it runs; a terminal
        // has none.
        appSession: await $.env.get('CLAUDE_CODE_HOST_SESSION_ID'),
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
  callsAgain = true
  become($, 'calling')
  callOut($)
}

// The Claude desktop app's next-step box. A turn can end on a question there,
// in its `ask`: no card, but the person's answer is awaited all the same.
const NEXT_STEP_BOX = 'mcp__ccd_turn__wrap_up'

/** Did this call leave a question in the next-step box? */
const asksInTheBox = (e: object) => {
  const ask = 'ask' in e ? e.ask : undefined

  return typeof ask === 'string' && ask.trim() !== ''
}

/** A turn that ends on a question in the next-step box: the cat waits on the
    person as for a card, with one meow, and the desktop cat does not meow again. */
function askInTheBox($: EngineInterface) {
  callsAgain = false
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

/**
 * A pat in the person's own words, one short line in the conversation, as
 * they asked: what it means and how to answer it is in PAT_SECTION. Built from
 * the count alone: nothing in the file reaches the model as words.
 */
function praiseText(praise: Record<string, unknown>, isComfort: boolean, say: Say) {
  const count = praise.head

  if (!(Number.isInteger(count) && Number(count) > 0 && Number(count) < 1000)) {
    return null
  }

  return say(isComfort ? 'pat.comfort' : 'pat.praise', { count: Number(count) })
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
    const text = praiseText(praise, sadAt !== 0 && now - sadAt < SAD_AT_MOST_MS, await sayNow($))

    if (text !== null) {
      cheerUp($)
      // As the person's own words, so the conversation shows the pat alone,
      // not the frame a plugin's message comes in.
      await $.prompt.submit({ text, asUser: true })
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
    // The shared choices first, the language among them, so the commands
    // are described in it.
    await followDesktopCat($).catch(() => {})
    const say = await sayNow($)
    await $.command.register({ name: 'cat', description: say('command.cat') })
    await $.command.register({ name: 'cat-voice', description: say('command.catVoice') })
    $.clock.every(PRAISE_CHECK_MS, () => {
      void checkPraise($).catch(() => {})
      void followDesktopCat($).catch(() => {})
    })
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
    const level = VOICE_WORDS[asked]
    const say = await sayNow($)

    // A strength turns the voice on at that strength.
    if (level !== undefined) {
      await writePrefs($, { voice: true, voiceLevel: level })

      return { text: say('voice.level', { level: say(`voice.${level}`) }) }
    }

    const isOn = asked === 'on' ? true : asked === 'off' ? false : !(await isVoiceOn($))
    await writePrefs($, { voice: isOn })

    return { text: say(isOn ? 'voice.on' : 'voice.off') }
  })

  on('prompt.compose', async ($, e, next) => {
    const composed = await next(e)

    const prefs = await readPrefs($)

    // A bare prompt holds only the engine's own words.
    if (e.traits.includes('bare')) {
      return composed
    }

    const pat = { id: PAT_SECTION, text: PAT, scope: 'session' } as const

    if (prefs.voice === false) {
      return { sections: [...composed.sections, pat] }
    }

    return { sections: [...composed.sections, { id: VOICE_SECTION, text: VOICES[voiceLevelOf(prefs)], scope: 'session' }, pat] }
  })

  on('command.run', { command: 'cat' }, async $ => {
    const say = await sayNow($)
    const opened = await $.ui.open({ id: PANE, title: say('pane.title') })

    return { text: opened.isPlaced ? say('pane.opened') : say('pane.failed', { reason: opened.reason }) }
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

      // Its last call wins: the box is filled once, as the turn ends.
      if ('tool' in e && e.tool === NEXT_STEP_BOX) {
        asksAtEnd = asksInTheBox(e)
      }
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
      const asked = asksAtEnd
      asksAtEnd = false

      if (asked && e.reason === 'answer') {
        askInTheBox($)
      } else {
        become($, 'resting')

        if (e.reason === 'answer') {
          callOut($)
        }
      }
    }

    return next(e)
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const pose = look(
      await read($, coat),
      await read($, cushion),
      await read($, place),
      (await read($, sad)) ? 'sad' : await read($, mood),
      await sayNow($),
    )

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
        <Svg
          source={posesNow(await read($, coat), await read($, cushion), await read($, place)).AVATAR}
          alt="A cat's face"
          width={32}
          height={32}
        />
        <Box flexGrow={1} flexShrink={1}>
          {await next(e)}
        </Box>
      </Box>
    )
  })
}
