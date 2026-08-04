import type { ReactNode } from 'react'
import { Button, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle } from '@mui/material'

interface ConfirmDialogProps {
  open: boolean
  title: string
  description?: string
  onClose: () => void
  onConfirm?: () => void
  confirmLabel?: string
  confirmColor?: 'primary' | 'error'
  confirmDisabled?: boolean
  cancelLabel?: string
  /** 追加在描述之后的内容（如输入框、附加操作按钮）。 */
  children?: ReactNode
  /** 追加在确认按钮之后的额外按钮。 */
  extraActions?: ReactNode
}

export function ConfirmDialog({
  open,
  title,
  description,
  onClose,
  onConfirm,
  confirmLabel = '确认',
  confirmColor = 'primary',
  confirmDisabled = false,
  cancelLabel = '取消',
  children,
  extraActions,
}: ConfirmDialogProps) {
  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth slotProps={{ paper: { role: 'alertdialog' } }}>
      <DialogTitle>{title}</DialogTitle>
      <DialogContent>
        {description && <DialogContentText>{description}</DialogContentText>}
        {children}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 3, pt: 1, gap: 1 }}>
        <Button onClick={onClose}>{cancelLabel}</Button>
        {extraActions}
        {onConfirm && (
          <Button variant="contained" color={confirmColor} disabled={confirmDisabled} onClick={onConfirm}>
            {confirmLabel}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  )
}
