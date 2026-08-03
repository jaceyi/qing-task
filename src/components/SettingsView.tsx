import { useState } from 'react'
import { ArrowDown, ArrowUp, CheckCircle2, CircleAlert, Cloud, CloudOff, Download, Eye, HardDrive, LoaderCircle, LogOut, Pencil, Plus, Tags, Trash2, X } from 'lucide-react'
import type { PwaInstallState } from '../hooks/usePwaInstall'
import { cleanTagName, normalizeTagName, tagColors } from '../lib/tagLogic'
import type { SyncStatusPresentation } from '../lib/syncStatus'
import type { Tag, TagColor, Task, UserPreferences } from '../types'

interface SettingsViewProps {
  preferences: UserPreferences
  displayName: string
  email: string
  photoURL?: string | null
  installState: PwaInstallState
  syncStatus: SyncStatusPresentation
  onPreferencesChange: (next: UserPreferences) => Promise<void>
  onSignOut: () => Promise<void>
  onInstall: () => Promise<boolean>
  onNotify: (message: string) => void
  tags?: Tag[]
  tasks?: Task[]
  onCreateTag?: (name: string, color?: TagColor) => Promise<Tag>
  onUpdateTag?: (tagId: string, changes: { name?: string; color?: TagColor; sortOrder?: number }) => Promise<Tag>
  onDeleteTag?: (tagId: string) => Promise<number>
  onMergeTags?: (sourceId: string, targetId: string) => Promise<number>
}

const tagColorLabels: Record<TagColor, string> = {
  lavender: '薰衣草紫',
  mint: '薄荷绿',
  apricot: '杏桃橙',
  rose: '玫瑰粉',
  sky: '晴空蓝',
  amber: '琥珀黄',
  slate: '岩灰',
  indigo: '靛蓝',
}

export function SettingsView({
  preferences,
  displayName,
  email,
  photoURL,
  installState,
  syncStatus,
  onPreferencesChange,
  onSignOut,
  onInstall,
  onNotify,
  tags = [],
  tasks = [],
  onCreateTag,
  onUpdateTag,
  onDeleteTag,
  onMergeTags,
}: SettingsViewProps) {
  const [showInstallHelp, setShowInstallHelp] = useState(false)
  const [installing, setInstalling] = useState(false)
  const [newTagName, setNewTagName] = useState('')
  const [editingTagId, setEditingTagId] = useState<string | null>(null)
  const [editingName, setEditingName] = useState('')
  const [confirmDeleteTagId, setConfirmDeleteTagId] = useState<string | null>(null)
  const [mergeProposal, setMergeProposal] = useState<{ source: Tag; target: Tag } | null>(null)
  const [tagBusy, setTagBusy] = useState(false)
  const SyncIcon = syncStatus.kind === 'offline'
    ? CloudOff
    : syncStatus.kind === 'syncing'
      ? LoaderCircle
      : syncStatus.kind === 'error'
        ? CircleAlert
        : syncStatus.kind === 'local'
          ? HardDrive
          : CheckCircle2

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

  const createTag = async () => {
    if (!onCreateTag || !cleanTagName(newTagName)) return
    setTagBusy(true)
    try {
      const tag = await onCreateTag(newTagName)
      setNewTagName('')
      onNotify(`标签“${tag.name}”已创建`)
    } catch (reason) {
      onNotify(reason instanceof Error ? reason.message : '创建标签失败')
    } finally {
      setTagBusy(false)
    }
  }

  const saveTagName = async (tag: Tag) => {
    if (!onUpdateTag) return
    const name = cleanTagName(editingName)
    if (!name) return
    const target = tags.find((item) => item.id !== tag.id && item.normalizedName === normalizeTagName(name))
    if (target) {
      setMergeProposal({ source: tag, target })
      return
    }
    setTagBusy(true)
    try {
      await onUpdateTag(tag.id, { name })
      setEditingTagId(null)
      onNotify('标签名称已更新')
    } catch (reason) {
      onNotify(reason instanceof Error ? reason.message : '更新标签失败')
    } finally {
      setTagBusy(false)
    }
  }

  const moveTag = async (index: number, direction: -1 | 1) => {
    if (!onUpdateTag) return
    const current = tags[index]
    const target = tags[index + direction]
    if (!current || !target) return
    setTagBusy(true)
    try {
      await Promise.all([
        onUpdateTag(current.id, { sortOrder: target.sortOrder }),
        onUpdateTag(target.id, { sortOrder: current.sortOrder }),
      ])
      onNotify('标签顺序已更新')
    } catch (reason) {
      onNotify(reason instanceof Error ? reason.message : '更新标签顺序失败')
    } finally {
      setTagBusy(false)
    }
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

        <section className="settings-section tag-settings-section">
          <div className="settings-section-heading"><Tags /><div><h2>标签管理</h2><p>统一维护任务分类；删除标签不会删除任务。</p></div></div>
          <div className="tag-create-row">
            <input value={newTagName} maxLength={24} placeholder="新标签名称" aria-label="新标签名称" onChange={(event) => setNewTagName(event.target.value)} onKeyDown={(event) => {
              if (event.key === 'Enter') void createTag()
            }} />
            <button type="button" className="primary-button compact" disabled={tagBusy || !cleanTagName(newTagName)} onClick={() => void createTag()}><Plus />新建标签</button>
          </div>
          {tags.length === 0 ? (
            <div className="tag-empty-state"><Tags /><p>还没有标签。创建后即可在任务中选择。</p></div>
          ) : (
            <div className="tag-management-list">
              {tags.map((tag, index) => {
                const taskCount = tasks.filter((task) => task.tagIds?.includes(tag.id)).length
                const editing = editingTagId === tag.id
                const deleting = confirmDeleteTagId === tag.id
                return (
                  <div key={tag.id} className="tag-management-item">
                    <i className={`tag-color large is-${tag.color}`} />
                    <div className="tag-management-copy">
                      {editing ? <input autoFocus value={editingName} maxLength={24} aria-label={`重命名 ${tag.name}`} onChange={(event) => setEditingName(event.target.value)} onKeyDown={(event) => {
                        if (event.key === 'Enter') void saveTagName(tag)
                        if (event.key === 'Escape') setEditingTagId(null)
                      }} /> : <strong>{tag.name}</strong>}
                      <small>{taskCount} 个任务</small>
                    </div>
                    <select className="tag-color-select" aria-label={`${tag.name}的颜色`} value={tag.color} onChange={(event) => {
                      void onUpdateTag?.(tag.id, { color: event.target.value as TagColor }).catch((reason) => onNotify(reason instanceof Error ? reason.message : '更新标签颜色失败'))
                    }}>
                      {tagColors.map((color) => <option key={color} value={color}>{tagColorLabels[color]}</option>)}
                    </select>
                    <div className="tag-management-actions">
                      <button type="button" aria-label={`上移 ${tag.name}`} disabled={tagBusy || index === 0} onClick={() => void moveTag(index, -1)}><ArrowUp /></button>
                      <button type="button" aria-label={`下移 ${tag.name}`} disabled={tagBusy || index === tags.length - 1} onClick={() => void moveTag(index, 1)}><ArrowDown /></button>
                      {editing ? (
                        <>
                          <button type="button" aria-label="取消重命名" onClick={() => setEditingTagId(null)}><X /></button>
                          <button type="button" aria-label="保存标签名称" disabled={tagBusy} onClick={() => void saveTagName(tag)}><CheckCircle2 /></button>
                        </>
                      ) : (
                        <button type="button" aria-label={`重命名 ${tag.name}`} onClick={() => { setEditingTagId(tag.id); setEditingName(tag.name) }}><Pencil /></button>
                      )}
                      <button type="button" className="is-danger" aria-label={`删除 ${tag.name}`} onClick={() => setConfirmDeleteTagId(deleting ? null : tag.id)}><Trash2 /></button>
                    </div>
                    {deleting && (
                      <div className="tag-inline-confirm">
                        <span>从 {taskCount} 个任务中移除“{tag.name}”？任务本身会保留。</span>
                        <button type="button" className="text-button" onClick={() => setConfirmDeleteTagId(null)}>取消</button>
                        <button type="button" className="danger-button compact" onClick={async () => {
                          if (!onDeleteTag) return
                          setTagBusy(true)
                          try {
                            const affected = await onDeleteTag(tag.id)
                            setConfirmDeleteTagId(null)
                            onNotify(`标签已删除，${affected} 个任务已更新`)
                          } catch (reason) {
                            onNotify(reason instanceof Error ? reason.message : '删除标签失败')
                          } finally { setTagBusy(false) }
                        }}>确认删除</button>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
          {mergeProposal && (
            <div className="inline-confirm tag-merge-confirm" role="alert">
              <div><strong>合并标签？</strong><p>“{mergeProposal.source.name}”会合并到“{mergeProposal.target.name}”，所有任务引用会自动更新。</p></div>
              <div className="confirm-actions">
                <button type="button" className="text-button" onClick={() => setMergeProposal(null)}>取消</button>
                <button type="button" className="primary-button compact" onClick={async () => {
                  if (!onMergeTags) return
                  setTagBusy(true)
                  try {
                    const affected = await onMergeTags(mergeProposal.source.id, mergeProposal.target.id)
                    setMergeProposal(null)
                    setEditingTagId(null)
                    onNotify(`标签已合并，${affected} 个任务已更新`)
                  } catch (reason) {
                    onNotify(reason instanceof Error ? reason.message : '合并标签失败')
                  } finally { setTagBusy(false) }
                }}>确认合并</button>
              </div>
            </div>
          )}
        </section>

        <section className="settings-section">
          <div className="settings-section-heading"><Cloud /><div><h2>账号与同步</h2><p>{syncStatus.detail}</p></div></div>
          <div className="account-card">
            <span className="avatar large">
              {photoURL ? <img src={photoURL} alt="" referrerPolicy="no-referrer" /> : displayName.slice(0, 1)}
            </span>
            <span><strong>{displayName}</strong><small>{email}</small></span>
            <span className={`cloud-badge is-${syncStatus.kind}`} role="status"><SyncIcon /> {syncStatus.title}</span>
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
              <strong>浏览器暂未开放快捷安装</strong>
              <p>Chrome / Edge 会按当前域名单独判断：先浏览至少 30 秒并点击页面一次，再刷新页面；也可以直接从浏览器菜单选择“安装应用”。</p>
              <p>iPhone / iPad：使用 Safari 打开，点击“分享”，再选择“添加到主屏幕”。</p>
            </div>
          )}
        </section>
      </div>
    </section>
  )
}
