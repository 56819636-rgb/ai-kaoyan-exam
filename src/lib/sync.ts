import { examStorage, type SyncSnapshot } from './storage'

const endpoint = '/api/sync'

export class SyncNotFoundError extends Error {}

const messageFrom = async (response: Response) => {
  const body = await response.json().catch(() => null) as { error?: string } | null
  return body?.error || '同步服务暂时不可用，请稍后重试。'
}

export const normalizeSyncCode = (value: string) => value.replace(/\D/g, '').slice(0, 6)
export const validSyncCode = (value: string) => /^\d{4,6}$/.test(value)

export const pushSnapshot = async (code: string) => {
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code, snapshot: examStorage.createSyncSnapshot() }),
  })
  if (!response.ok) throw new Error(await messageFrom(response))
}

export const pullSnapshot = async (code: string): Promise<SyncSnapshot> => {
  const response = await fetch(`${endpoint}?code=${encodeURIComponent(code)}`, { cache: 'no-store' })
  if (response.status === 404) throw new SyncNotFoundError()
  if (!response.ok) throw new Error(await messageFrom(response))
  return await response.json() as SyncSnapshot
}
