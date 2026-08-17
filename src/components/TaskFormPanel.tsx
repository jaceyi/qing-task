import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Alert,
  Box,
  Button,
  Divider,
  Drawer,
  FormControl,
  IconButton,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material'
import CheckOutlined from '@mui/icons-material/CheckOutlined'
import CloseOutlined from '@mui/icons-material/CloseOutlined'
import LayersOutlined from '@mui/icons-material/LayersOutlined'
import { normalizeDateTimeInput, validateTaskDateRange } from '../lib/date'
import { parseLocalDateTime, previewRecurrence, syncRecurrenceTiming } from '../lib/recurrence'
import { readEnvelopeFresh, readJSON, removeStored, writeEnvelope } from '../lib/storage'
import type { Tag, Task, TaskDraft, TaskType } from '../types'
import { ConfirmDialog } from './ConfirmDialog'
import { FieldLabel } from './FieldLabel'
import { RecurrenceEditor } from './RecurrenceEditor'
import { TagPicker } from './TagPicker'

const DRAFT_TTL_MS = 30 * 24 * 60 * 60 * 1000

interface TaskFormPanelProps {
  /** drawer：桌面端右侧抽屉；page：移动端路由下钻页面，顶部返回由应用顶栏承担。两者共用同一套表单内容与草稿保护逻辑。 */
  variant?: 'drawer' | 'page'
  sourceTask?: Task | null
  draftStorageKey: string
  onClose: () => void
  /** 向外层（如应用顶栏返回按钮）注册带脏检查的关闭入口；卸载时注销。 */
  onRegisterClose?: (requestClose: (() => void) | null) => void
  onSubmit: (draft: TaskDraft, copiedFrom?: string) => Promise<void>
  onDirtyChange?: (dirty: boolean) => void
  tags?: Tag[]
  onCreateTag?: (name: string) => Promise<Tag>
}

function makeInitialDraft(sourceTask?: Task | null): TaskDraft {
  if (!sourceTask) {
    return {
      title: '', description: '', startDate: '', endDate: '', type: 'single',
      targetCount: 5, count: 0, completed: false, tagIds: [], recurrence: null,
    }
  }
  const startDate = normalizeDateTimeInput(sourceTask.startDate, 'start')
  const endDate = normalizeDateTimeInput(sourceTask.endDate, 'end')
  return {
    title: `${sourceTask.title}（副本）`,
    description: sourceTask.description,
    startDate,
    endDate,
    type: sourceTask.type,
    targetCount: sourceTask.type === 'progress' ? sourceTask.targetCount : 5,
    count: 0,
    completed: false,
    tagIds: sourceTask.tagIds ?? [],
    // 复制时保留重复规则，并把锚点重新对齐到副本的时间，作为全新系列开始
    recurrence: sourceTask.recurrence && startDate
      ? syncRecurrenceTiming(sourceTask.recurrence, startDate, endDate)
      : null,
  }
}

function readStoredDraft(storageKey: string, fallback: TaskDraft): TaskDraft {
  const validate = (value: unknown): TaskDraft | null => {
    if (!value || typeof value !== 'object') return null
    const parsed = value as Partial<TaskDraft>
    if (
      typeof parsed.title !== 'string'
      || typeof parsed.description !== 'string'
      || typeof parsed.startDate !== 'string'
      || typeof parsed.endDate !== 'string'
      || (parsed.type !== 'single' && parsed.type !== 'progress')
      || typeof parsed.targetCount !== 'number'
    ) return null
    return { ...fallback, ...parsed }
  }
  const enveloped = readEnvelopeFresh(storageKey, validate, DRAFT_TTL_MS)
  if (enveloped) return enveloped.value
  // 旧版草稿为裸 JSON：直接读取，下次编辑时自动迁移为信封格式
  return readJSON(storageKey, validate) ?? fallback
}

export function TaskFormPanel({
  variant = 'drawer',
  sourceTask,
  draftStorageKey,
  onClose,
  onRegisterClose,
  onSubmit,
  onDirtyChange,
  tags = [],
  onCreateTag = async () => { throw new Error('暂时无法创建标签') },
}: TaskFormPanelProps) {
  const initialDraft = useMemo(() => makeInitialDraft(sourceTask), [sourceTask])
  const initialSignature = useMemo(() => JSON.stringify(initialDraft), [initialDraft])
  const [draft, setDraft] = useState(() => readStoredDraft(draftStorageKey, initialDraft))
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [confirmDiscard, setConfirmDiscard] = useState(false)
  const openerRef = useRef<HTMLElement | null>(typeof document === 'undefined' ? null : document.activeElement as HTMLElement | null)
  const dirty = JSON.stringify(draft) !== initialSignature

  useEffect(() => {
    setDraft(readStoredDraft(draftStorageKey, initialDraft))
    setError('')
    setSaving(false)
    setConfirmDiscard(false)
  }, [draftStorageKey, initialDraft])

  useEffect(() => {
    if (dirty) writeEnvelope(draftStorageKey, draft)
    else removeStored(draftStorageKey)
  }, [dirty, draft, draftStorageKey])

  useEffect(() => {
    onDirtyChange?.(dirty)
    return () => onDirtyChange?.(false)
  }, [dirty, onDirtyChange])

  useEffect(() => {
    const warnBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!dirty) return
      event.preventDefault()
      event.returnValue = ''
    }
    window.addEventListener('beforeunload', warnBeforeUnload)
    return () => window.removeEventListener('beforeunload', warnBeforeUnload)
  }, [dirty])

  useEffect(() => () => {
    if (openerRef.current?.isConnected) openerRef.current.focus()
  }, [])

  const requestClose = useCallback(() => {
    if (dirty) setConfirmDiscard(true)
    else onClose()
  }, [dirty, onClose])

  useEffect(() => {
    onRegisterClose?.(requestClose)
    return () => onRegisterClose?.(null)
  }, [onRegisterClose, requestClose])

  const setType = (type: TaskType) => setDraft((current) => ({ ...current, type }))

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!draft.title.trim()) return setError('请输入任务名称')
    const dateError = validateTaskDateRange(draft.startDate, draft.endDate)
    if (dateError) return setError(dateError)
    if (draft.type === 'progress' && draft.targetCount < 1) return setError('目标次数至少为 1')
    if (draft.recurrence) {
      if (!draft.startDate || !draft.endDate) return setError('请为重复任务设置执行时间')
      if (draft.recurrence.end.kind === 'until' && draft.recurrence.end.date < draft.startDate.slice(0, 10)) {
        return setError('重复截止日期不能早于任务开始日期')
      }
      // 重叠校验的下一期从任务自身开始时间算起（与推进算法一致），而不是当前时刻
      const preview = previewRecurrence(draft.recurrence, 1, parseLocalDateTime(draft.startDate) ?? new Date())[0]
      const end = parseLocalDateTime(draft.endDate)
      const nextStart = preview ? parseLocalDateTime(preview.startDate) : null
      if (nextStart && end && end >= nextStart) return setError('当前时间范围与下一次重复时间重叠，请调整重复计划')
    }
    setSaving(true)
    setError('')
    try {
      await onSubmit(draft, sourceTask?.id)
      removeStored(draftStorageKey)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '创建任务失败')
      setSaving(false)
    }
  }

  const isPage = variant === 'page'

  const discardDialog = (
    <ConfirmDialog
      open={confirmDiscard}
      title="退出新建任务？"
      description="草稿已经保存在本机，你可以保留后退出，也可以彻底放弃。"
      onClose={() => setConfirmDiscard(false)}
      onConfirm={() => { removeStored(draftStorageKey); onDirtyChange?.(false); onClose() }}
      confirmLabel="放弃草稿"
      confirmColor="error"
      cancelLabel="继续编辑"
      extraActions={<Button variant="outlined" onClick={() => { onDirtyChange?.(false); onClose() }}>保留并退出</Button>}
    />
  )

  const content = (
    <>
      {isPage ? (
        <Box component="header" className="mb-5 grid max-md:mb-4">
          <Typography className="inline-flex items-center gap-1.5 font-bold tracking-[0.08em] text-primary-strong uppercase max-md:hidden" variant="caption">{sourceTask ? '复制任务' : '创建任务'}</Typography>
          <Typography id="task-form-title" component="h1" className="text-[clamp(22px,2vw,26px)] leading-[1.18] tracking-[-0.035em] text-ink max-md:text-xl">{sourceTask ? '复制为新任务' : '新建任务'}</Typography>
        </Box>
      ) : (
        <>
          <Box component="header" sx={{ minHeight: 72, px: { xs: 2, sm: 3 }, display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Box sx={{ flex: 1 }}>
              <Typography variant="caption" sx={{ color: 'primary.main', fontWeight: 700, letterSpacing: '.08em' }}>{sourceTask ? '复制任务' : '创建任务'}</Typography>
              <Typography id="task-form-title" variant="h6" sx={{ fontSize: 19, fontWeight: 750 }}>{sourceTask ? '复制为新任务' : '新建任务'}</Typography>
            </Box>
            <IconButton onClick={requestClose} aria-label="关闭"><CloseOutlined /></IconButton>
          </Box>
          <Divider />
        </>
      )}

      <Box
        component="form"
        onSubmit={handleSubmit}
        sx={isPage
          ? { py: 2.5, pb: 'calc(96px + env(safe-area-inset-bottom))', display: 'grid', gap: 2.5 }
          : { px: { xs: 2, sm: 3 }, py: 2.5, pb: 12, display: 'grid', gap: 2.5 }}
      >
          <TextField
            autoFocus
            required
            label="任务名称"
            value={draft.title}
            slotProps={{ htmlInput: { maxLength: 120 } }}
            placeholder="例如：完成项目方案"
            onChange={(event) => setDraft({ ...draft, title: event.target.value })}
          />

          <TagPicker
            tags={tags}
            selectedTagIds={draft.tagIds}
            onChange={(tagIds) => setDraft((current) => ({ ...current, tagIds }))}
            onCreateTag={onCreateTag}
          />

          <TextField
            label="任务描述"
            value={draft.description}
            slotProps={{ htmlInput: { maxLength: 2000 } }}
            multiline
            minRows={4}
            placeholder="补充任务背景、要求或完成标准"
            onChange={(event) => setDraft({ ...draft, description: event.target.value })}
          />

          <FormControl component="fieldset">
            <FieldLabel sx={{ mb: 1 }}>任务类型</FieldLabel>
            <ToggleButtonGroup
              exclusive
              fullWidth
              value={draft.type}
              onChange={(_, value) => value && setType(value)}
              sx={{ '& .MuiToggleButton-root': { flex: 1, justifyContent: 'flex-start', gap: 1, px: 1.5, py: 1 } }}
            >
              <ToggleButton value="single">
                <CheckOutlined sx={{ fontSize: 18 }} />
                <Box sx={{ display: 'grid', textAlign: 'left' }}><strong>普通任务</strong><Typography variant="caption">一次完成</Typography></Box>
              </ToggleButton>
              <ToggleButton value="progress">
                <LayersOutlined sx={{ fontSize: 18 }} />
                <Box sx={{ display: 'grid', textAlign: 'left' }}><strong>进度任务</strong><Typography variant="caption">多次累积</Typography></Box>
              </ToggleButton>
            </ToggleButtonGroup>
          </FormControl>

          {draft.type === 'progress' && (
            <TextField
              label="目标次数"
              type="number"
              value={draft.targetCount}
              onChange={(event) => setDraft({ ...draft, targetCount: Number(event.target.value) })}
              helperText="新任务的进度从 0 开始。"
              slotProps={{ htmlInput: { min: 1, max: 99999, inputMode: 'numeric' } }}
            />
          )}

          <RecurrenceEditor
            value={draft.recurrence}
            startDate={draft.startDate}
            endDate={draft.endDate}
            onChange={(recurrence) => setDraft((current) => ({ ...current, recurrence }))}
            onTimingChange={(startDate, endDate) => setDraft((current) => ({ ...current, startDate, endDate }))}
          />

          {error && <Alert severity="error">{error}</Alert>}

          <Box sx={{ position: 'fixed', right: 0, bottom: 0, width: isPage ? '100%' : { xs: '100%', sm: 520 }, px: 3, py: 2, pb: isPage ? 'calc(8px + env(safe-area-inset-bottom))' : 2, display: 'flex', justifyContent: 'flex-end', gap: 1, borderTop: '1px solid', borderColor: 'divider', bgcolor: 'background.paper', zIndex: 2 }}>
            <Button variant="outlined" onClick={requestClose}>取消</Button>
            <Button type="submit" variant="contained" disabled={saving}>{saving ? '正在创建…' : sourceTask ? '创建副本' : '创建任务'}</Button>
          </Box>
        </Box>
    </>
  )

  if (isPage) {
    return (
      <>
        <Box component="section" className="mx-auto w-full max-w-160" aria-labelledby="task-form-title">
          {content}
        </Box>
        {discardDialog}
      </>
    )
  }

  return (
    <>
      <Drawer
        anchor="right"
        open
        onClose={requestClose}
        slotProps={{ paper: { sx: { width: { xs: '100%', sm: 520 }, maxWidth: '100vw' } } }}
      >
        {content}
      </Drawer>
      {discardDialog}
    </>
  )
}
