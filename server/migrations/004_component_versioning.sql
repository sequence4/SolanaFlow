-- Component versioning and analytics tables for advanced component management

-- Component versions table
CREATE TABLE IF NOT EXISTS component_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id VARCHAR(255) NOT NULL,
  version VARCHAR(20) NOT NULL,
  hash VARCHAR(64) NOT NULL,
  files JSONB NOT NULL,
  metadata JSONB NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_by VARCHAR(255),
  status VARCHAR(20) DEFAULT 'draft',
  UNIQUE(project_id, version)
);

-- Version history tracking
CREATE TABLE IF NOT EXISTS version_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id VARCHAR(255) NOT NULL,
  from_version VARCHAR(20),
  to_version VARCHAR(20) NOT NULL,
  action VARCHAR(50) NOT NULL, -- 'upgrade', 'rollback', 'deploy'
  performed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  performed_by VARCHAR(255),
  metadata JSONB
);

-- AI generations tracking
CREATE TABLE IF NOT EXISTS ai_generations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id VARCHAR(255),
  component_code TEXT NOT NULL,
  description TEXT,
  context JSONB,
  metadata JSONB,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Component metrics for analytics
CREATE TABLE IF NOT EXISTS component_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id VARCHAR(255),
  type VARCHAR(50),
  timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  data JSONB
);

-- Component marketplace (future expansion)
CREATE TABLE IF NOT EXISTS marketplace_components (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  category VARCHAR(100),
  tags TEXT[],
  author VARCHAR(255),
  downloads INTEGER DEFAULT 0,
  rating DECIMAL(3,2),
  component_data JSONB,
  published_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_component_versions_project ON component_versions(project_id);
CREATE INDEX IF NOT EXISTS idx_component_versions_status ON component_versions(status);
CREATE INDEX IF NOT EXISTS idx_version_history_project ON version_history(project_id);
CREATE INDEX IF NOT EXISTS idx_ai_generations_project ON ai_generations(project_id);
CREATE INDEX IF NOT EXISTS idx_ai_generations_created ON ai_generations(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_component_metrics_project ON component_metrics(project_id);
CREATE INDEX IF NOT EXISTS idx_component_metrics_type ON component_metrics(type);
CREATE INDEX IF NOT EXISTS idx_component_metrics_timestamp ON component_metrics(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_marketplace_category ON marketplace_components(category);
CREATE INDEX IF NOT EXISTS idx_marketplace_author ON marketplace_components(author);