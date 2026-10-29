CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "citext";

CREATE TYPE user_role AS ENUM ('ADMIN', 'ANALYST', 'MEMBER', 'VIEWER');
CREATE TYPE import_status AS ENUM ('QUEUED', 'UPLOADING', 'PROFILING', 'NEEDS_REVIEW', 'READY', 'FAILED', 'CANCELLED');
CREATE TYPE dataset_status AS ENUM ('DRAFT', 'READY', 'ARCHIVED');
CREATE TYPE source_kind AS ENUM ('CSV', 'EXCEL', 'PDF', 'DOCX', 'PNG', 'JPEG');
CREATE TYPE issue_severity AS ENUM ('INFO', 'WARNING', 'ERROR');
CREATE TYPE run_status AS ENUM ('QUEUED', 'RUNNING', 'SUCCEEDED', 'FAILED', 'CANCELLED');
CREATE TYPE export_format AS ENUM ('CSV', 'PDF', 'JSON');

CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email CITEXT NOT NULL UNIQUE,
  password_hash TEXT,
  display_name TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE workspaces (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE memberships (
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role user_role NOT NULL DEFAULT 'MEMBER',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (workspace_id, user_id)
);

CREATE TABLE import_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  created_by_id UUID NOT NULL REFERENCES users(id),
  status import_status NOT NULL DEFAULT 'QUEUED',
  name TEXT NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE source_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  import_job_id UUID NOT NULL REFERENCES import_jobs(id) ON DELETE CASCADE,
  kind source_kind NOT NULL,
  original_name TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  byte_size BIGINT NOT NULL CHECK (byte_size >= 0),
  storage_key TEXT NOT NULL UNIQUE,
  checksum TEXT,
  extraction JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE datasets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  import_job_id UUID REFERENCES import_jobs(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  description TEXT,
  status dataset_status NOT NULL DEFAULT 'DRAFT',
  schema JSONB NOT NULL DEFAULT '{}'::jsonb,
  record_count BIGINT CHECK (record_count IS NULL OR record_count >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE dataset_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dataset_id UUID NOT NULL UNIQUE REFERENCES datasets(id) ON DELETE CASCADE,
  summary JSONB NOT NULL DEFAULT '{}'::jsonb,
  health_score INTEGER CHECK (health_score IS NULL OR health_score BETWEEN 0 AND 100),
  profiled_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE data_quality_issues (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dataset_id UUID NOT NULL REFERENCES datasets(id) ON DELETE CASCADE,
  severity issue_severity NOT NULL,
  code TEXT NOT NULL,
  column_name TEXT,
  description TEXT NOT NULL,
  affected_rows BIGINT CHECK (affected_rows IS NULL OR affected_rows >= 0),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE cleaning_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dataset_id UUID NOT NULL REFERENCES datasets(id) ON DELETE CASCADE,
  started_by_id UUID NOT NULL REFERENCES users(id),
  status run_status NOT NULL DEFAULT 'QUEUED',
  rules JSONB NOT NULL DEFAULT '[]'::jsonb,
  summary JSONB NOT NULL DEFAULT '{}'::jsonb,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE transformations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dataset_id UUID NOT NULL REFERENCES datasets(id) ON DELETE CASCADE,
  created_by_id UUID NOT NULL REFERENCES users(id),
  name TEXT NOT NULL,
  definition JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE dashboards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  created_by_id UUID NOT NULL REFERENCES users(id),
  name TEXT NOT NULL,
  description TEXT,
  layout JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE dashboard_widgets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dashboard_id UUID NOT NULL REFERENCES dashboards(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,
  title TEXT NOT NULL,
  position JSONB NOT NULL,
  config JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE export_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  dataset_id UUID REFERENCES datasets(id) ON DELETE SET NULL,
  format export_format NOT NULL,
  status run_status NOT NULL DEFAULT 'QUEUED',
  storage_key TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  actor_id UUID REFERENCES users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX memberships_user_id_idx ON memberships(user_id);
CREATE INDEX import_jobs_workspace_status_created_at_idx ON import_jobs(workspace_id, status, created_at DESC);
CREATE INDEX source_files_import_job_id_idx ON source_files(import_job_id);
CREATE INDEX datasets_workspace_status_updated_at_idx ON datasets(workspace_id, status, updated_at DESC);
CREATE INDEX data_quality_issues_dataset_severity_resolved_idx ON data_quality_issues(dataset_id, severity, resolved_at);
CREATE INDEX cleaning_runs_dataset_status_created_at_idx ON cleaning_runs(dataset_id, status, created_at DESC);
CREATE INDEX transformations_dataset_created_at_idx ON transformations(dataset_id, created_at DESC);
CREATE INDEX dashboards_workspace_updated_at_idx ON dashboards(workspace_id, updated_at DESC);
CREATE INDEX dashboard_widgets_dashboard_id_idx ON dashboard_widgets(dashboard_id);
CREATE INDEX export_jobs_workspace_status_created_at_idx ON export_jobs(workspace_id, status, created_at DESC);
CREATE INDEX audit_logs_workspace_created_at_idx ON audit_logs(workspace_id, created_at DESC);
CREATE INDEX audit_logs_entity_type_entity_id_idx ON audit_logs(entity_type, entity_id);
