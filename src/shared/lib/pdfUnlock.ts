// Shared password-unlock step for the file-load pipeline (decision D8).
//
// If a file is encrypted we decrypt it in-browser with qpdf-wasm and feed the
// PLAINTEXT bytes into the store — so every downstream op (loadSources, build,
// split, compress, autosave) stays oblivious to encryption. Nothing leaves the
// device.
//
// Detection: pdf.js is authoritative for user-password files (it raises a
// PasswordException). Owner-only / permissions-only files open silently in
// pdf.js, so we additionally scan the bytes for the `/Encrypt` trailer marker —
// pdf-lib is NOT used to detect encryption (it throws generic parse errors on
// encrypted files rather than a clean encrypted signal).
// The .wasm is emitted as a static, hashed asset served by the app itself
// (never a CDN), keeping the build offline-capable. It's a separate file, only
// fetched when a protected PDF is actually opened.
import qpdfWasmUrl from '@neslinesli93/qpdf-wasm/dist/qpdf.wasm?url'
import type { QpdfInstance } from '@neslinesli93/qpdf-wasm'
import { openPdf } from './pdfjs'

export type ProbeResult =
  | { status: 'ok'; pageCount: number }
  | { status: 'encrypted' }
  | { status: 'damaged' }

// The trailer key `/Encrypt` is always plaintext ASCII even in an encrypted
// file (you need it to locate the Encrypt dict), so scanning the raw bytes
// reliably flags encryption — including owner-only files pdf.js opens silently.
const ENCRYPT_MARKER = [0x2f, 0x45, 0x6e, 0x63, 0x72, 0x79, 0x70, 0x74] // "/Encrypt"

export function hasEncryptMarker(bytes: Uint8Array): boolean {
  outer: for (let i = 0; i + ENCRYPT_MARKER.length <= bytes.length; i++) {
    for (let j = 0; j < ENCRYPT_MARKER.length; j++) {
      if (bytes[i + j] !== ENCRYPT_MARKER[j]) continue outer
    }
    return true
  }
  return false
}

/**
 * Classify a PDF: usable (with page count), encrypted (needs decrypting), or
 * damaged. Encrypted covers BOTH user-password and owner-only files — the
 * caller decides whether a prompt is needed.
 */
export async function probePdf(bytes: Uint8Array): Promise<ProbeResult> {
  const opened = await openPdf(bytes)
  if (opened.status === 'needsPassword') return { status: 'encrypted' } // user password
  if (opened.status === 'error') return { status: 'damaged' }
  // pdf.js opened it without a password — but it may be owner-only encrypted.
  if (hasEncryptMarker(bytes)) return { status: 'encrypted' }
  return { status: 'ok', pageCount: opened.pageCount }
}

/** Thrown when qpdf can't unlock the file with the supplied password. */
export class WrongPasswordError extends Error {
  constructor() {
    super('Incorrect password.')
    this.name = 'WrongPasswordError'
  }
}

// The qpdf glue JS (and, on first use, the wasm) is code-split behind this
// dynamic import — it only loads when a protected file is encountered.
type QpdfFactory = (opts: { locateFile: () => string }) => Promise<QpdfInstance>
let factoryPromise: Promise<QpdfFactory> | null = null
function loadFactory(): Promise<QpdfFactory> {
  if (!factoryPromise) {
    factoryPromise = import('@neslinesli93/qpdf-wasm').then((m) => m.default as unknown as QpdfFactory)
  }
  return factoryPromise
}

/**
 * Decrypt a password-protected PDF entirely in the browser, returning the
 * plaintext bytes. An empty password unlocks owner-only / permissions-only
 * files (which have no user password). Throws WrongPasswordError if the
 * password doesn't unlock the file.
 */
export async function decryptPdf(bytes: Uint8Array, password: string): Promise<Uint8Array> {
  const createModule = await loadFactory()
  // A fresh instance per attempt — qpdf calls exit() internally, which leaves
  // the Emscripten runtime unusable for a second run.
  const opts = { locateFile: () => qpdfWasmUrl, noInitialRun: true }
  const qpdf = (await createModule(opts as { locateFile: () => string })) as QpdfInstance & {
    FS: { writeFile: (path: string, data: Uint8Array) => void; readFile: (path: string) => Uint8Array }
  }

  const input = '/in.pdf'
  const output = '/out.pdf'
  qpdf.FS.writeFile(input, bytes)
  try {
    // qpdf [options] infile outfile
    qpdf.callMain(['--decrypt', `--password=${password}`, input, output])
  } catch {
    // qpdf may exit() (Emscripten throws) — success is decided by the output.
  }

  let out: Uint8Array
  try {
    out = qpdf.FS.readFile(output)
  } catch {
    throw new WrongPasswordError()
  }
  if (!out || out.length === 0) throw new WrongPasswordError()
  return out.slice() // copy out of the wasm heap
}
