import { BrowserRouter } from 'react-router-dom'
import { NavBar } from './components/NavBar'
import { ToastProvider } from './components/Toast'
import { AuthProvider } from './lib/auth'
import { AppRoutes } from './router'

export default function App() {
  return (
    <BrowserRouter>
      <ToastProvider>
        <AuthProvider>
          <NavBar />
          <main className="mx-auto max-w-6xl px-4 py-8">
            <AppRoutes />
          </main>
        </AuthProvider>
      </ToastProvider>
    </BrowserRouter>
  )
}
