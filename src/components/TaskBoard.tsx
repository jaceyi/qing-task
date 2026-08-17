import { useEffect, useMemo, useState, type FormEvent } from 'react'
import dayjs from 'dayjs'
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  Chip,
  IconButton,
  Paper,
  Skeleton,
  Stack,
  Tab,
  Tabs,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
  useMediaQuery,
} from '@mui/material'
import AddOutlined from '@mui/icons-material/AddOutlined'
import CalendarMonthOutlined from '@mui/icons-material/CalendarMonthOutlined'
import CloseOutlined from '@mui/icons-material/CloseOutlined'
import DateRangeOutlined from '@mui/icons-material/DateRangeOutlined'
import InboxOutlined from '@mui/icons-material/InboxOutlined'
import LayersOutlined from '@mui/icons-material/LayersOutlined'
import LightModeOutlined from '@mui/icons-material/LightModeOutlined'
import SwipeOutlined from '@mui/icons-material/SwipeOutlined'
import { DatePicker } from '@mui/x-date-pickers/DatePicker'
import { toDateInput } from '../lib/date'
import { filterAndSortTasks, isTaskComplete } from '../lib/taskLogic'
import type { CustomDateRange, Tag, TagMatchMode, Task, TimeFilterScope } from '../types'
import { TaskRow } from './TaskRow'

interface TaskBoardProps {
  tasks: Task[]
  scope: TimeFilterScope
  customRange?: CustomDateRange
  boardKind?: 'time' | 'tag'
  hideCompleted: boolean
  searchTerm: string
  loading: boolean
  onScopeChange: (scope: TimeFilterScope, customRange?: CustomDateRange) => void
  onOpenTask: (task: Task) => void
  onTaskAction: (task: Task, direction: 'positive' | 'negative') => Promise<boolean>
  onResetProgress?: (task: Task) => Promise<boolean>
  onCreate: () => void
  onNotify: (message: string) => void
  showSwipeHint?: boolean
  onDismissSwipeHint?: () => void
  tags?: Tag[]
  selectedTagIds?: string[]
  tagMatchMode?: TagMatchMode
  onTagFilterChange?: (tagIds: string[], matchMode: TagMatchMode) => void
  onUndoableStatusChange?: (message: string) => void
  onOpenTag?: (tagId: string) => void
  title?: string
}

const scopes = [
  { id: 'all' as const, label: '全部', icon: <LayersOutlined /> },
  { id: 'today' as const, label: '今天', icon: <LightModeOutlined /> },
  { id: 'week' as const, label: '本周', icon: <CalendarMonthOutlined /> },
]
const customScope = { id: 'custom' as const, label: '自定义', icon: <DateRangeOutlined /> }
const scopeTitles: Record<TimeFilterScope, string> = { today: '今日任务', week: '本周任务', all: '全部任务', custom: '自定义时间任务' }

export function TaskBoard({
  tasks,
  scope,
  customRange,
  boardKind = 'time',
  hideCompleted,
  searchTerm,
  loading,
  onScopeChange,
  onOpenTask,
  onTaskAction,
  onResetProgress,
  onCreate,
  onNotify,
  showSwipeHint = false,
  onDismissSwipeHint,
  tags = [],
  selectedTagIds = [],
  tagMatchMode = 'all',
  onTagFilterChange,
  onUndoableStatusChange,
  onOpenTag,
  title,
}: TaskBoardProps) {
  const isMobile = useMediaQuery((theme) => theme.breakpoints.down('md'))
  const [customDraft, setCustomDraft] = useState<CustomDateRange>(() => customRange ?? { startDate: toDateInput(), endDate: toDateInput() })
  const availableScopes = useMemo(() => boardKind === 'tag' ? [...scopes, customScope] : scopes, [boardKind])
  // 标签看板在移动端有 4 个时间筛选：去掉图标并允许横向滚动，避免换行拥挤
  const compactScopes = isMobile && boardKind === 'tag'
  const visibleTasks = filterAndSortTasks(tasks, scope, hideCompleted, searchTerm, new Date(), { tags, selectedTagIds, matchMode: tagMatchMode, customRange })
  const active = visibleTasks.filter((task) => !isTaskComplete(task))
  const completed = visibleTasks.filter(isTaskComplete)
  const selectedTags = tags.filter((tag) => selectedTagIds.includes(tag.id))
  const customRangeError = customDraft.startDate && customDraft.endDate && customDraft.startDate > customDraft.endDate ? '结束日期不能早于开始日期' : ''

  useEffect(() => { if (customRange) setCustomDraft(customRange) }, [customRange])

  const selectScope = (nextScope: TimeFilterScope) => {
    if (nextScope === 'custom') {
      const nextRange = customRange ?? customDraft
      setCustomDraft(nextRange)
      onScopeChange(nextScope, nextRange)
    } else onScopeChange(nextScope)
  }

  const applyCustomRange = (event: FormEvent) => {
    event.preventDefault()
    if (!customDraft.startDate || !customDraft.endDate || customRangeError) return
    onScopeChange('custom', customDraft)
  }

  const groupHeading = (label: string, count: number) => (
    <Box className="flex h-10 items-center gap-2 px-2 text-xs tracking-[0.08em] text-muted max-md:px-0.5">
      <span>{label}</span>
      <strong className="grid h-5 min-w-[22px] place-items-center rounded-[7px] bg-primary-soft font-mono text-[11px] font-semibold text-primary-strong">{count}</strong>
    </Box>
  )

  return (
    <Box component="section" className="mx-auto w-full max-w-[900px]" aria-labelledby="page-title">
      <Box className="mb-5 flex items-end justify-between max-md:hidden">
        <Typography id="page-title" component="h1" className="text-[clamp(22px,2vw,26px)] leading-[1.18] tracking-[-0.035em] text-ink">{title ?? scopeTitles[scope]}</Typography>
      </Box>

      {/* 移动端标签入口：横向滚动的标签条，点击直达对应标签看板；桌面端由侧栏承担 */}
      {boardKind === 'time' && tags.length > 0 && onOpenTag && (
        <Box className="-mx-1 mb-3 flex gap-1.5 overflow-x-auto px-1 pb-1 md:hidden [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" aria-label="标签看板入口">
          {tags.map((tag) => (
            <button
              key={tag.id}
              type="button"
              onClick={() => onOpenTag(tag.id)}
              aria-label={`查看标签看板：${tag.name}`}
              className="inline-flex h-8 shrink-0 cursor-pointer items-center gap-1.5 rounded-full border border-line bg-surface px-3 text-[11px] font-medium text-ink-2 active:border-[#cdd3f3] active:bg-primary-soft active:text-primary-strong"
            >
              <i className={`tag-color is-${tag.color}`} />
              {tag.name}
            </button>
          ))}
        </Box>
      )}

      <Tabs
        className={boardKind === 'tag' ? 'mb-4 w-full lg:w-[min(100%,430px)]' : 'mb-4 hidden w-full max-md:flex'}
        value={scope}
        onChange={(_, value) => selectScope(value)}
        aria-label="任务时间范围"
        variant={compactScopes ? 'scrollable' : 'fullWidth'}
        scrollButtons={false}
      >
        {availableScopes.map(({ id, label, icon }) => <Tab key={id} id={`scope-tab-${id}`} value={id} icon={compactScopes ? undefined : icon} iconPosition="start" label={label} />)}
      </Tabs>

      {boardKind === 'tag' && scope === 'custom' && (
        <Paper component="form" variant="outlined" className="mb-4 grid grid-cols-1 items-start gap-3 p-4 sm:grid-cols-[1fr_1fr_auto]" onSubmit={applyCustomRange}>
          <DatePicker
            label="开始日期"
            value={customDraft.startDate ? dayjs(customDraft.startDate) : null}
            onChange={(value) => setCustomDraft((current) => ({
              ...current,
              startDate: value?.isValid() ? value.format('YYYY-MM-DD') : '',
            }))}
            slotProps={{ actionBar: { actions: ['clear', 'cancel', 'accept'] } }}
          />
          <DatePicker
            label="结束日期"
            value={customDraft.endDate ? dayjs(customDraft.endDate) : null}
            onChange={(value) => setCustomDraft((current) => ({
              ...current,
              endDate: value?.isValid() ? value.format('YYYY-MM-DD') : '',
            }))}
            slotProps={{
              actionBar: { actions: ['clear', 'cancel', 'accept'] },
              textField: { error: Boolean(customRangeError), helperText: customRangeError },
            }}
          />
          <Button className="min-h-10" type="submit" variant="contained" disabled={!customDraft.startDate || !customDraft.endDate || Boolean(customRangeError)}>应用</Button>
        </Paper>
      )}

      {boardKind === 'time' && tags.length > 0 && (
        <Box className={`mb-4 grid gap-3 sm:grid-cols-[1fr_auto] ${selectedTagIds.length > 1 ? '' : 'sm:grid-cols-1'}`}>
          <Autocomplete
            multiple
            openOnFocus
            forcePopupIcon
            options={tags}
            value={selectedTags}
            onChange={(_, value) => onTagFilterChange?.(value.map((tag) => tag.id), tagMatchMode)}
            getOptionLabel={(tag) => tag.name}
            isOptionEqualToValue={(option, value) => option.id === value.id}
            sx={{ '& .MuiInputBase-root': { minHeight: 40 } }}
            renderValue={(value, getItemProps) => value.map((tag, index) => <Chip {...getItemProps({ index })} key={tag.id} label={tag.name} className={`tag-chip is-${tag.color}`} />)}
            renderOption={(props, option) => (
              <Box component="li" {...props} key={option.id} sx={{ display: 'flex', gap: 1 }}>
                <Box component="i" className={`tag-color is-${option.color}`} />
                {option.name}
              </Box>
            )}
            renderInput={(params) => <TextField {...params} label="按标签筛选" placeholder={selectedTags.length ? '' : '全部标签'} />}
          />
          {selectedTagIds.length > 1 && (
            <ToggleButtonGroup exclusive value={tagMatchMode} onChange={(_, mode) => mode && onTagFilterChange?.(selectedTagIds, mode)} aria-label="标签匹配方式">
              <ToggleButton value="all">匹配全部</ToggleButton><ToggleButton value="any">匹配任一</ToggleButton>
            </ToggleButtonGroup>
          )}
        </Box>
      )}

      {showSwipeHint && (
        <Alert icon={<SwipeOutlined />} severity="info" className="mb-4" action={<IconButton aria-label="知道了" onClick={onDismissSwipeHint}><CloseOutlined /></IconButton>}>
          <strong>左右滑动任务</strong>，可快速完成、推进或回退。
        </Alert>
      )}

      <Box id="task-scope-panel" role="tabpanel" aria-labelledby={`scope-tab-${scope}`} tabIndex={0}>
        {loading ? (
          <Stack spacing={1}>{Array.from({ length: 6 }, (_, index) => <Skeleton key={index} variant="rounded" height={72} />)}</Stack>
        ) : visibleTasks.length === 0 ? (
          <Paper className="px-4 py-14 text-center" variant="outlined">
            <InboxOutlined sx={{ fontSize: 38, color: 'primary.main', mb: 1 }} />
            <Typography component="h2" sx={{ fontSize: 16, fontWeight: 750 }}>{searchTerm ? '没有匹配的任务' : '这里还没有任务'}</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, mb: 2 }}>{searchTerm ? '换个关键词再试试。' : scope === 'all' ? '创建一个任务，时间可以稍后再安排。' : '暂时没有落在这个时间范围内的任务。'}</Typography>
            {!searchTerm && <Button variant="contained" startIcon={<AddOutlined />} onClick={onCreate}>新建任务</Button>}
          </Paper>
        ) : (
          <Box className="border-t border-line-strong max-md:border-t-0" data-testid="task-list">
            {active.length > 0 && (
              <Box>
                {groupHeading('进行中', active.length)}
                {active.map((task) => <TaskRow key={task.id} task={task} onOpen={() => onOpenTask(task)} onAction={(direction) => onTaskAction(task, direction)} onResetProgress={onResetProgress ? () => onResetProgress(task) : undefined} onNotify={onNotify} onUndoableStatusChange={onUndoableStatusChange} tags={tags} />)}
              </Box>
            )}
            {completed.length > 0 && (
              <Box className="mt-4 max-md:mt-5">
                {groupHeading('已完成', completed.length)}
                {completed.map((task) => <TaskRow key={task.id} task={task} onOpen={() => onOpenTask(task)} onAction={(direction) => onTaskAction(task, direction)} onResetProgress={onResetProgress ? () => onResetProgress(task) : undefined} onNotify={onNotify} onUndoableStatusChange={onUndoableStatusChange} tags={tags} />)}
              </Box>
            )}
          </Box>
        )}
      </Box>
    </Box>
  )
}
