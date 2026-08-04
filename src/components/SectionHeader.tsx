import type { ReactNode } from 'react'
import { Box, Stack, Typography } from '@mui/material'

interface SectionHeaderProps {
  icon?: ReactNode
  title: string
  caption?: string
  tone?: 'default' | 'danger'
}

export function SectionHeader({ icon, title, caption, tone = 'default' }: SectionHeaderProps) {
  return (
    <Stack direction="row" spacing={1.25} sx={{ alignItems: 'center' }}>
      {icon && <Box sx={{ display: 'grid', color: tone === 'danger' ? 'error.main' : 'primary.main' }}>{icon}</Box>}
      <Box>
        <Typography component="h2" sx={{ fontSize: 14, fontWeight: 750 }}>{title}</Typography>
        {caption && <Typography variant="caption">{caption}</Typography>}
      </Box>
    </Stack>
  )
}
