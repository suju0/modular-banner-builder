import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import { installAutoHideScrollbars } from './lib/autoHideScrollbar.js'
import './styles/globals.css'

// 스크롤바는 스크롤하는 동안에만 보인다 — 리스너 하나로 전부 처리한다
installAutoHideScrollbars()

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
