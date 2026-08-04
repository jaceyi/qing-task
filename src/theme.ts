import { createTheme } from '@mui/material/styles'
import type {} from '@mui/x-date-pickers/themeAugmentation'

const colors = {
  base: '#f8f8fc',
  surface: '#ffffff',
  ink: '#37364a',
  muted: '#8c8b9e',
  line: '#e7e6ef',
  primary: '#7d8de1',
  primaryStrong: '#6375d7',
  primarySoft: '#eeedfb',
  danger: '#c95461',
  dangerSoft: '#fff0f2',
}

export const appTheme = createTheme({
  cssVariables: true,
  palette: {
    mode: 'light',
    primary: { main: colors.primary, dark: colors.primaryStrong, light: colors.primarySoft },
    error: { main: colors.danger, light: colors.dangerSoft },
    background: { default: colors.base, paper: colors.surface },
    text: { primary: colors.ink, secondary: colors.muted },
    divider: colors.line,
  },
  shape: { borderRadius: 10 },
  typography: {
    fontFamily: 'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", "PingFang SC", "Microsoft YaHei", sans-serif',
    button: { textTransform: 'none', fontWeight: 600 },
  },
  components: {
    // 只配置默认 props 与结构预设，不重写视觉样式：
    // 所有表单控件统一 small 尺寸（40px 高），label 定位交给 MUI 默认算法。
    MuiButtonBase: {
      defaultProps: { disableRipple: true },
    },
    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          // 鼠标悬停时用主题色描边（默认是接近黑色的 text.primary）。
          '&:not(.Mui-focused):hover .MuiOutlinedInput-notchedOutline': {
            borderColor: colors.primary,
          },
        },
      },
    },
    MuiButton: {
      defaultProps: { disableElevation: true },
    },
    MuiIconButton: {
      defaultProps: { size: 'small' },
    },
    MuiTextField: {
      defaultProps: { size: 'small', variant: 'outlined' },
    },
    MuiSelect: {
      defaultProps: { size: 'small' },
    },
    MuiAutocomplete: {
      defaultProps: { size: 'small' },
    },
    MuiPickersTextField: {
      defaultProps: { size: 'small', fullWidth: true },
    },
    MuiDateTimePicker: {
      defaultProps: { ampm: false, format: 'YYYY/MM/DD HH:mm' },
    },
    MuiDatePicker: {
      defaultProps: { format: 'YYYY/MM/DD' },
    },
    MuiTimePicker: {
      defaultProps: { ampm: false, format: 'HH:mm' },
    },
  },
})
