import { useState } from 'react'
import {
  Avatar,
  Box,
  Button,
  IconButton,
  MenuItem,
  Paper,
  Stack,
  Switch,
  TextField,
  Typography,
} from '@mui/material'
import AddOutlined from '@mui/icons-material/AddOutlined'
import ArrowDownwardOutlined from '@mui/icons-material/ArrowDownwardOutlined'
import ArrowUpwardOutlined from '@mui/icons-material/ArrowUpwardOutlined'
import CheckCircleOutlineOutlined from '@mui/icons-material/CheckCircleOutlineOutlined'
import CloudDoneOutlined from '@mui/icons-material/CloudDoneOutlined'
import CloudOffOutlined from '@mui/icons-material/CloudOffOutlined'
import DeleteOutlineOutlined from '@mui/icons-material/DeleteOutlineOutlined'
import DownloadOutlined from '@mui/icons-material/DownloadOutlined'
import EditOutlined from '@mui/icons-material/EditOutlined'
import ErrorOutlineOutlined from '@mui/icons-material/ErrorOutlineOutlined'
import LabelOutlined from '@mui/icons-material/LabelOutlined'
import LogoutOutlined from '@mui/icons-material/LogoutOutlined'
import StorageOutlined from '@mui/icons-material/StorageOutlined'
import VisibilityOutlined from '@mui/icons-material/VisibilityOutlined'
import type { PwaInstallState } from '../hooks/usePwaInstall'
import { cleanTagName, normalizeTagName, tagColors } from '../lib/tagLogic'
import type { SyncStatusKind, SyncStatusPresentation } from '../lib/syncStatus'
import type { Tag, TagColor, Task, UserPreferences } from '../types'
import { ConfirmDialog } from './ConfirmDialog'
import { SectionHeader } from './SectionHeader'

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

const toneClasses = {
  neutral: 'bg-fill text-muted',
  primary: 'bg-primary-soft text-primary-strong',
  success: 'bg-mint-soft text-mint-strong',
  warning: 'bg-apricot-soft text-apricot-strong',
  error: 'bg-danger-soft text-danger',
} as const

const syncTones: Record<SyncStatusKind, keyof typeof toneClasses> = {
  synced: 'success',
  syncing: 'primary',
  offline: 'warning',
  error: 'error',
  local: 'neutral',
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
    ? CloudOffOutlined
    : syncStatus.kind === 'syncing'
      ? CloudDoneOutlined
      : syncStatus.kind === 'error'
        ? ErrorOutlineOutlined
        : syncStatus.kind === 'local'
          ? StorageOutlined
          : CheckCircleOutlineOutlined

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

  const deletingTag = tags.find((tag) => tag.id === confirmDeleteTagId)

  return (
    <Box component="section" className="mx-auto w-full max-w-[1120px]" aria-labelledby="settings-title">
      <Box component="header" className="mb-6 min-h-[60px] max-md:sr-only">
        <Typography className="inline-flex items-center gap-1.5 font-bold tracking-[0.08em] text-primary-strong uppercase" variant="caption">偏好与账号</Typography>
        <Typography id="settings-title" component="h1" className="text-[clamp(22px,2vw,26px)] leading-[1.18] tracking-[-0.035em] text-ink">设置</Typography>
      </Box>

      <Box className="grid gap-4 md:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
        <Paper component="section" variant="outlined" className="p-6 max-md:p-5 md:col-span-2">
          <SectionHeader icon={<VisibilityOutlined />} title="任务显示" caption="控制看板中的完成态。" />
          <Stack direction="row" sx={{ mt: 2, alignItems: 'center', justifyContent: 'space-between', gap: 2 }}>
            <Box><Typography variant="body2" sx={{ fontWeight: 700 }}>隐藏已完成任务</Typography><Typography variant="caption">只隐藏显示，不会删除任务，可随时重新开启。</Typography></Box>
            <Switch checked={preferences.hideCompleted} onChange={(event) => void onPreferencesChange({ hideCompleted: event.target.checked })} slotProps={{ input: { 'aria-label': '隐藏已完成任务' } }} />
          </Stack>
        </Paper>

        <Paper component="section" variant="outlined" className="p-6 max-md:p-5 md:row-span-2">
          <SectionHeader icon={<LabelOutlined />} title="标签管理" caption="统一维护任务分类；删除标签不会删除任务。" />
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ mt: 2, mb: 2, alignItems: { sm: 'flex-start' } }}>
            <TextField fullWidth label="新标签名称" value={newTagName} onChange={(event) => setNewTagName(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') void createTag() }} slotProps={{ htmlInput: { maxLength: 24 } }} />
            <Button variant="contained" startIcon={<AddOutlined />} disabled={tagBusy || !cleanTagName(newTagName)} onClick={() => void createTag()} sx={{ whiteSpace: 'nowrap', minHeight: 40, flexShrink: 0 }}>新建标签</Button>
          </Stack>
          {tags.length === 0 ? <Typography variant="body2" color="text.secondary">还没有标签。创建后即可在任务中选择。</Typography> : (
            <Stack spacing={1}>
              {tags.map((tag, index) => {
                const taskCount = tasks.filter((task) => task.tagIds?.includes(tag.id)).length
                const editing = editingTagId === tag.id
                return (
                  <Paper key={tag.id} variant="outlined" sx={{ p: 1, display: 'grid', gridTemplateColumns: { xs: 'auto 1fr', sm: 'auto minmax(120px,1fr) 150px auto' }, gap: 1, alignItems: 'center' }}>
                    <Box component="i" className={`tag-color large is-${tag.color}`} />
                    <Box>
                      {editing ? <TextField autoFocus value={editingName} onChange={(event) => setEditingName(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') void saveTagName(tag); if (event.key === 'Escape') setEditingTagId(null) }} slotProps={{ htmlInput: { maxLength: 24, 'aria-label': `重命名 ${tag.name}` } }} /> : <Typography variant="body2" sx={{ fontWeight: 700 }}>{tag.name}</Typography>}
                      <Typography variant="caption">{taskCount} 个任务</Typography>
                    </Box>
                    <TextField select label="颜色" value={tag.color} onChange={(event) => void onUpdateTag?.(tag.id, { color: event.target.value as TagColor }).catch((reason) => onNotify(reason instanceof Error ? reason.message : '更新标签颜色失败'))} sx={{ gridColumn: { xs: '1 / -1', sm: 'auto' } }}>
                      {tagColors.map((color) => <MenuItem key={color} value={color}>{tagColorLabels[color]}</MenuItem>)}
                    </TextField>
                    <Stack direction="row" spacing={0.25} sx={{ gridColumn: { xs: '1 / -1', sm: 'auto' }, justifyContent: 'flex-end' }}>
                      <IconButton aria-label={`上移 ${tag.name}`} disabled={tagBusy || index === 0} onClick={() => void moveTag(index, -1)}><ArrowUpwardOutlined /></IconButton>
                      <IconButton aria-label={`下移 ${tag.name}`} disabled={tagBusy || index === tags.length - 1} onClick={() => void moveTag(index, 1)}><ArrowDownwardOutlined /></IconButton>
                      {editing ? <IconButton aria-label="保存标签名称" disabled={tagBusy} onClick={() => void saveTagName(tag)}><CheckCircleOutlineOutlined /></IconButton> : <IconButton aria-label={`重命名 ${tag.name}`} onClick={() => { setEditingTagId(tag.id); setEditingName(tag.name) }}><EditOutlined /></IconButton>}
                      <IconButton color="error" aria-label={`删除 ${tag.name}`} onClick={() => setConfirmDeleteTagId(tag.id)}><DeleteOutlineOutlined /></IconButton>
                    </Stack>
                  </Paper>
                )
              })}
            </Stack>
          )}
        </Paper>

        <Paper component="section" variant="outlined" className="p-6 max-md:p-5">
          <SectionHeader icon={<CloudDoneOutlined />} title="账号与同步" caption={syncStatus.detail} />
          <Stack direction="row" spacing={1.25} sx={{ mt: 2, mb: 2, alignItems: 'center' }}>
            <Avatar src={photoURL ?? undefined}>{displayName.slice(0, 1)}</Avatar>
            <Box sx={{ flex: 1, minWidth: 0 }}><Typography variant="body2" noWrap sx={{ fontWeight: 750 }}>{displayName}</Typography><Typography variant="caption" noWrap>{email}</Typography></Box>
            <span className={`inline-flex h-6 shrink-0 items-center gap-1.5 rounded-full px-2.5 text-[11px] font-semibold whitespace-nowrap ${toneClasses[syncTones[syncStatus.kind]]}`}><SyncIcon sx={{ fontSize: 14 }} />{syncStatus.title}</span>
          </Stack>
          <Button variant="outlined" startIcon={<LogoutOutlined />} onClick={() => void onSignOut()}>退出登录</Button>
        </Paper>

        <Paper component="section" variant="outlined" className="p-6 max-md:p-5">
          <SectionHeader icon={<DownloadOutlined />} title="安装到设备" caption="像原生应用一样从桌面或主屏幕打开。" />
          <Typography component="p" variant="caption" color="text.secondary" sx={{ mt: 2, mb: 2 }}>安装后拥有独立窗口和应用图标，网络不稳定时仍可打开应用界面。</Typography>
          <Button variant={installState === 'available' ? 'contained' : 'outlined'} startIcon={installState === 'installed' ? <CheckCircleOutlineOutlined /> : <DownloadOutlined />} disabled={installState === 'installed' || installing} onClick={() => void handleInstall()}>
            {installState === 'installed' ? '已安装到设备' : installing ? '正在打开安装…' : installState === 'available' ? '安装轻任务' : showInstallHelp ? '收起安装方法' : '查看安装方法'}
          </Button>
          {showInstallHelp && installState === 'manual' && <Paper variant="outlined" sx={{ mt: 1.5, p: 1.5, bgcolor: 'var(--color-fill)' }}><Typography variant="body2" sx={{ fontWeight: 700 }}>浏览器暂未开放快捷安装</Typography><Typography variant="caption" component="p" sx={{ mt: 0.5 }}>Chrome / Edge 会按当前域名单独判断，也可以直接从浏览器菜单选择“安装应用”。iPhone / iPad 请使用 Safari 的“添加到主屏幕”。</Typography></Paper>}
        </Paper>
      </Box>

      <ConfirmDialog
        open={Boolean(deletingTag)}
        title="删除标签？"
        description={`将从相关任务中移除“${deletingTag?.name ?? ''}”，任务本身会保留。`}
        onClose={() => setConfirmDeleteTagId(null)}
        onConfirm={async () => {
          if (!onDeleteTag || !deletingTag) return
          setTagBusy(true)
          try {
            const affected = await onDeleteTag(deletingTag.id)
            setConfirmDeleteTagId(null)
            onNotify(`标签已删除，${affected} 个任务已更新`)
          } catch (reason) {
            onNotify(reason instanceof Error ? reason.message : '删除标签失败')
          } finally {
            setTagBusy(false)
          }
        }}
        confirmLabel={tagBusy ? '删除中…' : '确认删除'}
        confirmColor="error"
        confirmDisabled={tagBusy}
      />

      <ConfirmDialog
        open={Boolean(mergeProposal)}
        title="合并标签？"
        description={`“${mergeProposal?.source.name ?? ''}”会合并到“${mergeProposal?.target.name ?? ''}”，所有任务引用会自动更新。`}
        onClose={() => setMergeProposal(null)}
        onConfirm={async () => {
          if (!onMergeTags || !mergeProposal) return
          setTagBusy(true)
          try {
            const affected = await onMergeTags(mergeProposal.source.id, mergeProposal.target.id)
            setMergeProposal(null)
            setEditingTagId(null)
            onNotify(`标签已合并，${affected} 个任务已更新`)
          } catch (reason) {
            onNotify(reason instanceof Error ? reason.message : '合并标签失败')
          } finally {
            setTagBusy(false)
          }
        }}
        confirmLabel={tagBusy ? '合并中…' : '确认合并'}
        confirmDisabled={tagBusy}
      />
    </Box>
  )
}
