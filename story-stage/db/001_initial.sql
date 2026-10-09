CREATE TABLE IF NOT EXISTS projects (
  id VARCHAR(80) PRIMARY KEY,
  name VARCHAR(120) NOT NULL,
  revision INT UNSIGNED NOT NULL DEFAULT 0,
  payload JSON NOT NULL,
  created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS prompt_jobs (
  id VARCHAR(80) PRIMARY KEY,
  project_id VARCHAR(80) NOT NULL,
  base_revision INT UNSIGNED NOT NULL,
  kind ENUM('simulation','character','resolution','narration') NOT NULL,
  status ENUM('pending','consumed','cancelled') NOT NULL,
  prompt LONGTEXT NOT NULL,
  raw_response LONGTEXT NULL,
  parsed_response JSON NULL,
  created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  CONSTRAINT fk_job_project FOREIGN KEY (project_id) REFERENCES projects(id),
  INDEX idx_project_jobs (project_id, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS simulation_events (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  project_id VARCHAR(80) NOT NULL,
  revision INT UNSIGNED NOT NULL,
  exchange_id VARCHAR(80) NOT NULL,
  payload JSON NOT NULL,
  created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  CONSTRAINT fk_event_project FOREIGN KEY (project_id) REFERENCES projects(id),
  UNIQUE KEY uq_project_revision (project_id, revision)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
