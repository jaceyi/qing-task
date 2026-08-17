import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  readEnvelope,
  readEnvelopeFresh,
  readJSON,
  readRaw,
  removeStored,
  storageKeys,
  writeEnvelope,
  writeJSON,
  writeRaw,
} from './storage'

const validateString = (value: unknown): string | null => (typeof value === 'string' ? value : null)

describe('本地持久化统一模块', () => {
  beforeEach(() => localStorage.clear())

  it('原始字符串读写带容错', () => {
    expect(writeRaw(storageKeys.utilityPanel, 'collapsed')).toBe(true)
    expect(readRaw(storageKeys.utilityPanel)).toBe('collapsed')
    expect(readRaw('qing-task:missing')).toBeNull()
  })

  it('JSON 读取必须通过校验器，脏数据返回 null', () => {
    writeJSON(storageKeys.analyticsUi, { preset: '30d' })
    expect(readJSON(storageKeys.analyticsUi, (value) => {
      const parsed = value as { preset?: unknown }
      return parsed.preset === '30d' ? parsed : null
    })).toEqual({ preset: '30d' })

    localStorage.setItem(storageKeys.analyticsUi, '{not-json')
    expect(readJSON(storageKeys.analyticsUi, validateString)).toBeNull()
  })

  it('信封格式带写入时刻，形状不符返回 null', () => {
    const before = Date.now()
    expect(writeEnvelope('qing-task:test-envelope', { answer: 42 })).toBe(true)
    const enveloped = readEnvelope('qing-task:test-envelope', (value) => {
      const parsed = value as { answer?: unknown }
      return typeof parsed.answer === 'number' ? parsed : null
    })
    expect(enveloped?.value).toEqual({ answer: 42 })
    expect(enveloped!.savedAt).toBeGreaterThanOrEqual(before)

    // 旧版/损坏数据：无信封字段时返回 null，由调用方走迁移逻辑
    writeJSON('qing-task:test-envelope', { answer: 42 })
    expect(readEnvelope('qing-task:test-envelope', validateString)).toBeNull()
  })

  it('带过期的信封读取：过期时清理并返回 null', () => {
    writeEnvelope('qing-task:test-fresh', 'draft-content')
    expect(readEnvelopeFresh('qing-task:test-fresh', validateString, 1000)?.value).toBe('draft-content')

    const stale = { version: 1, savedAt: Date.now() - 5000, value: 'old' }
    writeJSON('qing-task:test-fresh', stale)
    expect(readEnvelopeFresh('qing-task:test-fresh', validateString, 1000)).toBeNull()
    expect(localStorage.getItem('qing-task:test-fresh')).toBeNull()
  })

  it('写入失败（配额/隐私模式）静默降级为 false', () => {
    const setItem = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError')
    })
    expect(writeRaw('qing-task:test-fail', 'x')).toBe(false)
    expect(writeJSON('qing-task:test-fail', { x: 1 })).toBe(false)
    expect(writeEnvelope('qing-task:test-fail', 1)).toBe(false)
    setItem.mockRestore()
    removeStored('qing-task:test-fail')
  })
})
