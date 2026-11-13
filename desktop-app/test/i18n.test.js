const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const { test } = require('node:test')

const { SOURCE, chosenLanguage, languagesOffered, pickLanguage, readTables, startText, t, useLanguage } = require('../src/i18n')
const { CAN_FOODS, CAN_LABELS, COATS, CUSHIONS } = require('../src/prefs')
// The places' own words live in locales/scenes/, which a copy without places
// (the public one, for now) leaves out with them.
const HAS_PLACES = require('../src/scenes').PLACES.length > 0
const PLACE_WORDS = /^(menu\.place|app\.effectsWindow|look\.(tabPlace|place\w*|effects\w*|cushionFollowsPlace)|place\..+)$/

const SRC = path.join(__dirname, '..', 'src')
const tables = readTables()

/** Every name in a table, such as 'menu.quit', with its words. */
function flatten(table, prefix = '') {
  return Object.entries(table).flatMap(([name, words]) =>
    typeof words === 'object' ? flatten(words, `${prefix}${name}.`) : [[`${prefix}${name}`, words]],
  )
}

const source = Object.fromEntries(flatten(tables[SOURCE]))
const blanks = words => [...words.matchAll(/\{\{\s*(\w+)\s*\}\}/g)].map(match => match[1]).sort()
const programFiles = () =>
  fs
    .readdirSync(SRC)
    .filter(name => /\.(js|html|json)$/.test(name))
    .map(name => ({ name, text: fs.readFileSync(path.join(SRC, name), 'utf8') }))

test('a computer set to Traditional Chinese gets Chinese, in the order the person set', () => {
  // With an English table as well as the Chinese one, as there will be.
  const both = ['zh-Hant', 'en']

  assert.equal(pickLanguage(undefined, ['zh-TW'], both), 'zh-Hant')
  assert.equal(pickLanguage(undefined, ['zh-HK'], both), 'zh-Hant')
  assert.equal(pickLanguage(undefined, ['zh-Hant-TW'], both), 'zh-Hant')
  assert.equal(pickLanguage(undefined, ['en-GB'], both), 'en', 'English of any country')
  assert.equal(pickLanguage(undefined, ['ja-JP', 'zh-TW', 'en-US'], both), 'zh-Hant', 'the first of hers there is a table for')
  assert.equal(pickLanguage(undefined, ['not a language!', 'zh-TW'], both), 'zh-Hant', 'what is not a language is passed over')
})

test('the language the person chose comes first, if there is a table for it', () => {
  const both = ['zh-Hant', 'en']

  assert.equal(pickLanguage('en', ['zh-TW'], both), 'en')
  assert.equal(pickLanguage('auto', ['zh-TW'], both), 'zh-Hant', 'auto: the computer decides')
  assert.equal(pickLanguage('fr', ['zh-TW'], both), 'zh-Hant', 'a language with no table: the computer decides')
})

test('a computer in none of the languages: English, or Chinese while there is only Chinese', () => {
  assert.equal(pickLanguage(undefined, ['ja-JP'], ['zh-Hant', 'en']), 'en')
  assert.equal(pickLanguage(undefined, ['zh-CN'], ['zh-Hant', 'en']), 'en', 'Simplified Chinese has no table yet')
  assert.equal(pickLanguage(undefined, [], ['zh-Hant', 'en']), 'en')
  assert.equal(pickLanguage(undefined, ['ja-JP'], ['zh-Hant']), 'zh-Hant')
})

test('the words come from the table of the language picked', () => {
  assert.equal(startText({ asked: undefined, preferred: ['zh-TW'] }), 'zh-Hant')
  assert.equal(t('menu.quit'), '離開')
  assert.equal(t('cans.mealLeft', { percent: '80%' }), '這一餐剩 80%')
})

test("the language can change while the cat runs, and go back to the computer's", async () => {
  startText({ asked: undefined, preferred: ['zh-TW'] })
  assert.equal(await useLanguage({ asked: 'en', preferred: ['zh-TW'] }), 'en')
  assert.equal(t('menu.quit'), 'Exit')
  assert.equal(await useLanguage({ asked: undefined, preferred: ['zh-TW'] }), 'zh-Hant')
  assert.equal(t('menu.quit'), '離開')
})

test('each language is offered in its own words; a choice counts only if there is a table for it', () => {
  startText({ asked: undefined, preferred: ['zh-TW'] })
  assert.deepEqual(languagesOffered(), [
    { code: 'en', name: 'English' },
    { code: 'zh-Hant', name: '繁體中文' },
  ])
  assert.equal(chosenLanguage('EN'), 'en', 'whatever the capitals')
  assert.equal(chosenLanguage('fr'), undefined, 'no table: the computer decides')
  assert.equal(chosenLanguage(undefined), undefined)
})

test('every choice has its name in the Chinese table, the same words as before', () => {
  const names = (group, ids) => ids.map(id => source[`${group}.${id}`])

  assert.deepEqual(names('coat', COATS.map(coat => coat.id)), ['三花', '賓士', '暹羅'])
  assert.deepEqual(names('size', ['small', 'medium', 'large']), ['小', '中', '大'])
  assert.deepEqual(names('volume', ['low', 'medium', 'high']), ['小聲', '中等', '大聲'])
  // The places' names are checked with the places, in scenes-unit.js.
  assert.deepEqual(
    names('colour', CAN_LABELS.map(label => label.id)),
    ['珊瑚粉', '抹茶綠', '奶茶米', '霧粉', '霧藍', '薰衣草', '夜空藍', '莓果紅', '水泥灰'],
  )
  assert.ok(CUSHIONS.every(cushion => source[`colour.${cushion.id}`] !== undefined), 'every cushion colour named')
  assert.deepEqual(names('food', CAN_FOODS.map(food => food.id)), ['鮪魚', '鮭魚', '雞肉', '牛肉'])
})

test('every name the program asks for is in the Chinese table', () => {
  const asked = programFiles().flatMap(({ name, text }) => [
    // t('menu.quit') and t(`cans.unknown`); names built from a choice's id are checked above.
    ...[...text.matchAll(/\bt\(\s*(['`])([^'`$]+)\1/g)].map(match => ({ name, key: match[2] })),
    // data-i18n="look.coat" and data-i18n="[aria-label]look.effects".
    ...[...text.matchAll(/data-i18n="([^"]+)"/g)].flatMap(match =>
      match[1].split(';').map(part => ({ name, key: part.trim().replace(/^\[[\w-]+\]/, '') })),
    ),
  ])

  assert.ok(asked.length >= 30, `the program's names were found (${asked.length})`)
  const missing = asked.filter(({ key }) => source[key] === undefined && (HAS_PLACES || !PLACE_WORDS.test(key)))
  assert.deepEqual(missing, [], 'names with no words')
})

test('every other table names the same things, with the same blanks to fill', () => {
  for (const [language, table] of Object.entries(tables)) {
    const words = Object.fromEntries(flatten(table))

    assert.deepEqual(Object.keys(words).sort(), Object.keys(source).sort(), `${language}: the same names`)
    for (const [key, text] of Object.entries(words)) {
      assert.deepEqual(blanks(text), blanks(source[key]), `${language} ${key}: the same blanks`)
    }
  }
})

test('no words are left in the program itself: all of them are in the tables', () => {
  const chinese = /[　-〿㐀-鿿＀-￯]/
  const found = programFiles().flatMap(({ name, text }) =>
    text
      // Notes for whoever reads the code are not shown, so they may be in any language.
      // (Their line breaks are kept, so the lines found keep their numbers.)
      .replace(/\/\*[\s\S]*?\*\//g, note => note.replace(/[^\n]/g, ''))
      .replace(/<!--[\s\S]*?-->/g, note => note.replace(/[^\n]/g, ''))
      .split('\n')
      .map(line => line.replace(/(^|[^:'"`])\/\/.*$/, '$1'))
      .map((line, i) => ({ name, line: i + 1, text: line.trim() }))
      .filter(({ text: words }) => chinese.test(words)),
  )

  assert.deepEqual(found, [])
})
