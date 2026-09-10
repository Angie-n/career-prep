import { bearerToken, verifyGoogleIdToken } from './auth'
import { getUser, getUserState, putUserState, upsertUser } from './db'

export type Env = {
  DB: D1Database
  ASSETS: Fetcher
  GOOGLE_CLIENT_ID: string
}

function json(data: unknown, init: ResponseInit = {}): Response {
  const headers = new Headers(init.headers)
  headers.set('Content-Type', 'application/json; charset=utf-8')
  return new Response(JSON.stringify(data), { ...init, headers })
}

async function requireUser(request: Request, env: Env) {
  const token = bearerToken(request)
  if (!token) {
    return { error: json({ error: 'Missing Bearer token.' }, { status: 401 }) }
  }
  try {
    const identity = await verifyGoogleIdToken(token, env.GOOGLE_CLIENT_ID)
    const user = await upsertUser(env.DB, identity)
    return { user }
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Invalid token.'
    return { error: json({ error: message }, { status: 401 }) }
  }
}

export default {
  async fetch(request: Request, env: Env, _ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url)

    if (url.pathname === '/api/health' && request.method === 'GET') {
      return json({ ok: true })
    }

    if (url.pathname === '/api/me') {
      if (request.method !== 'GET' && request.method !== 'POST') {
        return json({ error: 'Method not allowed.' }, { status: 405 })
      }
      const result = await requireUser(request, env)
      if ('error' in result && result.error) return result.error
      const { user } = result as { user: Awaited<ReturnType<typeof upsertUser>> }
      const stored = await getUser(env.DB, user.id)
      return json({ user: stored ?? user })
    }

    if (url.pathname === '/api/state') {
      const result = await requireUser(request, env)
      if ('error' in result && result.error) return result.error
      const { user } = result as { user: Awaited<ReturnType<typeof upsertUser>> }

      if (request.method === 'GET') {
        const row = await getUserState(env.DB, user.id)
        if (!row) return json({ state: null, updatedAt: null })
        let state: unknown
        try {
          state = JSON.parse(row.stateJson)
        } catch {
          return json({ error: 'Stored state is not valid JSON.' }, { status: 500 })
        }
        return json({ state, updatedAt: row.updatedAt })
      }

      if (request.method === 'PUT') {
        let body: { state?: unknown; updatedAt?: unknown }
        try {
          body = (await request.json()) as { state?: unknown; updatedAt?: unknown }
        } catch {
          return json({ error: 'Invalid JSON body.' }, { status: 400 })
        }
        if (!body.state || typeof body.state !== 'object' || Array.isArray(body.state)) {
          return json({ error: 'Body must include a state object.' }, { status: 400 })
        }
        const updatedAt =
          typeof body.updatedAt === 'string' && body.updatedAt
            ? body.updatedAt
            : new Date().toISOString()
        const stateJson = JSON.stringify(body.state)
        // Soft guard against accidental huge payloads (audio stays in IndexedDB).
        if (stateJson.length > 2_500_000) {
          return json({ error: 'State payload too large.' }, { status: 413 })
        }
        await putUserState(env.DB, user.id, stateJson, updatedAt)
        return json({ ok: true, updatedAt })
      }

      return json({ error: 'Method not allowed.' }, { status: 405 })
    }

    if (url.pathname.startsWith('/api/')) {
      return json({ error: 'Not found.' }, { status: 404 })
    }

    return env.ASSETS.fetch(request)
  },
}
