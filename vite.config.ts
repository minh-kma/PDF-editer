// import { defineConfig } from 'vite'
// import react from '@vitejs/plugin-react'

// // Base is set to './' so the built app also works when hosted from a subfolder
// // (e.g. GitHub Pages project pages). Everything runs client-side; no server.
// export default defineConfig({
//   plugins: [react()],
//   base: './',
// })

import { defineConfig } from 'vite'

export default defineConfig({
  server: {
    host: true,
    allowedHosts: true
  }
})