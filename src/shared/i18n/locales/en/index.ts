// Static imports, not a runtime fetch: every string is bundled with the app,
// same as every other asset. Adding an i18next HTTP backend here would break
// the offline/no-network guarantee (CLAUDE.md).
//
// Namespaces mirror the feature module folders, so a string's home is
// predictable from where its UI lives.
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
}
