CREATE TABLE IF NOT EXISTS assignments (id TEXT PRIMARY KEY, teacher TEXT NOT NULL REFERENCES users(id), title TEXT NOT NULL, created INTEGER NOT NULL);
CREATE INDEX IF NOT EXISTS assignments_teacher ON assignments(teacher, created);
ALTER TABLE submissions ADD COLUMN assignment_id TEXT REFERENCES assignments(id);
