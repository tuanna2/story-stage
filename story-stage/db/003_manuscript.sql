ALTER TABLE prompt_jobs MODIFY COLUMN kind ENUM('simulation', 'character', 'resolution', 'narration', 'case_setup', 'rewrite') NOT NULL;

CREATE TABLE IF NOT EXISTS manuscript_events (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  project_id VARCHAR(80) NOT NULL,
  revision INT UNSIGNED NOT NULL,
  action VARCHAR(24) NOT NULL,
  payload JSON NOT NULL,
  created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  CONSTRAINT fk_manuscript_project FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
  UNIQUE KEY uq_manuscript_revision (project_id, revision)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
