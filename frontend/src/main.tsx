import { StrictMode } from 'react'
import * as React from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App'
import AdminApp from './admin/AdminApp'
import './styles/index.css'

function RootRouter() {
  const [admin, setAdmin] = React.useState(() => window.location.hash.startsWith('#/admin'))
  React.useEffect(() => { const update = () => setAdmin(window.location.hash.startsWith('#/admin')); window.addEventListener('hashchange', update); return () => window.removeEventListener('hashchange', update) }, [])
  return admin ? <AdminApp /> : <App />
}
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <RootRouter />
  </StrictMode>,
)
