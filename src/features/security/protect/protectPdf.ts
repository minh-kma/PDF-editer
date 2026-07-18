// Core "Protect PDF" (encrypt) logic — the D8 counterpart to
// shared/lib/pdfUnlock.ts's decrypt path. D19: logic-only for this work
// cycle — nothing here is wired into any UI yet; a future Security panel
// will call `protectPdf` directly once one exists.
//
// Encrypts an unencrypted PDF's bytes with a single user password via
// qpdf-wasm (AES-256), entirely in the browser. Per D8 there is no owner
// password / permissions layer: the owner password is set to the same
// value as the user password, so the file has exactly one secret and no
// separate "restricted vs. full access" mode to reason about — opening it
// anywhere (including this app's own unlock path) takes just that password.
//
// The qpdf-wasm invocation pattern here (dynamic import behind a
// code-split boundary, a fresh module instance per call because qpdf's
// callMain() exits the Emscripten runtime, FS.writeFile/readFile against
// the virtual filesystem) mirrors shared/lib/pdfUnlock.ts's decryptPdf —
// read that file first if this one is unclear. It is intentionally not
// shared/deduplicated with pdfUnlock.ts in this pass; that decrypt path is
// left untouched.
import qpdfWasmUrl from '@neslinesli93/qpdf-wasm/dist/qpdf.wasm?url'
import type { QpdfInstance } from '@neslinesli93/qpdf-wasm'
import { hasEncryptMarker } from '../../../shared/lib/pdfUnlock'

/** Thrown when the caller passes an empty or whitespace-only password. */
export class EmptyPasswordError extends Error {
  constructor() {
    super('Please enter a password.')
    this.name = 'EmptyPasswordError'
  }
}

/**
 * Thrown when the input PDF is already encrypted. Protecting it again would
 * either fail confusingly or silently nest encryption under a second
 * password, so we reject up front instead — the caller should offer
 * unlocking first (see pdfUnlock.ts) before protecting with a new password.
 */
export class AlreadyEncryptedError extends Error {
  constructor() {
    super('This PDF is already password-protected.')
    this.name = 'AlreadyEncryptedError'
  }
}

/** Thrown when qpdf fails to produce an encrypted output for any other reason. */
export class ProtectError extends Error {
  constructor(message = 'Could not protect this PDF.') {
    super(message)
    this.name = 'ProtectError'
  }
}

// Code-split behind this dynamic import, same as pdfUnlock.ts — it only
// loads when the user actually asks to protect a file.
type QpdfFactory = (opts: { locateFile: () => string }) => Promise<QpdfInstance>
let factoryPromise: Promise<QpdfFactory> | null = null
function loadFactory(): Promise<QpdfFactory> {
  if (!factoryPromise) {
    factoryPromise = import('@neslinesli93/qpdf-wasm').then((m) => m.default as unknown as QpdfFactory)
  }
  return factoryPromise
}

/**
 * Encrypt a PDF's bytes with a user-chosen password, entirely in the
 * browser. Rejects an empty/whitespace-only password and an
 * already-encrypted input up front; throws ProtectError if qpdf itself
 * fails to produce output.
 */
export async function protectPdf(sourceBytes: Uint8Array, password: string): Promise<Uint8Array> {
  if (password.trim().length === 0) throw new EmptyPasswordError()
  if (hasEncryptMarker(sourceBytes)) throw new AlreadyEncryptedError()

  const createModule = await loadFactory()
  // A fresh instance per attempt — qpdf calls exit() internally, which
  // leaves the Emscripten runtime unusable for a second run (see
  // pdfUnlock.ts's decryptPdf for the same constraint).
  const opts = { locateFile: () => qpdfWasmUrl, noInitialRun: true }
  const qpdf = (await createModule(opts as { locateFile: () => string })) as QpdfInstance & {
    FS: { writeFile: (path: string, data: Uint8Array) => void; readFile: (path: string) => Uint8Array }
  }

  const input = '/in.pdf'
  const output = '/out.pdf'
  qpdf.FS.writeFile(input, sourceBytes)
  try {
    // qpdf --encrypt user-password owner-password key-length -- infile outfile
    // Owner password == user password (D8: no separate owner/permissions
    // layer); key-length 256 selects AES-256 (qpdf's R6 handler), and no
    // restriction flags are passed, so the file carries no permission bits.
    qpdf.callMain(['--encrypt', password, password, '256', '--', input, output])
  } catch {
    // qpdf may exit() (Emscripten throws) — success is decided by the output.
  }

  let out: Uint8Array
  try {
    out = qpdf.FS.readFile(output)
  } catch {
    throw new ProtectError()
  }
  if (!out || out.length === 0) throw new ProtectError()
  return out.slice() // copy out of the wasm heap
}
