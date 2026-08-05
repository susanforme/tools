CREATE TABLE favorites (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tool_path TEXT NOT NULL,
  sort_order INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (user_id, tool_path)
);

CREATE INDEX favorites_user_order_idx
  ON favorites(user_id, sort_order);
