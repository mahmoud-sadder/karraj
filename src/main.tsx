import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { hydrateConfigFromUrl, startUrlSync } from './state/urlConfig'

// Before the first render, not in an effect: a shared link that painted the default
// carmine car and then repainted it would flash on exactly the load that matters.
hydrateConfigFromUrl()
startUrlSync()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
