// i18n setup — English + Vietnamese, 100% client-side.
//
// Every string ships bundled (see locales/<lang>/index.ts). There is no
// i18next-http-backend and no CDN: the app must keep working offline, and
// nothing about the user's session may hit the network.
//
// Detection order is localStorage -> navigator, so an explicit choice from the
// language switcher always beats the browser locale on later visits.
// `load: 'languageOnly'` is what maps any vi-* tag (vi-VN, vi-Hans, …) onto
// the single `vi` bundle; anything unsupported falls back to English.
import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import LanguageDetector from 'i18next-browser-languagedetector'
import en from './locales/en'
import vi from './locales/vi'

/** Matches storage.ts's 'pdfdemo:session:v2' key convention. Deliberately
 *  localStorage, not the IndexedDB session store: a language preference must
 *  survive "Start over" and clearSession(), which wipe the working document. */
export const LANGUAGE_STORAGE_KEY = 'pdfdemo:lang'

export const SUPPORTED_LANGUAGES = ['en', 'vi'] as const
export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number]

void i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: { en, vi },
    supportedLngs: [...SUPPORTED_LANGUAGES],
    fallbackLng: 'en',
    load: 'languageOnly',
    nonExplicitSupportedLngs: true,
    defaultNS: 'common',
    detection: {
      order: ['localStorage', 'navigator'],
      lookupLocalStorage: LANGUAGE_STORAGE_KEY,
      caches: ['localStorage'],
    },
    // React escapes interpolated values already.
    interpolation: { escapeValue: false },
    // Resources are imported synchronously, so there's nothing to suspend on.
    react: { useSuspense: false },
  })

// index.html hard-codes lang="en" and an English <title>; without this they'd
// stay English for a Vietnamese reader (and for screen readers).
function syncDocumentLanguage(language: string) {
  document.documentElement.lang = language
  document.title =
    language === 'vi'
      ? 'PDFdemo — Trình chỉnh sửa PDF miễn phí, riêng tư, ngay trong trình duyệt'
      : 'PDFdemo — Free, private, in-browser PDF editor'
}

syncDocumentLanguage(i18n.language)
i18n.on('languageChanged', syncDocumentLanguage)

export default i18n
