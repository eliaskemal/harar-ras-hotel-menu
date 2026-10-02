import { useState } from 'react'
import CustomerMenu from './pages/CustomerMenu'
import Admin from './pages/Admin'

export default function App() {
  const [route] = useState(() => window.location.pathname)

  if (route.startsWith('/admin')) return <Admin />
  return <CustomerMenu />
}