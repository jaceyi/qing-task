import { Box, CircularProgress } from '@mui/material'
import CheckOutlined from '@mui/icons-material/CheckOutlined'
import { AppProviders } from './context/AppProviders'
import { LoginScreen } from './components/LoginScreen'
import { useAuth } from './hooks/useAuth'
import { AppRoutes } from './routes'

function LoadingScreen() {
  return (
    <Box component="main" className="grid min-h-svh place-content-center justify-items-center gap-4 bg-base">
      <span className="grid size-[52px] place-items-center rounded-[15px] bg-primary text-white shadow-[0_6px_14px_rgba(99,117,215,0.2)]">
        <CheckOutlined />
      </span>
      <CircularProgress size={22} thickness={3} />
      <p className="text-xs text-muted">正在打开轻任务…</p>
    </Box>
  )
}

function App() {
  const demoMode = import.meta.env.DEV && new URLSearchParams(window.location.search).has('demo')
  const { user, loading: authLoading, error: authError, setError: setAuthError } = useAuth()

  if (authLoading && !demoMode) return <LoadingScreen />
  if (!user && !demoMode) {
    return <LoginScreen error={authError} onError={setAuthError} />
  }

  return (
    <AppProviders user={user} demoMode={demoMode}>
      <AppRoutes />
    </AppProviders>
  )
}

export default App
