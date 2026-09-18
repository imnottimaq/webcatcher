import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App'
import { SkinProvider } from './contexts/skinContext'
import { BeatmapProvider } from './contexts/beatmapContext'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <SkinProvider>
      <BeatmapProvider>
        <App />
      </BeatmapProvider>
    </SkinProvider>
  </StrictMode>,
)