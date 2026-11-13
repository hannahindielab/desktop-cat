// The words a window shows, from the main program's tables (src/locales), in
// the language the cats speak. An element names its words with data-i18n:
// data-i18n="look.coat" sets its text, and "[aria-label]look.effects" one of
// its attributes; several are joined with ';'. Scripts ask for theirs with t.
// Asked again after another language is picked in the menu, it changes them all.
window.startText = async function startText(ask) {
  const { language, source, resources } = await ask()

  if (window.i18next.isInitialized) {
    for (const [code, bundle] of Object.entries(resources)) {
      window.i18next.addResourceBundle(code, 'translation', bundle.translation, true, true)
    }
    await window.i18next.changeLanguage(language)
  } else {
    window.i18next.init({
      lng: language,
      fallbackLng: source,
      resources,
      // The tables came whole, so the words are ready when this returns.
      initAsync: false,
      // Words are set as text, never as markup, so nothing in them needs escaping.
      interpolation: { escapeValue: false },
    })
  }
  document.documentElement.lang = language

  for (const element of document.querySelectorAll('[data-i18n]')) {
    for (const part of element.dataset.i18n.split(';')) {
      const [, attribute, key] = part.trim().match(/^(?:\[([\w-]+)\])?(.+)$/)

      if (attribute === undefined) {
        element.textContent = window.i18next.t(key)
      } else {
        element.setAttribute(attribute, window.i18next.t(key))
      }
    }
  }

  return (key, values) => window.i18next.t(key, values)
}
