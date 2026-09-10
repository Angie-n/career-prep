import { createRemoteJWKSet, jwtVerify } from 'jose'

const GOOGLE_JWKS = createRemoteJWKSet(new URL('https://www.googleapis.com/oauth2/v3/certs'))

export type AuthedUser = {
  id: string
  email: string | null
  name: string | null
  picture: string | null
}

export async function verifyGoogleIdToken(
  idToken: string,
  audience: string,
): Promise<AuthedUser> {
  if (!audience) {
    throw new Error('GOOGLE_CLIENT_ID is not configured on the Worker.')
  }

  const { payload } = await jwtVerify(idToken, GOOGLE_JWKS, {
    issuer: ['https://accounts.google.com', 'accounts.google.com'],
    audience,
  })

  const sub = payload.sub
  if (!sub || typeof sub !== 'string') {
    throw new Error('Invalid Google token: missing sub.')
  }

  return {
    id: sub,
    email: typeof payload.email === 'string' ? payload.email : null,
    name: typeof payload.name === 'string' ? payload.name : null,
    picture: typeof payload.picture === 'string' ? payload.picture : null,
  }
}

export function bearerToken(request: Request): string | null {
  const header = request.headers.get('Authorization')
  if (!header) return null
  const m = header.match(/^Bearer\s+(.+)$/i)
  return m?.[1]?.trim() || null
}
