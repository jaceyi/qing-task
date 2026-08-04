import { Alert, Button, IconButton, Snackbar } from '@mui/material'
import CheckCircleOutlineOutlined from '@mui/icons-material/CheckCircleOutlineOutlined'
import CloseOutlined from '@mui/icons-material/CloseOutlined'
import DownloadOutlined from '@mui/icons-material/DownloadOutlined'
import RefreshOutlined from '@mui/icons-material/RefreshOutlined'
import { useRegisterSW } from 'virtual:pwa-register/react'

interface PwaPromptProps {
  deferUpdate?: boolean
}

export function PwaPrompt({ deferUpdate = false }: PwaPromptProps) {
  const {
    offlineReady: [offlineReady, setOfflineReady],
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW()

  if (!offlineReady && !needRefresh) return null

  return (
    <Snackbar open anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}>
      <Alert
        severity={needRefresh ? 'info' : 'success'}
        icon={needRefresh ? <RefreshOutlined /> : <CheckCircleOutlineOutlined />}
        action={<>
          {needRefresh && <Button disabled={deferUpdate} startIcon={<DownloadOutlined />} onClick={() => void updateServiceWorker(true)}>{deferUpdate ? '编辑完成后更新' : '更新'}</Button>}
          <IconButton aria-label="关闭提示" onClick={() => { setOfflineReady(false); setNeedRefresh(false) }}><CloseOutlined /></IconButton>
        </>}
      >
        <strong>{needRefresh ? '有新版本可用' : '已经可以离线打开'}</strong><br />
        {needRefresh ? deferUpdate ? '完成当前编辑后即可安全更新。' : '更新后即可使用最新功能。' : '应用外壳已保存到这台设备。'}
      </Alert>
    </Snackbar>
  )
}
