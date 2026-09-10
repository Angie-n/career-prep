-- One AppState JSON blob per Google user (studio:v1 equivalent).
CREATE TABLE IF NOT EXISTS user_state (
  user_id TEXT PRIMARY KEY NOT NULL REFERENCES users(id),
  state_json TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
