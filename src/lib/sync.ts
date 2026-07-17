import { examStorage, type SyncSnapshot } from './storage'

const endpoint = '/api/sync'
const syncTimeoutMs = 12_000

export class SyncNotFoundError extends Error {}

const messageFrom = async (response: Response) => {
  const body = await response.json().catch(() => null) as { error?: string } | null
  return body?.error || '同步服务暂时不可用，请稍后重试。'
}

export const normalizeSyncCode = (value: string) => value.replace(/\D/g, '').slice(0, 6)
export const validSyncCode = (value: string) => /^\d{4,6}$/.test(value)

const requestSync = async (input: RequestInfo | URL, init?: RequestInit) => {
  try {
    return await fetch(input, { ...init, signal: AbortSignal.timeout(syncTimeoutMs) })
  } catch (error) {
    if (error instanceof DOMException && error.name === 'TimeoutError') {
      throw new Error('连接同步服务超时。请检查网络后重试。')
    }
    throw new Error('无法连接同步服务。请检查网络后重试。')
  }
}

export const pushSnapshot = async (code: string) => {
  const response = await requestSync(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code, snapshot: examStorage.createSyncSnapshot() }),
  })
  if (!response.ok) throw new Error(await messageFrom(response))
}

export const pullSnapshot = async (code: string): Promise<SyncSnapshot> => {
  const response = await requestSync(`${endpoint}?code=${encodeURIComponent(code)}`, { cache: 'no-store' })
  if (response.status === 404) throw new SyncNotFoundError()
  if (!response.ok) throw new Error(await messageFrom(response))
  return await response.json() as SyncSnapshot
}
