import type { Tag, TagColor, TagMatchMode } from '../types'

export const tagColors: TagColor[] = [
  'lavender',
  'mint',
  'apricot',
  'rose',
  'sky',
  'amber',
  'slate',
  'indigo',
]

export function normalizeTagName(name: string) {
  return name
    .normalize('NFKC')
    .trim()
    .replace(/\s+/g, ' ')
    .toLocaleLowerCase('zh-CN')
}

export function cleanTagName(name: string) {
  return name.normalize('NFKC').trim().replace(/\s+/g, ' ').slice(0, 24)
}

export function sortTags(tags: Tag[]) {
  return [...tags]
    .filter((tag) => !tag.deletedAt)
    .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name, 'zh-CN'))
}

export function taskMatchesTags(
  taskTagIds: string[] | undefined,
  selectedTagIds: string[],
  matchMode: TagMatchMode,
) {
  if (selectedTagIds.length === 0) return true
  const taskTags = new Set(taskTagIds ?? [])
  return matchMode === 'all'
    ? selectedTagIds.every((tagId) => taskTags.has(tagId))
    : selectedTagIds.some((tagId) => taskTags.has(tagId))
}

export function dedupeTagIds(tagIds: string[] | undefined) {
  return [...new Set((tagIds ?? []).filter(Boolean))].slice(0, 10)
}
