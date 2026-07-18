import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'
import { setBaseUrl } from '@workspace/api-zod'

// Strictly point to your unique live Render Backend application URL
setBaseUrl("https://sports-bet-hub.onrender.com");

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
