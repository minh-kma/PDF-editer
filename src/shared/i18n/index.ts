// i18n setup — English + Vietnamese, 100% client-side.
//
// Every string ships bundled (see locales/<lang>/index.ts). There is no
// i18next-http-backend and no CDN: the app must keep working offline, and
// nothing about the user's session may hit the network.
//
// Detection order is path -> localStorage -> navigator, so an explicit choice
// from the language switcher always beats the browser locale on later visits.
// `load: 'languageOnly'` is what maps any vi-* tag (vi-VN, vi-Hans, …) onto
// the single `vi` bundle; anything unsupported falls back to English.
import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import LanguageDetector from 'i18next-browser-languagedetector'
import en from './locales/en'
import vi from './locales/vi'

/** True when the current URL path is the Vietnamese homepage (/vi/ or /vi,
 *  with or without a trailing index.html). The homepage is served as two static
 *  HTML files — / (English) and /vi/ (Vietnamese) — and the path decides which
 *  language react-i18next starts in. Only the /vi/ path claims a language; the
 *  root path returns nothing so the existing localStorage -> navigator chain is
 *  used unchanged. Matched on the last path segment so a subfolder deploy
 *  (base: './') still works. */
function isVietnamesePath(): boolean {
  const path = window.location.pathname.replace(/index\.html$/, '')
  return /\/vi\/?$/.test(path)
}

/** Matches storage.ts's 'pdfdemo:session:v2' key convention. Deliberately
 *  localStorage, not the IndexedDB session store: a language preference must
 *  survive "Start over" and clearSession(), which wipe the working document. */
export const LANGUAGE_STORAGE_KEY = 'pdfdemo:lang'

export const SUPPORTED_LANGUAGES = ['en', 'vi'] as const
export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number]

/** Narrows whatever i18next reports as the current language to one of ours.
 *  `load: 'languageOnly'` only affects which *resources* are loaded — when the
 *  navigator detector wins, `i18n.language` stays the raw region tag ('vi-VN'),
 *  which is not in SUPPORTED_LANGUAGES. Anything comparing the two must go
 *  through here: without it a Vietnamese-browser visitor on / reads as an
 *  unsupported language, the switcher shows "EN" while the page is in
 *  Vietnamese, and clicking English is a no-op because it already thinks it is
 *  English. Unsupported languages fall back to English, matching fallbackLng. */
export function toSupportedLanguage(language: string | undefined): SupportedLanguage {
  const base = (language ?? '').split('-')[0].toLowerCase()
  return (SUPPORTED_LANGUAGES as readonly string[]).includes(base)
    ? (base as SupportedLanguage)
    : 'en'
}

/** Records an *explicit* language choice. The switcher must call this before it
 *  navigates: the new page load re-runs detection from scratch, and on the
 *  English root path there is no other signal that the user chose English — the
 *  path detector correctly stays silent there, so without this write detection
 *  falls through to `navigator`, and a Vietnamese browser locale would silently
 *  undo the choice. Only the switcher writes this key (see `caches: []` below),
 *  so its presence always means "the user picked this". */
export function persistLanguagePreference(language: SupportedLanguage): void {
  try {
    window.localStorage.setItem(LANGUAGE_STORAGE_KEY, language)
  } catch {
    // Private-mode / storage-disabled browsers: the choice still applies to the
    // page we're about to load, it just won't survive the next visit.
  }
}

/** URL of the homepage in the given language, derived from the current path so
 *  it works on localhost, `npm run preview`, and a subfolder deploy alike (base:
 *  './'). The language switcher navigates here (a real URL change / page load)
 *  rather than only toggling in-memory state, so the crawlable /vi/ page and the
 *  UI language always agree. English is the site root; Vietnamese is /vi/. */
export function homepageUrlForLanguage(language: SupportedLanguage): string {
  // Strip a trailing index.html and any existing /vi/ segment to get the
  // English root of wherever the app is hosted, then re-add /vi/ if needed.
  let root = window.location.pathname.replace(/index\.html$/, '')
  root = root.replace(/\/vi\/?$/, '/')
  if (!root.endsWith('/')) root += '/'
  return language === 'vi' ? `${root}vi/` : root
}

// Custom detector placed first in the order: on the /vi/ homepage it starts the
// app in Vietnamese; on every other path it returns undefined so detection falls
// straight through to the unchanged localStorage -> navigator chain. This lets
// the URL set the starting point without ever replacing or fighting the existing
// detector on the root path.
const languageDetector = new LanguageDetector()
languageDetector.addDetector({
  name: 'path',
  lookup: () => (isVietnamesePath() ? 'vi' : undefined),
})

void i18n
  .use(languageDetector)
  .use(initReactI18next)
  .init({
    resources: { en, vi },
    supportedLngs: [...SUPPORTED_LANGUAGES],
    fallbackLng: 'en',
    load: 'languageOnly',
    nonExplicitSupportedLngs: true,
    defaultNS: 'common',
    detection: {
      order: ['path', 'localStorage', 'navigator'],
      lookupLocalStorage: LANGUAGE_STORAGE_KEY,
      // Deliberately no automatic caching. i18next writes back whatever it
      // *detected*, which meant merely loading /vi/ (path detector) or having a
      // Vietnamese browser (navigator) stamped 'vi' into localStorage as if the
      // user had asked for it — and then outranked their real choice on the
      // root path. The stored key must mean "explicitly chosen", so the
      // switcher is the only thing that writes it, via
      // persistLanguagePreference().
      caches: [],
    },
    // React escapes interpolated values already.
    interpolation: { escapeValue: false },
    // Resources are imported synchronously, so there's nothing to suspend on.
    react: { useSuspense: false },
  })

// index.html hard-codes lang="en" and an English <title>; without this they'd
// stay English for a Vietnamese reader (and for screen readers).
function syncDocumentLanguage(detected: string) {
  const language = toSupportedLanguage(detected)
  document.documentElement.lang = language
  document.title =
    language === 'vi'
      ? 'PDFChill — Trình chỉnh sửa PDF miễn phí, riêng tư, ngay trong trình duyệt'
      : 'PDFChill — Free, private, in-browser PDF editor'
}

syncDocumentLanguage(i18n.language)
i18n.on('languageChanged', syncDocumentLanguage)

export default i18n
