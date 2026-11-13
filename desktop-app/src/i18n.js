const fs = require('node:fs')
const path = require('node:path')
const i18next = require('i18next')

// The words the desktop cat shows, one table per language in locales/, named
// by its language tag (zh-Hant.json). Every word is first written in Chinese,
// whose table is whole; a word another table lacks is shown in Chinese.
//
// Which table: the language the person chose (prefs.json's `language`, which
// the Claude cat reads too), or else the first of the computer's languages,
// in the person's own order, that there is a table for; or else English, or
// else Chinese.
const LOCALES_DIR = path.join(__dirname, 'locales')
const SOURCE = 'zh-Hant'
const FALLBACKS = ['en', SOURCE]

const readTable = file => JSON.parse(fs.readFileSync(file, 'utf8'))

/** Every table there is, by language tag. The places' own words sit apart in
    locales/scenes/, one table per language, and join their language's table
    here: a copy without the places (scenes.js) leaves that folder out too. */
function readTables(dir = LOCALES_DIR) {
  const tables = Object.fromEntries(
    fs
      .readdirSync(dir)
      .filter(name => name.endsWith('.json'))
      .map(name => [path.basename(name, '.json'), readTable(path.join(dir, name))]),
  )
  const scenes = path.join(dir, 'scenes')

  if (fs.existsSync(scenes)) {
    for (const name of fs.readdirSync(scenes).filter(file => file.endsWith('.json'))) {
      const table = tables[path.basename(name, '.json')]

      for (const [group, words] of Object.entries(table === undefined ? {} : readTable(path.join(scenes, name)))) {
        table[group] = { ...table[group], ...words }
      }
    }
  }

  return tables
}

/** Which of the available languages to show: the one asked for, if there is a
    table for it; else the first preferred language that matches one exactly,
    by language and script (zh-TW is zh-Hant), or by language alone (en-GB is
    en); else the fallbacks. */
function pickLanguage(asked, preferred, available) {
  const find = tag => available.find(code => code.toLowerCase() === String(tag).toLowerCase())

  if (typeof asked === 'string' && find(asked) !== undefined) {
    return find(asked)
  }

  for (const tag of preferred ?? []) {
    let locale

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

  return FALLBACKS.map(find).find(code => code !== undefined) ?? available[0]
}

let tables = {}

/** Picks the language and readies its words, before anything shows them.
    `preferred` is the computer's languages, from app.getPreferredSystemLanguages(). */
function startText({ asked, preferred }) {
  tables = readTables()
  const language = pickLanguage(asked, preferred, Object.keys(tables))

  i18next.init({
    lng: language,
    fallbackLng: SOURCE,
    resources: Object.fromEntries(Object.entries(tables).map(([code, table]) => [code, { translation: table }])),
    // The tables are all here already, so the words are ready when this returns.
    initAsync: false,
    // Words are set as text, never as markup, so nothing in them needs escaping.
    interpolation: { escapeValue: false },
  })

  return language
}

/** Speaks another language from now on, when the person picks one in the menu
    (or picks the computer's again: `asked` undefined). Returns the one picked. */
async function useLanguage({ asked, preferred }) {
  const language = pickLanguage(asked, preferred, Object.keys(tables))

  await i18next.changeLanguage(language)
  return language
}

/** The language the person chose, if there is a table for it; undefined when
    the computer decides. */
const chosenLanguage = asked =>
  typeof asked === 'string'
    ? Object.keys(tables).find(code => code.toLowerCase() === asked.toLowerCase())
    : undefined

/** Every language there is a table for, each named in its own words (English,
    繁體中文), so someone who can't read the menu still finds theirs. */
const languagesOffered = () =>
  Object.keys(tables)
    .sort()
    .map(code => ({ code, name: i18next.t('language.self', { lng: code }) }))

/** The language the cat speaks now, by its table's name: 'zh-Hant', 'en'. */
const currentLanguage = () => i18next.language

/** One piece of text by its name in the tables, such as 'menu.quit', with
    anything it takes filled in: t('look.cushionFollowsPlace', { place }). */
const t = (key, values) => i18next.t(key, values)

/** What a window needs to show the same words: the language, and the tables
    of that language and of Chinese, for the words it lacks. */
function textForWindows() {
  const language = i18next.language
  const shared = [...new Set([language, SOURCE])]

  return {
    language,
    source: SOURCE,
    resources: Object.fromEntries(shared.map(code => [code, { translation: tables[code] }])),
  }
}

module.exports = {
  FALLBACKS,
  LOCALES_DIR,
  SOURCE,
  chosenLanguage,
  currentLanguage,
  languagesOffered,
  pickLanguage,
  readTables,
  startText,
  t,
  textForWindows,
  useLanguage,
}
