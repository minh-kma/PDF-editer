import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { StoreProvider } from './shared/state/store'
// Side-effect import: initialises i18next before the first render. Resources
// are bundled and synchronous, so no provider or Suspense boundary is needed —
// initReactI18next registers the instance globally for useTranslation().
import './shared/i18n'
import './index.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <StoreProvider>
      <App />
    </StoreProvider>
  </StrictMode>,
)
