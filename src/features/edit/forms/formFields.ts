// PDF Forms — reading and filling existing AcroForm fields (decision D10,
// first half only). Creating new fields on a PDF with no existing AcroForm
// is a separate, deferred follow-up task (D10's second half) — not built
// here.
//
// A one-shot, on-demand content transform with no ongoing app-state
// involvement (like bakeOcrTextLayer.ts/editText.ts), not part of the D11
// annotation pipeline — so it lives in its own module here rather than
// shared/lib/. Sibling to edit-text/ under the same `edit` roadmap group
// (architecture.md's documented home for Edit-group tools that don't share
// code with page-management/optimize/security).
//
// Pure pdf-lib — pdf-lib has native AcroForm support, so unlike OCR/Edit
// Text there's no pdf.js involved here at all.
//
// D19: logic-first, UI-last. Nothing here is wired into any UI.
import {
  PDFCheckBox,
  PDFDocument,
  PDFDropdown,
  PDFOptionList,
  PDFRadioGroup,
  PDFTextField,
  type PDFPage,
  type PDFWidgetAnnotation,
} from 'pdf-lib'
import type { Rect } from '../../../shared/state/types'

export type FormFieldType = 'text' | 'checkbox' | 'radioGroup' | 'dropdown' | 'listBox'

/** A field's value: a string for text fields and single-select radio groups
 * (empty string if unset/nothing selected), a boolean for checkboxes, or a
 * string array for multi-capable dropdowns/list boxes. Used for both the
 * current value (extractFormFields) and a new value to apply (FieldValue). */
export type FormFieldValue = string | boolean | string[]

export interface FormFieldInfo {
  name: string
  type: FormFieldType
  value: FormFieldValue
  /** Choices available for radioGroup/dropdown/listBox; omitted for text/checkbox. */
  options?: string[]
  /** 0-based index of the page the field's (first) widget appears on. */
  pageIndex: number
  /** Normalized 0..1, top-left origin — same convention as Annotation.rect. */
  rect: Rect
}

/**
 * pdf-lib rect (bottom-left origin, points) -> normalized Rect (top-left
 * origin, 0..1). The exact inverse of annotationBake.ts's toRect — that
 * function goes normalized-Rect -> pdf-lib-rect; this task needs the same
 * conversion in the opposite direction, so the formula is inverted rather
 * than re-derived:
 *   toRect:   x = r.x*W          y = H-(r.y+r.h)*H     w = r.w*W    h = r.h*H
 *   inverse:  r.x = x/W          r.y = (H-y-height)/H  r.w = w/W    r.h = height/H
 */
function fromPdfRect(
  pdfRect: { x: number; y: number; width: number; height: number },
  W: number,
  H: number,
): Rect {
  return {
    x: pdfRect.x / W,
    y: (H - pdfRect.y - pdfRect.height) / H,
    w: pdfRect.width / W,
    h: pdfRect.height / H,
  }
}

/**
 * Find which page a field's widget appears on. Mirrors PDFForm's own
 * private findWidgetPage: try the widget's direct /P page reference first,
 * then fall back to searching each page's annotation array. Returns page
 * index 0 as a last resort (shouldn't normally happen for a widget that's
 * actually part of the document).
 */
function findWidgetPageIndex(doc: PDFDocument, pages: PDFPage[], widget: PDFWidgetAnnotation): number {
  const pageRef = widget.P()
  let page = pageRef ? pages.find((p) => p.ref === pageRef) : undefined
  if (!page) {
    const widgetRef = doc.context.getObjectRef(widget.dict)
    page = widgetRef ? doc.findPageForAnnotationRef(widgetRef) : undefined
  }
  return page ? pages.indexOf(page) : 0
}

/**
 * Read-only: enumerate a PDF's existing AcroForm fields (text/checkbox/
 * radio group/dropdown/list box only — pushbuttons and signature fields are
 * out of scope, per D10/D9, and are skipped). Never modifies or re-saves
 * the source PDF.
 *
 * Investigated: `PDFDocument.getForm()` never throws for a PDF with no
 * AcroForm — pdf-lib lazily creates an empty one in memory
 * (`catalog.getOrCreateAcroForm()`) and `getFields()` on it simply returns
 * `[]`. That in-memory creation is harmless here because this function
 * never calls `.save()`, so nothing is ever persisted for a plain read.
 */
export async function extractFormFields(sourceBytes: Uint8Array): Promise<FormFieldInfo[]> {
  const pdfDoc = await PDFDocument.load(sourceBytes.slice())
  const form = pdfDoc.getForm()
  const fields = form.getFields()
  const pages = pdfDoc.getPages()

  const infos: FormFieldInfo[] = []

  for (const field of fields) {
    // Multi-widget fields: only the first widget's position is used, per
    // the task's scope (no full multi-widget support needed).
    const widget = field.acroField.getWidgets()[0]
    if (!widget) continue

    let type: FormFieldType
    let value: FormFieldValue
    let options: string[] | undefined

    if (field instanceof PDFTextField) {
      type = 'text'
      value = field.getText() ?? ''
    } else if (field instanceof PDFCheckBox) {
      type = 'checkbox'
      value = field.isChecked()
    } else if (field instanceof PDFRadioGroup) {
      type = 'radioGroup'
      value = field.getSelected() ?? ''
      options = field.getOptions()
    } else if (field instanceof PDFDropdown) {
      type = 'dropdown'
      value = field.getSelected()
      options = field.getOptions()
    } else if (field instanceof PDFOptionList) {
      type = 'listBox'
      value = field.getSelected()
      options = field.getOptions()
    } else {
      continue // pushbutton / signature field — not a fillable value, out of scope
    }

    const pageIndex = findWidgetPageIndex(pdfDoc, pages, widget)
    const { width: W, height: H } = pages[pageIndex].getSize()

    infos.push({ name: field.getName(), type, value, options, pageIndex, rect: fromPdfRect(widget.getRectangle(), W, H) })
  }

  return infos
}

/** One field to fill: a field name (as returned by extractFormFields) and its new value. */
export interface FieldValue {
  name: string
  value: FormFieldValue
}

export interface FieldEditResult {
  name: string
  status: 'applied' | 'failed'
  /** Present when status is 'failed'. */
  reason?: string
}

/**
 * Fill existing AcroForm fields by name. Fields not mentioned in `values`
 * keep their current value. A named field that doesn't exist (or a value
 * of the wrong shape for its field type) is reported as a per-field
 * failure in `results` — it does not abort the rest of the call. The form
 * is NOT flattened; it remains fillable/editable in the output.
 */
export async function fillFormFields(
  sourceBytes: Uint8Array,
  values: FieldValue[],
): Promise<{ bytes: Uint8Array; results: FieldEditResult[] }> {
  const pdfDoc = await PDFDocument.load(sourceBytes.slice())
  const form = pdfDoc.getForm()
  const results: FieldEditResult[] = []

  for (const edit of values) {
    const field = form.getFieldMaybe(edit.name)
    if (!field) {
      results.push({ name: edit.name, status: 'failed', reason: 'No field with this name exists.' })
      continue
    }

    try {
      if (field instanceof PDFTextField) {
        if (typeof edit.value !== 'string') throw new Error('Expected a text value for this field.')
        field.setText(edit.value)
      } else if (field instanceof PDFCheckBox) {
        if (typeof edit.value !== 'boolean') throw new Error('Expected a true/false value for this field.')
        if (edit.value) field.check()
        else field.uncheck()
      } else if (field instanceof PDFRadioGroup) {
        if (typeof edit.value !== 'string') throw new Error('Expected a single option name for this field.')
        field.select(edit.value)
      } else if (field instanceof PDFDropdown || field instanceof PDFOptionList) {
        if (typeof edit.value !== 'string' && !Array.isArray(edit.value)) {
          throw new Error('Expected an option name (or array of option names) for this field.')
        }
        field.select(edit.value)
      } else {
        throw new Error('This field type cannot be filled (e.g. a button or signature field).')
      }
      results.push({ name: edit.name, status: 'applied' })
    } catch (err) {
      results.push({ name: edit.name, status: 'failed', reason: err instanceof Error ? err.message : String(err) })
    }
  }

  // Regenerate appearance streams for every field whose value changed, so
  // the new values actually render in PDF viewers. The form itself is
  // untouched otherwise — no flatten() call, so it stays fillable.
  form.updateFieldAppearances()

  return { bytes: await pdfDoc.save(), results }
}
