ALTER TABLE prompt_jobs MODIFY COLUMN kind ENUM('simulation', 'character', 'resolution', 'narration', 'case_setup') NOT NULL;
