import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'
import { setBaseUrl } from '@workspace/api-zod'

// Strictly point to your live Render Backend URL so Vercel can talk to it
setBaseUrl("https://onrender.com");

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
