import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { hydrateLanguage } from './state/lang'
import { hydrateConfigFromUrl, startUrlSync } from './state/urlConfig'

// Before the first render, not in an effect. A shared link that painted the default
// carmine car and then repainted it would flash on exactly the load that matters, and
// an Arabic browser that rendered the English UI and then flipped it would do worse —
// the whole layout mirrors.
hydrateLanguage()
hydrateConfigFromUrl()
startUrlSync()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
