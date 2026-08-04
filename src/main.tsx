import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router'
import { CssBaseline, GlobalStyles, ThemeProvider } from '@mui/material'
import { StyledEngineProvider } from '@mui/material/styles'
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider'
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs'
import { zhCN } from '@mui/x-date-pickers/locales'
import 'dayjs/locale/zh-cn'
import './index.css'
import App from './App.tsx'
import { appTheme } from './theme'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <StyledEngineProvider enableCssLayer>
      <GlobalStyles styles="@layer theme, base, mui, components, utilities;" />
      <ThemeProvider theme={appTheme}>
        <CssBaseline />
        <LocalizationProvider
          dateAdapter={AdapterDayjs}
          adapterLocale="zh-cn"
          localeText={zhCN.components.MuiLocalizationProvider.defaultProps.localeText}
        >
          <BrowserRouter>
            <App />
          </BrowserRouter>
        </LocalizationProvider>
      </ThemeProvider>
    </StyledEngineProvider>
  </StrictMode>,
)
