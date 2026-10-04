import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { ReactLenis } from 'lenis/react'
import App from './App'
import 'lenis/dist/lenis.css'
import './index.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {/* allowNestedScroll: wheel/touch over any inner scroll area (tables, lists, code) scrolls that area, not the page */}
    <ReactLenis root options={{ lerp: 0.12, allowNestedScroll: true }} />
    <App />
  </StrictMode>,
)
