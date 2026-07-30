import { CheckCircle2, Download, RefreshCw, X } from 'lucide-react'
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
    <div className="pwa-prompt" role="status">
      <span className="pwa-icon">{needRefresh ? <RefreshCw /> : <CheckCircle2 />}</span>
      <div>
        <strong>{needRefresh ? '有新版本可用' : '已经可以离线打开'}</strong>
        <p>{needRefresh ? deferUpdate ? '完成当前编辑后即可安全更新。' : '更新后即可使用最新功能。' : '应用外壳已保存到这台设备。'}</p>
      </div>
      {needRefresh && (
        <button type="button" disabled={deferUpdate} onClick={() => void updateServiceWorker(true)}><Download /> {deferUpdate ? '编辑完成后更新' : '更新'}</button>
      )}
      <button
        type="button"
        className="icon-button"
        aria-label="关闭提示"
        onClick={() => {
          setOfflineReady(false)
          setNeedRefresh(false)
        }}
      ><X /></button>
    </div>
  )
}
