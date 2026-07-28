import { CheckCircle2, Download, RefreshCw, X } from 'lucide-react'
import { useRegisterSW } from 'virtual:pwa-register/react'

export function PwaPrompt() {
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
        <p>{needRefresh ? '更新后即可使用最新功能。' : '应用外壳已保存到这台设备。'}</p>
      </div>
      {needRefresh && (
        <button type="button" onClick={() => void updateServiceWorker(true)}><Download /> 更新</button>
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
