// Vietnamese copy — drafted, pending native-speaker review by the product
// owner (see the i18n plan's quality gate). Keep the key set aligned with
// en/index.ts; a missing key silently falls back to English.
//
// Plural keys carry only the `_other` form here: Vietnamese has no plural
// inflection, so Intl.PluralRules('vi') never resolves to anything else.
import common from './common.json'
import appbar from './appbar.json'
import landing from './landing.json'
import workspace from './workspace.json'
import split from './split.json'
import compress from './compress.json'
import ocr from './ocr.json'
import protect from './protect.json'
import docMarks from './docMarks.json'
import imagesToPdf from './imagesToPdf.json'
import errors from './errors.json'

export default {
  common,
  appbar,
  landing,
  workspace,
  split,
  compress,
  ocr,
  protect,
  docMarks,
  imagesToPdf,
  errors,
}
