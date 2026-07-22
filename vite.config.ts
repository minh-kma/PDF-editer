import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Base is set to './' so the built app also works when hosted from a subfolder
// (e.g. GitHub Pages project pages). Everything runs client-side; no server.
//
// Ten HTML entry points for one app: the homepage in each language (index.html,
// vi/index.html) plus one page per routed tool in each language. Every one of
// them references the same /src/main.tsx, so Rollup emits ONE shared JS/CSS
// bundle that all pages load — the only real difference between them is the
// crawler-visible <head> (lang/title/description/canonical/hreflang) and the
// starting state, which is read from the URL path (src/shared/lib/routes.ts).
//
// Only four tools have URLs so far; adding another means adding its two HTML
// files here AND its slug to ROUTED_TOOLS in routes.ts. See decisions.md.
export default defineConfig({
  plugins: [react()],
  base: './',
  build: {
    rollupOptions: {
      // Relative to the project root; avoids needing @types/node in the config
      // typecheck for __dirname / node:path.
      input: {
        main: 'index.html',
        vi: 'vi/index.html',
        merge: 'merge-pdf/index.html',
        mergeVi: 'vi/merge-pdf/index.html',
        split: 'split-pdf/index.html',
        splitVi: 'vi/split-pdf/index.html',
        compress: 'compress-pdf/index.html',
        compressVi: 'vi/compress-pdf/index.html',
        imagesToPdf: 'images-to-pdf/index.html',
        imagesToPdfVi: 'vi/images-to-pdf/index.html',
      },
    },
  },
})

// import { defineConfig } from 'vite'

// export default defineConfig({
//   server: {
//     host: true,
//     allowedHosts: true
//   }
// })
