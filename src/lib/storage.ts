/**
 * 本地持久化统一入口：项目内所有 localStorage 读写都必须经过本模块。
 *
 * 分层约定（新项目代码遵守同一标准）：
 * - 跨设备数据（任务、标签、日志、偏好）→ Firestore（persistentLocalCache 自带离线兜底）；
 * - 可分享的视图状态（看板、时间范围、标签筛选）→ URL；
 * - 设备级偏好 / 草稿 / 数据缓存 → 本模块（localStorage）；
 * - 瞬态状态（撤销窗口、手势）→ 内存。
 *
 * 健壮性标准：
 * - 所有写入 try/catch（隐私模式 / 配额满时静默降级，返回是否成功）；
 * - 所有读取必须提供校验器，形状不符返回 null，绝不把脏数据抛给调用方；
 * - 草稿与缓存使用信封格式（version + savedAt），支持新鲜度提示与过期清理。
 */

const KEY_PREFIX = 'qing-task'

/** 键名统一登记，避免散落的字符串拼接。 */
export const storageKeys = {
  utilityPanel: `${KEY_PREFIX}:utility-panel`,
  swipeHint: `${KEY_PREFIX}:swipe-hint`,
  analyticsUi: `${KEY_PREFIX}:analytics-ui`,
  draftFor: (owner: string, kind: string) => `${KEY_PREFIX}:draft:${owner}:${kind}`,
  analyticsCacheFor: (userId: string) => `${KEY_PREFIX}:analytics-cache:${userId}`,
}

export type Validator<T> = (value: unknown) => T | null

/* ------------------------------------------------------------------ */
/* 原始字符串：简单标记位（如面板折叠、提示已关闭）                      */
/* ------------------------------------------------------------------ */

export function readRaw(key: string): string | null {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

export function writeRaw(key: string, value: string): boolean {
  try {
    localStorage.setItem(key, value)
    return true
  } catch {
    return false
  }
}

export function removeStored(key: string): void {
  try {
    localStorage.removeItem(key)
  } catch {
    // 删除失败不影响功能，忽略
  }
}

/* ------------------------------------------------------------------ */
/* JSON：带校验的结构化读取                                             */
/* ------------------------------------------------------------------ */

export function readJSON<T>(key: string, validate: Validator<T>): T | null {
  const raw = readRaw(key)
  if (raw === null) return null
  try {
    return validate(JSON.parse(raw))
  } catch {
    return null
  }
}

export function writeJSON(key: string, value: unknown): boolean {
  try {
    localStorage.setItem(key, JSON.stringify(value))
    return true
  } catch {
    return false
  }
}

/* ------------------------------------------------------------------ */
/* 信封格式：version + savedAt，用于草稿与缓存                          */
/* ------------------------------------------------------------------ */

export interface StorageEnvelope<T> {
  version: 1
  savedAt: number
  value: T
}

export function readEnvelope<T>(
  key: string,
  validate: Validator<T>,
): { value: T; savedAt: number } | null {
  return readJSON(key, (raw): { value: T; savedAt: number } | null => {
    if (!raw || typeof raw !== 'object') return null
    const envelope = raw as Partial<StorageEnvelope<unknown>>
    if (envelope.version !== 1 || typeof envelope.savedAt !== 'number') return null
    const value = validate(envelope.value)
    return value === null ? null : { value, savedAt: envelope.savedAt }
  })
}

export function writeEnvelope<T>(key: string, value: T): boolean {
  return writeJSON(key, { version: 1, savedAt: Date.now(), value } satisfies StorageEnvelope<T>)
}

/** 带过期时间的信封读取：过期时顺手清理并返回 null。 */
export function readEnvelopeFresh<T>(
  key: string,
  validate: Validator<T>,
  ttlMs: number,
): { value: T; savedAt: number } | null {
  const enveloped = readEnvelope(key, validate)
  if (!enveloped) return null
  if (Date.now() - enveloped.savedAt > ttlMs) {
    removeStored(key)
    return null
  }
  return enveloped
}
