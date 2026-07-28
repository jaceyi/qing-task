import { useState } from 'react'
import { CheckCircle2, Cloud, Download, Eye, LogOut, ShieldCheck } from 'lucide-react'
import type { PwaInstallState } from '../hooks/usePwaInstall'
import type { UserPreferences } from '../types'

interface SettingsViewProps {
  preferences: UserPreferences
  displayName: string
  email: string
  photoURL?: string | null
  installState: PwaInstallState
  onPreferencesChange: (next: UserPreferences) => Promise<void>
  onSignOut: () => Promise<void>
  onInstall: () => Promise<boolean>
  onNotify: (message: string) => void
}

export function SettingsView({
  preferences,
  displayName,
  email,
  photoURL,
  installState,
  onPreferencesChange,
  onSignOut,
  onInstall,
  onNotify,
}: SettingsViewProps) {
  const [showInstallHelp, setShowInstallHelp] = useState(false)
  const [installing, setInstalling] = useState(false)

  const handleInstall = async () => {
    if (installState === 'installed') return
    if (installState === 'manual') {
      setShowInstallHelp((shown) => !shown)
      return
    }
    setInstalling(true)
    const accepted = await onInstall()
    setInstalling(false)
    onNotify(accepted ? '轻任务已加入设备' : '已取消安装')
  }

  return (
    <section className="settings-view" aria-labelledby="settings-title">
      <header className="view-heading">
        <span className="eyebrow">偏好与账号</span>
        <h1 id="settings-title">设置</h1>
      </header>

      <div className="settings-layout">
        <section className="settings-section">
          <div className="settings-section-heading"><Eye /><div><h2>任务显示</h2><p>控制看板中的完成态。</p></div></div>
          <label className="setting-row">
            <span><strong>隐藏已完成任务</strong><small>只隐藏显示，不会删除任务，可随时重新开启。</small></span>
            <input
              type="checkbox"
              role="switch"
              checked={preferences.hideCompleted}
              onChange={(event) => void onPreferencesChange({ hideCompleted: event.target.checked })}
            />
          </label>
        </section>

        <section className="settings-section">
          <div className="settings-section-heading"><Cloud /><div><h2>账号与同步</h2><p>任务按照 Google 账号独立保存。</p></div></div>
          <div className="account-card">
            <span className="avatar large">
              {photoURL ? <img src={photoURL} alt="" referrerPolicy="no-referrer" /> : displayName.slice(0, 1)}
            </span>
            <span><strong>{displayName}</strong><small>{email}</small></span>
            <span className="cloud-badge"><ShieldCheck /> 已安全同步</span>
          </div>
          <button type="button" className="secondary-button" onClick={() => void onSignOut()}><LogOut /> 退出登录</button>
        </section>

        <section className="settings-section install-section">
          <div className="settings-section-heading"><Download /><div><h2>安装到设备</h2><p>像原生应用一样从桌面或主屏幕打开。</p></div></div>
          <p className="muted-copy">安装后拥有独立窗口和应用图标，网络不稳定时仍可打开应用界面。</p>
          <button
            type="button"
            className={installState === 'available' ? 'primary-button install-button' : 'secondary-button install-button'}
            disabled={installState === 'installed' || installing}
            onClick={() => void handleInstall()}
          >
            {installState === 'installed' ? <CheckCircle2 /> : <Download />}
            {installState === 'installed'
              ? '已安装到设备'
              : installing
                ? '正在打开安装…'
                : installState === 'available'
                  ? '安装轻任务'
                  : showInstallHelp
                    ? '收起安装方法'
                    : '查看安装方法'}
          </button>
          {showInstallHelp && installState === 'manual' && (
            <div className="install-help" role="status">
              <strong>通过浏览器完成安装</strong>
              <p>iPhone / iPad：使用 Safari 打开，点击“分享”，再选择“添加到主屏幕”。</p>
              <p>Android / 电脑：打开浏览器菜单，选择“安装应用”或“添加到主屏幕”。</p>
            </div>
          )}
        </section>
      </div>
    </section>
  )
}
