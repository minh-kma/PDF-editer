// Types t() against the English resources, so `t('appbar:startOver')`
// autocompletes and `npx tsc --noEmit` fails on a typo or a key that only
// exists in one language. With ~400 keys across the UI, this is what makes the
// typecheck a real check on the translation work.
import type en from './locales/en'

declare module 'i18next' {
  interface CustomTypeOptions {
    defaultNS: 'common'
    resources: typeof en
  }
}
