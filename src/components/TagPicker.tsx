import { useEffect, useRef, useState } from 'react'
import { Plus, Tags, X } from 'lucide-react'
import { cleanTagName, normalizeTagName } from '../lib/tagLogic'
import type { Tag } from '../types'

interface TagPickerProps {
  tags: Tag[]
  selectedTagIds: string[] | undefined
  onChange: (tagIds: string[]) => void
  onCreateTag: (name: string) => Promise<Tag>
  compact?: boolean
}

export function TagPicker({ tags, selectedTagIds, onChange, onCreateTag, compact = false }: TagPickerProps) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState('')
  const rootRef = useRef<HTMLFieldSetElement>(null)
  const selected = selectedTagIds ?? []
  const selectedSet = new Set(selected)
  const selectedTags = tags.filter((tag) => selectedSet.has(tag.id))
  const normalizedSearch = normalizeTagName(search)
  const matches = tags.filter((tag) => !selectedSet.has(tag.id) && (!normalizedSearch || tag.normalizedName.includes(normalizedSearch)))
  const exact = tags.some((tag) => tag.normalizedName === normalizedSearch)

  useEffect(() => {
    if (!open) return
    const onOutside = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false)
    }
    const onEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('pointerdown', onOutside)
    document.addEventListener('keydown', onEscape)
    return () => {
      document.removeEventListener('pointerdown', onOutside)
      document.removeEventListener('keydown', onEscape)
    }
  }, [open])

  const choose = (tagId: string) => {
    if (selected.length >= 10) return
    onChange([...selected, tagId])
    setSearch('')
  }

  const create = async () => {
    const name = cleanTagName(search)
    if (!name || exact || selected.length >= 10) return
    setCreating(true)
    setError('')
    try {
      const tag = await onCreateTag(name)
      if (!selectedSet.has(tag.id)) onChange([...selected, tag.id])
      setSearch('')
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '创建标签失败')
    } finally {
      setCreating(false)
    }
  }

  return (
    <fieldset ref={rootRef} className={`field-group tag-picker ${compact ? 'is-compact' : ''}`}>
      <legend><Tags /> <span>标签 <small>可选，最多 10 个</small></span></legend>
      <div className={`tag-picker-control ${open ? 'is-open' : ''}`}>
        <div className="selected-tags">
          {selectedTags.map((tag) => (
            <span key={tag.id} className={`tag-chip is-${tag.color}`}>
              <i />{tag.name}
              <button type="button" aria-label={`移除标签 ${tag.name}`} onClick={() => onChange(selected.filter((id) => id !== tag.id))}><X /></button>
            </span>
          ))}
          <button type="button" className="tag-add-button" onClick={() => setOpen((shown) => !shown)} disabled={selected.length >= 10}><Plus /> 添加标签</button>
        </div>
        {open && (
          <div className="tag-picker-popover">
            <div className="tag-search-row"><Tags /><input autoFocus value={search} placeholder="搜索或新建标签" maxLength={24} onChange={(event) => setSearch(event.target.value)} onKeyDown={(event) => {
              if (event.key !== 'Enter') return
              event.preventDefault()
              if (matches[0]) choose(matches[0].id)
              else void create()
            }} /></div>
            <div className="tag-options" role="listbox" aria-label="可用标签">
              {matches.map((tag) => (
                <button key={tag.id} type="button" role="option" aria-selected="false" onClick={() => choose(tag.id)}><i className={`tag-color is-${tag.color}`} /><span>{tag.name}</span></button>
              ))}
              {!exact && normalizedSearch && (
                <button type="button" className="create-tag-option" onClick={() => void create()} disabled={creating}><Plus /><span>{creating ? '正在创建…' : `创建“${cleanTagName(search)}”`}</span></button>
              )}
              {!matches.length && (!normalizedSearch || exact) && <p>没有更多可选标签。</p>}
            </div>
            {error && <p className="tag-picker-error" role="alert">{error}</p>}
          </div>
        )}
      </div>
    </fieldset>
  )
}
