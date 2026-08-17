CREATE TABLE learning_ai_guides (
  id TEXT PRIMARY KEY NOT NULL,
  user_id TEXT NOT NULL,
  learning_item_id TEXT NOT NULL,
  source_hash TEXT NOT NULL,
  content TEXT NOT NULL,
  model TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  CONSTRAINT learning_ai_guides_user_fk FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT learning_ai_guides_item_fk FOREIGN KEY (learning_item_id) REFERENCES learning_items(id) ON DELETE CASCADE,
  CONSTRAINT learning_ai_guides_user_item_uidx UNIQUE (user_id, learning_item_id)
);

CREATE INDEX learning_ai_guides_item_idx ON learning_ai_guides(learning_item_id);
