import { useEffect, useRef, useState } from 'react'
import { Avatar, Box, Button, IconButton, InputAdornment, ListItemIcon, Menu, MenuItem, TextField, Typography } from '@mui/material'
import AddOutlined from '@mui/icons-material/AddOutlined'
import ArrowBackOutlined from '@mui/icons-material/ArrowBackOutlined'
import CheckOutlined from '@mui/icons-material/CheckOutlined'
import ClearOutlined from '@mui/icons-material/ClearOutlined'
import ExpandMoreOutlined from '@mui/icons-material/ExpandMoreOutlined'
import LogoutOutlined from '@mui/icons-material/LogoutOutlined'
import SearchOutlined from '@mui/icons-material/SearchOutlined'
import SettingsOutlined from '@mui/icons-material/SettingsOutlined'
import type { RouteSurface } from '../lib/routes'
import type { SyncStatusKind, SyncStatusPresentation } from '../lib/syncStatus'
import type { BoardScope } from '../types'

const scopeLabels: Record<BoardScope, string> = { all: '全部', today: '今天', week: '本周' }

const presenceClasses: Record<SyncStatusKind, string> = {
  synced: 'bg-mint',
  syncing: 'bg-primary animate-sync-pulse',
  offline: 'bg-apricot-strong',
  error: 'bg-danger',
  local: 'bg-muted',
}

interface AppHeaderProps {
  routeSurface: RouteSurface
  boardKind: 'time' | 'tag'
  calendarScope: BoardScope
  selectedTask: boolean
  searchTerm: string
  displayName: string
  email: string
  photoURL?: string | null
  demoMode: boolean
  syncStatus: SyncStatusPresentation
  onSearchChange: (value: string) => void
  onBack: () => void
  onCreate: () => void
  onOpenSettings: () => void
  onSignOut: () => void
}

export function AppHeader({
  routeSurface,
  boardKind,
  calendarScope,
  selectedTask,
  searchTerm,
  displayName,
  email,
  photoURL,
  demoMode,
  syncStatus,
  onSearchChange,
  onBack,
  onCreate,
  onOpenSettings,
  onSignOut,
}: AppHeaderProps) {
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false)
  const [profileAnchor, setProfileAnchor] = useState<HTMLElement | null>(null)
  const mobileSearchInputRef = useRef<HTMLInputElement>(null)
  const settingsOpen = routeSurface === 'settings'
  const analyticsOpen = routeSurface === 'analytics'
  const showingDetail = routeSurface === 'detail'
  const showingForm = routeSurface === 'form'
  const avatarText = displayName.slice(0, 1).toUpperCase()

  useEffect(() => {
    if (routeSurface !== 'board') setMobileSearchOpen(false)
    else if (searchTerm.trim()) setMobileSearchOpen(true)
  }, [routeSurface, searchTerm])

  useEffect(() => {
    if (!mobileSearchOpen) return
    const timer = window.setTimeout(() => mobileSearchInputRef.current?.focus({ preventScroll: true }), 80)
    return () => window.clearTimeout(timer)
  }, [mobileSearchOpen])

  const closeProfile = () => setProfileAnchor(null)

  return (
    <Box component="header" className="sticky top-0 z-10 flex h-[72px] min-w-0 items-center gap-4 border-b border-line bg-white/90 px-6 backdrop-blur max-md:h-[calc(64px+env(safe-area-inset-top))] max-md:gap-2.5 max-md:pr-[max(16px,env(safe-area-inset-right))] max-md:pb-0 max-md:pl-[max(16px,env(safe-area-inset-left))] max-md:pt-[env(safe-area-inset-top)] md:col-start-3 md:col-span-2">
      {/* 桌面面包屑 */}
      <Box className="mr-auto hidden items-center gap-2.5 text-[13px] md:flex">
        {settingsOpen ? <span className="font-semibold text-ink">设置</span> : analyticsOpen ? <span className="font-semibold text-ink">分析</span> : routeSurface === 'form' ? (
          <>
            <span className="font-semibold text-ink">任务</span><b className="font-normal text-line-strong">/</b><strong className="font-medium text-muted">新建任务</strong>
          </>
        ) : (
          <>
            {showingDetail && <IconButton className="mr-0.5 size-8 border border-line bg-surface text-ink-2" onClick={onBack} aria-label="返回任务列表"><ArrowBackOutlined /></IconButton>}
            <span className="font-semibold text-ink">任务</span><b className="font-normal text-line-strong">/</b><strong className="font-medium text-muted">{selectedTask ? '详情' : boardKind === 'tag' ? '标签看板' : scopeLabels[calendarScope]}</strong>
          </>
        )}
      </Box>

      {/* 移动端标题：详情与新建页下钻时只显示返回箭头，与详情页逻辑一致 */}
      <Box className={`mr-auto hidden min-w-0 items-center max-md:flex ${showingDetail || showingForm ? '' : 'gap-2'}`}>
        {showingDetail || showingForm ? (
          <IconButton className="size-11 shrink-0" onClick={onBack} aria-label={showingDetail ? '返回任务列表' : '返回'}><ArrowBackOutlined /></IconButton>
        ) : (
          <>
            <span className="grid size-8 shrink-0 place-items-center rounded-md bg-primary text-white shadow-[0_6px_14px_rgba(99,117,215,0.2)]">
              <CheckOutlined sx={{ fontSize: 18 }} />
            </span>
            <strong className="overflow-hidden text-lg whitespace-nowrap text-ellipsis text-ink">{settingsOpen ? '设置' : analyticsOpen ? '分析' : boardKind === 'tag' ? '标签任务' : `${scopeLabels[calendarScope]}任务`}</strong>
          </>
        )}
      </Box>

      {routeSurface === 'board' && (
        <>
          <TextField
            className={`w-[min(280px,24vw)] max-md:absolute max-md:inset-x-3 max-md:top-[calc(58px+env(safe-area-inset-top))] max-md:z-[3] max-md:w-auto max-md:rounded-md max-md:bg-surface max-md:shadow-soft max-md:transition-[opacity,transform] max-md:duration-150 ${mobileSearchOpen ? '' : 'max-md:invisible max-md:-translate-y-2 max-md:opacity-0'}`}
            inputRef={mobileSearchInputRef}
            value={searchTerm}
            placeholder="搜索任务"
            onChange={(event) => onSearchChange(event.target.value)}
            onBlur={(event) => {
              if (!event.currentTarget.contains(event.relatedTarget)) setMobileSearchOpen(false)
            }}
            slotProps={{
              input: {
                startAdornment: <InputAdornment position="start"><SearchOutlined /></InputAdornment>,
                endAdornment: searchTerm ? <InputAdornment position="end"><IconButton aria-label="清空搜索" onClick={() => onSearchChange('')}><ClearOutlined /></IconButton></InputAdornment> : undefined,
              },
              htmlInput: { 'aria-label': '搜索任务' },
            }}
          />
          <IconButton className="hidden size-11 max-md:grid" aria-label="搜索" aria-expanded={mobileSearchOpen} onMouseDown={(event) => event.preventDefault()} onClick={() => setMobileSearchOpen((open) => !open)}><SearchOutlined /></IconButton>
        </>
      )}

      <Button className="min-h-10 max-md:hidden" variant="contained" startIcon={<AddOutlined />} onClick={onCreate}>新建任务</Button>

      <Box className="relative">
        <Button className="min-w-0 rounded-full p-0.5 max-md:p-1" aria-expanded={Boolean(profileAnchor)} onClick={(event) => setProfileAnchor(event.currentTarget)} endIcon={<ExpandMoreOutlined className="max-md:hidden" />}>
          <Box className="relative grid">
            <Avatar
              className="size-9 border-2 border-[#e5e6fa] bg-primary text-[13px] font-bold text-white max-md:size-[34px]"
              src={photoURL ?? undefined}
              alt=""
              slotProps={{ img: { referrerPolicy: 'no-referrer' } }}
            >
              {avatarText}
            </Avatar>
            <i className={`absolute -right-px -bottom-px size-2.5 rounded-full border-2 border-white ${presenceClasses[syncStatus.kind]}`} title={syncStatus.title} />
          </Box>
        </Button>
        <Menu anchorEl={profileAnchor} open={Boolean(profileAnchor)} onClose={closeProfile} slotProps={{ paper: { sx: { width: 232, mt: 1 } } }}>
          <Box sx={{ px: 1.5, py: 1, borderBottom: '1px solid', borderColor: 'divider', mb: 0.5 }}>
            <Typography variant="body2" noWrap sx={{ fontWeight: 750 }}>{displayName}</Typography>
            <Typography variant="caption" noWrap>{email}</Typography>
          </Box>
          <MenuItem onClick={() => { closeProfile(); onOpenSettings() }}><ListItemIcon><SettingsOutlined fontSize="small" /></ListItemIcon>设置</MenuItem>
          {!demoMode && <MenuItem onClick={() => { closeProfile(); onSignOut() }}><ListItemIcon><LogoutOutlined fontSize="small" /></ListItemIcon>退出登录</MenuItem>}
        </Menu>
      </Box>
    </Box>
  )
}
