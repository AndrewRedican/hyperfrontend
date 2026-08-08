import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App'
import './styles/fish.css'

const root = document.querySelector('#app')
// why: Vite's HTML entry always carries the mount point, but the type says it might not, and a hard failure here is easier to read than a silent blank frame.
if (root === null) {
  throw new Error('the koi has nowhere to swim: #app is missing from the document')
}

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>
)
