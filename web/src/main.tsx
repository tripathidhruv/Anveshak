import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { ReactLenis } from 'lenis/react'
import App from './App'
import { applyTheme, initialTheme, ThemeProvider } from './app/theme'
import 'lenis/dist/lenis.css'
import './index.css'

// set the theme before the first paint so there's no flash of the wrong palette
applyTheme(initialTheme())

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {/* allowNestedScroll: wheel/touch over any inner scroll area (tables, lists, code) scrolls that area, not the page */}
    <ReactLenis root options={{ lerp: 0.12, allowNestedScroll: true }} />
    <ThemeProvider>
      <App />
    </ThemeProvider>
  </StrictMode>,
)
