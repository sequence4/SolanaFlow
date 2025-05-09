DROP TRIGGER IF EXISTS update_solana_project_last_updated ON SolanaProject;
DROP TRIGGER IF EXISTS update_project_file_last_updated   ON ProjectFile;
DROP TRIGGER IF EXISTS update_task_last_updated           ON Task;

DROP FUNCTION IF EXISTS update_last_updated_column();

DROP TABLE IF EXISTS warm_container_pool;
DROP TABLE IF EXISTS Task;
DROP TABLE IF EXISTS ProjectFile;
DROP TABLE IF EXISTS SolanaProject;
DROP TABLE IF EXISTS Creator;
DROP TABLE IF EXISTS Organisation;


CREATE TABLE Organisation (
    id          UUID PRIMARY KEY,
    name        TEXT NOT NULL,
    description TEXT,
    created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_organisation_name ON Organisation (name);


CREATE TABLE Creator (
    id            UUID PRIMARY KEY,
    username      TEXT NOT NULL,
    profile       JSONB,
    password      TEXT NOT NULL,
    org_id        UUID REFERENCES Organisation(id),
    role          TEXT CHECK (role IN ('member', 'admin')),
    openAiApiKey  TEXT
);
CREATE INDEX idx_creator_username ON Creator (username);
CREATE INDEX idx_creator_org_id   ON Creator (org_id);


CREATE TABLE SolanaProject (
    id             UUID PRIMARY KEY,
    name           TEXT NOT NULL,
    description    TEXT,
    org_id         UUID REFERENCES Organisation(id),
    root_path      TEXT,
    details        JSONB,
    container_name TEXT,
    container_url  TEXT,
    last_updated   TIMESTAMP,
    created_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_solana_project_name   ON SolanaProject (name);
CREATE INDEX idx_solana_project_org_id ON SolanaProject (org_id);


CREATE TABLE ProjectFile (
    id           UUID PRIMARY KEY,
    name         TEXT NOT NULL,
    file_path    TEXT NOT NULL,
    file_size    BIGINT,
    file_hash    TEXT,
    last_updated TIMESTAMP,
    created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_project_file_name ON ProjectFile (name);
CREATE INDEX idx_project_file_path ON ProjectFile (file_path);


CREATE TABLE Task (
    id           UUID PRIMARY KEY,
    name         TEXT NOT NULL,
    created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    creator_id   UUID REFERENCES Creator(id),
    result       TEXT,
    last_updated TIMESTAMP,
    project_id   UUID REFERENCES SolanaProject(id) ON DELETE CASCADE,
    status       VARCHAR(50) CHECK (status IN ('queued', 'doing', 'finished',
                                               'succeed', 'failed', 'warning'))
);
CREATE INDEX idx_task_creator_id ON Task (creator_id);
CREATE INDEX idx_task_status     ON Task (status);


CREATE TABLE warm_container_pool (
    name       TEXT PRIMARY KEY,
    image      TEXT NOT NULL, 
    last_used  TIMESTAMPTZ DEFAULT NOW(),
    busy       BOOLEAN DEFAULT FALSE 
);
CREATE INDEX idx_warm_pool_busy_lastused
        ON warm_container_pool (busy, last_used DESC);


CREATE OR REPLACE FUNCTION update_last_updated_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.last_updated = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_solana_project_last_updated
BEFORE UPDATE ON SolanaProject
FOR EACH ROW
EXECUTE FUNCTION update_last_updated_column();

CREATE TRIGGER update_project_file_last_updated
BEFORE UPDATE ON ProjectFile
FOR EACH ROW
EXECUTE FUNCTION update_last_updated_column();

CREATE TRIGGER update_task_last_updated
BEFORE UPDATE ON Task
FOR EACH ROW
EXECUTE FUNCTION update_last_updated_column();
