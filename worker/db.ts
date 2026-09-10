import type { AuthedUser } from './auth'

export async function upsertUser(db: D1Database, user: AuthedUser): Promise<AuthedUser> {
  const now = new Date().toISOString()
  await db
    .prepare(
      `INSERT INTO users (id, email, name, picture, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         email = excluded.email,
         name = excluded.name,
         picture = excluded.picture,
         updated_at = excluded.updated_at`,
    )
    .bind(user.id, user.email, user.name, user.picture, now, now)
    .run()

  return user
}

export async function getUser(db: D1Database, id: string): Promise<AuthedUser | null> {
  const row = await db
    .prepare(`SELECT id, email, name, picture FROM users WHERE id = ?`)
    .bind(id)
    .first<{ id: string; email: string | null; name: string | null; picture: string | null }>()

  if (!row) return null
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    picture: row.picture,
  }
}
