import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Base is set to './' so the built app also works when hosted from a subfolder
// (e.g. GitHub Pages project pages). Everything runs client-side; no server.
//
// Two HTML entry points for one app: index.html (English, at the site root) and
// vi/index.html (Vietnamese, at /vi/). Both reference the same /src/main.tsx, so
// Rollup emits ONE shared JS/CSS bundle that both pages load — the only real
// difference between them is the crawler-visible <head> (lang/title/description/
// canonical/hreflang) and the initial i18n language, which is chosen from the
// URL path. See .claude/docs/decisions.md.
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
