// The Claude cat's own words, one table per language, in the same shape as
// the desktop cat's (its src/locales): names such as 'pose.resting', with
// {{count}} marking what is filled in. Every word is first written in
// Chinese, whose table is whole; a word another table lacks is said in
// Chinese. A plugin may load nothing but its own files, so this is a small
// table of its own rather than the desktop cat's translation tool.
//
// Which table: the language the person chose (prefs.json's `language`, shared
// with the desktop cat), or else the computer's, or else English, or else
// Chinese; the same rules as the desktop cat's src/i18n.js.
type Table = { readonly [name: string]: string | Table }

export const SOURCE = 'zh-Hant'
const FALLBACKS = ['en', SOURCE]

export const TABLES: Readonly<Record<string, Table>> = {
  'zh-Hant': {
    pane: {
      title: '貓咪',
      opened: '貓咪面板打開了。',
      failed: '貓咪面板現在顯示不出來：{{reason}}',
    },
    pose: {
      resting: '休息中',
      waiting: '等待中',
      calling: '等你回應',
      thinking: '思考中',
      working: '做事中',
      talking: '說話中',
      sad: '難過中',
    },
    voice: {
      light: '輕',
      medium: '中',
      level: '貓語氣：{{level}}，喵。',
      on: '貓語氣打開了，喵。',
      off: '貓語氣關掉了，回到一般說話方式。',
    },
    pat: {
      praise: '（摸摸頭 ×{{count}}）做得很好！',
      comfort: '（摸摸頭 ×{{count}}）不要難過了。',
    },
    // What Claude Code's list of commands says of each.
    command: {
      cat: 'Open the pane with the cat beside the chat',
      catVoice: 'Turn the cat way of talking on or off, or set how much: on, off, light (輕), medium (中), or nothing to switch',
    },
  },
  // English words as English software says them, from the side-by-side page.
  en: {
    pane: {
      title: 'Cat',
      opened: 'Opened the cat pane.',
      failed: "Can't show the cat pane right now: {{reason}}",
    },
    pose: {
      resting: 'Napping',
      waiting: 'Waiting',
      calling: 'Your turn',
      thinking: 'Thinking',
      working: 'Working',
      talking: 'Replying',
      sad: 'Feeling sad',
    },
    voice: {
      light: 'light',
      medium: 'medium',
      level: 'Cat-style replies: {{level}}. Meow.',
      on: 'Cat-style replies are on. Meow.',
      off: 'Cat-style replies are off. Back to normal.',
    },
    pat: {
      praise: '(head pat ×{{count}}) Good job!',
      comfort: "(head pat ×{{count}}) It's okay.",
    },
    command: {
      cat: 'Open the cat pane beside the chat',
      catVoice: 'Toggle cat-style replies with no argument, or use on, off, light, or medium',
    },
  },
}

/** Which of the available languages to use: the one asked for, if there is a
    table for it; else the first preferred language that matches one exactly,
    by language and script (zh-TW is zh-Hant), or by language alone (en-GB is
    en); else the fallbacks. */
export function pickLanguage(asked: unknown, preferred: readonly string[], available: readonly string[]): string {
  const find = (tag: string) => available.find(code => code.toLowerCase() === tag.toLowerCase())
  const chosen = typeof asked === 'string' ? find(asked) : undefined

  if (chosen !== undefined) {
    return chosen
  }

  for (const tag of preferred) {
    let locale: Intl.Locale

    try {
      locale = new Intl.Locale(tag).maximize()
    } catch {
      // Not a language tag: try the next one.
      continue
    }

    const found = find(tag) ?? find(`${locale.language}-${locale.script}`) ?? find(locale.language)

    if (found !== undefined) {
      return found
    }
  }

  return FALLBACKS.map(find).find(code => code !== undefined) ?? available[0] ?? SOURCE
}

/** The computer's language as this program's runtime knows it, such as 'zh-TW'. */
export const systemLanguages = (): string[] => [Intl.DateTimeFormat().resolvedOptions().locale]

function lookUp(table: Table | undefined, key: string): string | undefined {
  let found: string | Table | undefined = table

  for (const name of key.split('.')) {
    found = typeof found === 'object' ? found[name] : undefined
  }

  return typeof found === 'string' ? found : undefined
}

/** The words of one language: say('pat.praise', { count: 2 }). */
export function textIn(language: string) {
  return (key: string, values: Readonly<Record<string, string | number>> = {}) =>
    (lookUp(TABLES[language], key) ?? lookUp(TABLES[SOURCE], key) ?? key).replace(
      /\{\{\s*(\w+)\s*\}\}/g,
      (_, name: string) => String(values[name] ?? ''),
    )
}

export type Say = ReturnType<typeof textIn>
