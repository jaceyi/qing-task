import type { CSSProperties, ReactNode } from 'react'
import { FormLabel, type SxProps, type Theme } from '@mui/material'

const base = {
  display: 'flex',
  alignItems: 'center',
  gap: 6,
  fontSize: 12,
  fontWeight: 600,
  lineHeight: 1.4,
} satisfies CSSProperties

interface FieldLabelProps {
  children: ReactNode
  /** 追加的 sx 覆盖项，如 { mb: 1 } */
  sx?: SxProps<Theme>
  component?: React.ElementType
}

/** 表单区块图例：统一为紧凑的小号文字（默认 FormLabel 偏大）。 */
export function FieldLabel({ children, sx, component = 'legend' }: FieldLabelProps) {
  return (
    <FormLabel component={component} sx={{ ...base, ...(sx as object | undefined) } as SxProps<Theme>}>
      {children}
    </FormLabel>
  )
}
