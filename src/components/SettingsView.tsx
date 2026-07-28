import { Cloud, Download, Eye, LogOut, ShieldCheck } from 'lucide-react'
import type { UserPreferences } from '../types'

interface SettingsViewProps {
  preferences: UserPreferences
  displayName: string
  email: string
  photoURL?: string | null
  onPreferencesChange: (next: UserPreferences) => Promise<void>
  onSignOut: () => Promise<void>
}

export function SettingsView({
  preferences,
  displayName,
  email,
  photoURL,
  onPreferencesChange,
  onSignOut,
}: SettingsViewProps) {
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
            <span><strong>隐藏已完成任务</strong><small>开启后，完成任务仍保存在云端和全部任务中。</small></span>
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
          <div className="settings-section-heading"><Download /><div><h2>安装到设备</h2><p>可从浏览器菜单将轻任务安装为独立应用。</p></div></div>
          <p className="muted-copy">安装后可从桌面或主屏幕打开，并在网络不稳定时继续访问应用界面。</p>
        </section>
      </div>
    </section>
  )
}
