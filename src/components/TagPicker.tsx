import { useState } from 'react'
import { Alert, Autocomplete, Box, Chip, FormHelperText, TextField } from '@mui/material'
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
  const [inputValue, setInputValue] = useState('')
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState('')
  const selected = selectedTagIds ?? []
  const selectedTags = tags.filter((tag) => selected.includes(tag.id))

  const handleChange = async (_event: unknown, next: Array<Tag | string>) => {
    if (next.length > 10) return
    const typed = next.find((item): item is string => typeof item === 'string')
    if (!typed) {
      onChange(next.filter((tag): tag is Tag => typeof tag !== 'string').map((tag) => tag.id))
      return
    }
    const name = cleanTagName(typed)
    if (!name) return
    const existing = tags.find((tag) => tag.normalizedName === normalizeTagName(name))
    if (existing) {
      onChange([...new Set([...selected, existing.id])])
      setInputValue('')
      return
    }
    setCreating(true)
    setError('')
    try {
      const created = await onCreateTag(name)
      onChange([...new Set([...selected, created.id])])
      setInputValue('')
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '创建标签失败')
    } finally {
      setCreating(false)
    }
  }

  return (
    <Box className="min-w-0">
      <Autocomplete<Tag, true, false, true>
        multiple
        freeSolo
        openOnFocus
        forcePopupIcon
        filterSelectedOptions
        limitTags={compact ? 3 : 4}
        options={tags}
        value={selectedTags}
        inputValue={inputValue}
        loading={creating}
        sx={{ '& .MuiInputBase-root': { minHeight: 40 } }}
        loadingText="正在创建…"
        noOptionsText={inputValue ? `按回车创建“${cleanTagName(inputValue)}”` : '没有更多可选标签'}
        getOptionLabel={(option) => typeof option === 'string' ? option : option.name}
        isOptionEqualToValue={(option, selectedTag) => typeof selectedTag !== 'string' && option.id === selectedTag.id}
        onInputChange={(_, value) => setInputValue(value.slice(0, 24))}
        onChange={(event, value) => void handleChange(event, value)}
        renderValue={(value, getItemProps) => value.map((tag, index) => typeof tag === 'string' ? null : (
          <Chip {...getItemProps({ index })} key={tag.id} label={tag.name} className={`tag-chip is-${tag.color}`} icon={<Box component="i" className={`tag-color is-${tag.color}`} />} />
        ))}
        renderOption={(props, option) => (
          <Box component="li" {...props} key={typeof option === 'string' ? option : option.id} sx={{ display: 'flex', gap: 1 }}>
            {typeof option !== 'string' && <Box component="i" className={`tag-color is-${option.color}`} />}
            {typeof option === 'string' ? `创建“${option}”` : option.name}
          </Box>
        )}
        renderInput={(params) => (
          <TextField
            {...params}
            label={compact ? undefined : '标签'}
            placeholder={selected.length ? '继续添加标签' : '搜索或输入新标签'}
            slotProps={{
              ...params.slotProps,
              htmlInput: {
                ...params.slotProps.htmlInput,
                'aria-label': '标签',
                maxLength: 24,
              },
            }}
          />
        )}
      />
      <FormHelperText>{selected.length}/10，可输入名称后按回车创建</FormHelperText>
      {error && <Alert severity="error" sx={{ mt: 1 }}>{error}</Alert>}
    </Box>
  )
}
