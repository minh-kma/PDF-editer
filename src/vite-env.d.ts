/// <reference types="vite/client" />

// qpdf-wasm is loaded as a static asset URL (bundled by Vite, not fetched from
// a CDN) so the app stays fully offline-capable.
declare module '*.wasm?url' {
  const src: string
  export default src
}
