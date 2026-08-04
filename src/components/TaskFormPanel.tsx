import { useEffect, useMemo, useRef, useState } from 'react'
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
import ArrowBackOutlined from '@mui/icons-material/ArrowBackOutlined'
import CheckOutlined from '@mui/icons-material/CheckOutlined'
import CloseOutlined from '@mui/icons-material/CloseOutlined'
import LayersOutlined from '@mui/icons-material/LayersOutlined'
import { normalizeDateTimeInput, validateTaskDateRange } from '../lib/date'
import { parseLocalDateTime, previewRecurrence } from '../lib/recurrence'
import type { Tag, Task, TaskDraft, TaskType } from '../types'
import { ConfirmDialog } from './ConfirmDialog'
import { FieldLabel } from './FieldLabel'
import { RecurrenceEditor } from './RecurrenceEditor'
import { TagPicker } from './TagPicker'

interface TaskFormPanelProps {
  sourceTask?: Task | null
  draftStorageKey: string
  onClose: () => void
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
  return {
    title: `${sourceTask.title}（副本）`,
    description: sourceTask.description,
    startDate: normalizeDateTimeInput(sourceTask.startDate, 'start'),
    endDate: normalizeDateTimeInput(sourceTask.endDate, 'end'),
    type: sourceTask.type,
    targetCount: sourceTask.type === 'progress' ? sourceTask.targetCount : 5,
    count: 0,
    completed: false,
    tagIds: sourceTask.tagIds ?? [],
    recurrence: null,
  }
}

function readStoredDraft(storageKey: string, fallback: TaskDraft) {
  try {
    const stored = localStorage.getItem(storageKey)
    if (!stored) return fallback
    const parsed = JSON.parse(stored) as Partial<TaskDraft>
    if (
      typeof parsed.title !== 'string'
      || typeof parsed.description !== 'string'
      || typeof parsed.startDate !== 'string'
      || typeof parsed.endDate !== 'string'
      || (parsed.type !== 'single' && parsed.type !== 'progress')
      || typeof parsed.targetCount !== 'number'
    ) return fallback
    return { ...fallback, ...parsed }
  } catch {
    return fallback
  }
}

export function TaskFormPanel({
  sourceTask,
  draftStorageKey,
  onClose,
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
    if (dirty) localStorage.setItem(draftStorageKey, JSON.stringify(draft))
    else localStorage.removeItem(draftStorageKey)
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

  const requestClose = () => {
    if (dirty) setConfirmDiscard(true)
    else onClose()
  }

  const setType = (type: TaskType) => setDraft((current) => ({ ...current, type }))

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!draft.title.trim()) return setError('请输入任务名称')
    const dateError = validateTaskDateRange(draft.startDate, draft.endDate)
    if (dateError) return setError(dateError)
    if (draft.type === 'progress' && draft.targetCount < 1) return setError('目标次数至少为 1')
    if (draft.recurrence) {
      const preview = previewRecurrence(draft.recurrence, 1)[0]
      const end = parseLocalDateTime(draft.endDate)
      const nextStart = preview ? parseLocalDateTime(preview.startDate) : null
      if (!draft.startDate || !draft.endDate) return setError('请为重复任务设置执行时间')
      if (draft.recurrence.end.kind === 'until' && draft.recurrence.end.date < draft.startDate.slice(0, 10)) {
        return setError('重复截止日期不能早于任务开始日期')
      }
      if (nextStart && end && end >= nextStart) return setError('当前时间范围与下一次重复时间重叠，请调整重复计划')
    }
    setSaving(true)
    setError('')
    try {
      await onSubmit(draft, sourceTask?.id)
      localStorage.removeItem(draftStorageKey)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '创建任务失败')
      setSaving(false)
    }
  }

  return (
    <>
      <Drawer
        anchor="right"
        open
        onClose={requestClose}
        slotProps={{ paper: { sx: { width: { xs: '100%', sm: 520 }, maxWidth: '100vw' } } }}
      >
        <Box component="header" sx={{ minHeight: 72, px: { xs: 2, sm: 3 }, display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <IconButton className="md:hidden" onClick={requestClose} aria-label="返回"><ArrowBackOutlined /></IconButton>
          <Box sx={{ flex: 1 }}>
            <Typography variant="caption" sx={{ color: 'primary.main', fontWeight: 700, letterSpacing: '.08em' }}>{sourceTask ? '复制任务' : '创建任务'}</Typography>
            <Typography id="task-form-title" variant="h6" sx={{ fontSize: 19, fontWeight: 750 }}>{sourceTask ? '复制为新任务' : '新建任务'}</Typography>
          </Box>
          <IconButton onClick={requestClose} aria-label="关闭"><CloseOutlined /></IconButton>
        </Box>
        <Divider />

        <Box component="form" onSubmit={handleSubmit} sx={{ px: { xs: 2, sm: 3 }, py: 2.5, pb: 12, display: 'grid', gap: 2.5 }}>
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

          <Box sx={{ position: 'fixed', right: 0, bottom: 0, width: { xs: '100%', sm: 520 }, px: 3, py: 2, display: 'flex', justifyContent: 'flex-end', gap: 1, borderTop: '1px solid', borderColor: 'divider', bgcolor: 'background.paper', zIndex: 2 }}>
            <Button variant="outlined" onClick={requestClose}>取消</Button>
            <Button type="submit" variant="contained" disabled={saving}>{saving ? '正在创建…' : sourceTask ? '创建副本' : '创建任务'}</Button>
          </Box>
        </Box>
      </Drawer>

      <ConfirmDialog
        open={confirmDiscard}
        title="退出新建任务？"
        description="草稿已经保存在本机，你可以保留后退出，也可以彻底放弃。"
        onClose={() => setConfirmDiscard(false)}
        onConfirm={() => { localStorage.removeItem(draftStorageKey); onDirtyChange?.(false); onClose() }}
        confirmLabel="放弃草稿"
        confirmColor="error"
        cancelLabel="继续编辑"
        extraActions={<Button variant="outlined" onClick={() => { onDirtyChange?.(false); onClose() }}>保留并退出</Button>}
      />
    </>
  )
}
