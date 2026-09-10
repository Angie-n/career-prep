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

export type UserStateRow = {
  stateJson: string
  updatedAt: string
}

export async function getUserState(db: D1Database, userId: string): Promise<UserStateRow | null> {
  const row = await db
    .prepare(`SELECT state_json, updated_at FROM user_state WHERE user_id = ?`)
    .bind(userId)
    .first<{ state_json: string; updated_at: string }>()

  if (!row) return null
  return { stateJson: row.state_json, updatedAt: row.updated_at }
}

export async function putUserState(
  db: D1Database,
  userId: string,
  stateJson: string,
  updatedAt: string,
): Promise<void> {
  await db
    .prepare(
      `INSERT INTO user_state (user_id, state_json, updated_at)
       VALUES (?, ?, ?)
       ON CONFLICT(user_id) DO UPDATE SET
         state_json = excluded.state_json,
         updated_at = excluded.updated_at`,
    )
    .bind(userId, stateJson, updatedAt)
    .run()
}
