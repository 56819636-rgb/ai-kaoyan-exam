import { describe, expect, it } from 'vitest'
import { normalizeSyncCode, validSyncCode } from './sync'

describe('同步码', () => {
  it('只保留数字，并限制为六位', () => {
    expect(normalizeSyncCode(' 12a3-456789 ')).toBe('123456')
  })

  it('只接受四至六位数字', () => {
    expect(validSyncCode('1234')).toBe(true)
    expect(validSyncCode('123456')).toBe(true)
    expect(validSyncCode('123')).toBe(false)
    expect(validSyncCode('1234567')).toBe(false)
    expect(validSyncCode('12a4')).toBe(false)
  })
})
