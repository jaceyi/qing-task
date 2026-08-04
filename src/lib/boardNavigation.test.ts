import { describe, expect, it } from 'vitest'
import {
  changeTimeBoardTags,
  changeTimeScope,
  createTagBoardRoute,
  createTimeBoardRoute,
  getBoardViewState,
  selectTimeBoardScope,
} from './boardNavigation'

describe('看板导航状态', () => {
  it('从标签看板进入全部看板时清除标签条件', () => {
    const tagBoard = { name: 'tag-board' as const, tagId: 'tag-work', scope: 'week' as const }
    expect(getBoardViewState(tagBoard).tagIds).toEqual(['tag-work'])
    expect(createTimeBoardRoute('all')).toEqual({ name: 'board', scope: 'all' })
    expect(selectTimeBoardScope(tagBoard, 'all')).toEqual({ name: 'board', scope: 'all' })
  })

  it('时间看板内部切换周期时保留标签子筛选', () => {
    const board = { name: 'board' as const, scope: 'all' as const, tagIds: ['work'], matchMode: 'all' as const }
    expect(changeTimeScope(board, 'today')).toEqual({ ...board, scope: 'today' })
    expect(selectTimeBoardScope(board, 'today')).toEqual({ ...board, scope: 'today' })
    expect(changeTimeBoardTags(board, ['work', 'focus'], 'any')).toEqual({
      name: 'board',
      scope: 'all',
      tagIds: ['work', 'focus'],
      matchMode: 'any',
    })
  })

  it('标签看板切换周期和标签时保持标签看板主体', () => {
    const board = { name: 'tag-board' as const, tagId: 'work', scope: 'all' as const }
    expect(changeTimeScope(board, 'week')).toEqual({ name: 'tag-board', tagId: 'work', scope: 'week' })
    expect(createTagBoardRoute('focus', board)).toEqual({ name: 'tag-board', tagId: 'focus', scope: 'all' })
  })

  it('标签看板的自定义时间范围属于路由状态', () => {
    const board = { name: 'tag-board' as const, tagId: 'work', scope: 'week' as const }
    expect(changeTimeScope(board, 'custom', { startDate: '2026-08-01', endDate: '2026-08-31' })).toEqual({
      name: 'tag-board',
      tagId: 'work',
      scope: 'custom',
      customStart: '2026-08-01',
      customEnd: '2026-08-31',
    })
  })
})
