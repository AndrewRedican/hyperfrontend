// <hf:feature> — managed by @hyperfrontend/features; safe to keep
import './hyperfrontend.feature'
// </hf:feature>

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import './styles/feature.css'

const container = document.getElementById('root')
if (container === null) {
  throw new Error('missing #root container')
}
createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>
)
