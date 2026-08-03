import { describe, expect, it } from 'vitest'
import { cleanTagName, dedupeTagIds, normalizeTagName, taskMatchesTags } from './tagLogic'

describe('tagLogic', () => {
  it('normalizes equivalent names', () => {
    expect(normalizeTagName('  重  要  ')).toBe('重 要')
    expect(normalizeTagName('ＷＯＲＫ')).toBe('work')
  })

  it('cleans and limits visible names', () => {
    expect(cleanTagName('  客户   等待  ')).toBe('客户 等待')
    expect(cleanTagName('a'.repeat(30))).toHaveLength(24)
  })

  it('matches all or any selected tag', () => {
    expect(taskMatchesTags(['a', 'b'], ['a', 'b'], 'all')).toBe(true)
    expect(taskMatchesTags(['a'], ['a', 'b'], 'all')).toBe(false)
    expect(taskMatchesTags(['a'], ['a', 'b'], 'any')).toBe(true)
  })

  it('deduplicates and caps tag ids', () => {
    expect(dedupeTagIds(['a', 'a', 'b'])).toEqual(['a', 'b'])
    expect(dedupeTagIds(Array.from({ length: 12 }, (_, index) => String(index)))).toHaveLength(10)
  })
})
