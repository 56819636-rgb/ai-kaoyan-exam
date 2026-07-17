import { createHash } from 'node:crypto'
import { get, put } from '@vercel/blob'

export const config = { maxDuration: 10 }

const codeFrom = (value) => typeof value === 'string' && /^\d{4,6}$/.test(value) ? value : null
const pathnameFor = (code) => `ai-kaoyan-sync/${createHash('sha256').update(`ai-kaoyan:${code}`).digest('hex')}.json`

const send = (response, body, status = 200) => {
  response.status(status)
  response.setHeader('Content-Type', 'application/json; charset=utf-8')
  response.setHeader('Cache-Control', 'no-store')
  response.json(body)
}

const jsonBody = (body) => {
  if (typeof body === 'string') return JSON.parse(body)
  return body
}

// Vercel's Node function signature keeps this endpoint compatible with Vite
// deployments and avoids relying on framework-specific Request adapters.
export default async function handler(request, response) {
  try {
    if (request.method === 'GET') {
      const code = codeFrom(request.query?.code)
      if (!code) return send(response, { error: '同步码需要是 4 至 6 位数字。' }, 400)
      const saved = await get(pathnameFor(code), { access: 'private', useCache: false })
      if (!saved) return send(response, { error: '还没有云端数据。' }, 404)
      const content = await new Response(saved.stream).text()
      response.status(200)
      response.setHeader('Content-Type', 'application/json; charset=utf-8')
      response.setHeader('Cache-Control', 'no-store')
      return response.send(content)
    }

    if (request.method !== 'POST') return send(response, { error: '不支持的请求方式。' }, 405)
    const { code, snapshot } = jsonBody(request.body) ?? {}
    const validCode = codeFrom(code)
    if (!validCode) return send(response, { error: '同步码需要是 4 至 6 位数字。' }, 400)
    if (!snapshot || snapshot.version !== 1) return send(response, { error: '同步数据格式不正确，请更新网站后重试。' }, 400)
    const content = JSON.stringify(snapshot)
    if (new TextEncoder().encode(content).byteLength > 4 * 1024 * 1024) return send(response, { error: '同步数据超过 4MB，请先删除不需要的历史记录。' }, 413)
    await put(pathnameFor(validCode), content, { access: 'private', addRandomSuffix: false, allowOverwrite: true, contentType: 'application/json', cacheControlMaxAge: 0 })
    return send(response, { ok: true })
  } catch (error) {
    console.error('sync-api', error)
    return send(response, { error: '同步服务器暂时不可用，请稍后重试。' }, 503)
  }
}
