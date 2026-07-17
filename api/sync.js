import { createHash } from 'node:crypto'
import { get, put } from '@vercel/blob'

const codeFrom = (value) => typeof value === 'string' && /^\d{4,6}$/.test(value) ? value : null
const pathnameFor = (code) => `ai-kaoyan-sync/${createHash('sha256').update(`ai-kaoyan:${code}`).digest('hex')}.json`
const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } })

export default async function handler(request) {
  try {
    if (request.method === 'GET') {
      const code = codeFrom(new URL(request.url).searchParams.get('code'))
      if (!code) return json({ error: '同步码需要是 4 至 6 位数字。' }, 400)
      const saved = await get(pathnameFor(code), { access: 'private', useCache: false })
      if (!saved) return json({ error: '还没有云端数据。' }, 404)
      return new Response(saved.stream, { headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } })
    }

    if (request.method !== 'POST') return json({ error: '不支持的请求方式。' }, 405)
    const { code, snapshot } = await request.json()
    const validCode = codeFrom(code)
    if (!validCode) return json({ error: '同步码需要是 4 至 6 位数字。' }, 400)
    if (!snapshot || snapshot.version !== 1) return json({ error: '同步数据格式不正确，请更新网站后重试。' }, 400)
    const content = JSON.stringify(snapshot)
    if (new TextEncoder().encode(content).byteLength > 4 * 1024 * 1024) return json({ error: '同步数据超过 4MB，请先删除不需要的历史记录。' }, 413)
    await put(pathnameFor(validCode), content, { access: 'private', addRandomSuffix: false, allowOverwrite: true, contentType: 'application/json', cacheControlMaxAge: 0 })
    return json({ ok: true })
  } catch (error) {
    console.error('sync-api', error)
    return json({ error: '同步服务器尚未配置。请在 Vercel 项目中创建并连接 Blob 存储后重试。' }, 503)
  }
}
