CREATE TABLE retail_dataset_state (
    dataset_id UUID PRIMARY KEY REFERENCES datasets(id) ON DELETE CASCADE,
    mapping JSONB NOT NULL DEFAULT '{}',
    revision INTEGER NOT NULL DEFAULT 0,
    model JSONB,
    model_revision INTEGER,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE dataset_versions (
    id UUID PRIMARY KEY,
    dataset_id UUID NOT NULL REFERENCES datasets(id) ON DELETE CASCADE,
    revision INTEGER NOT NULL,
    reason TEXT NOT NULL,
    csv_path TEXT NOT NULL,
    parquet_path TEXT NOT NULL,
    checksum TEXT NOT NULL,
    changes JSONB NOT NULL DEFAULT '[]',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(dataset_id, revision)
);
CREATE TABLE retail_customers (
    dataset_id UUID NOT NULL REFERENCES datasets(id) ON DELETE CASCADE,
    customer_id TEXT NOT NULL,
    revision INTEGER NOT NULL,
    document JSONB NOT NULL,
    PRIMARY KEY(dataset_id, customer_id)
);
CREATE INDEX retail_customers_document_idx ON retail_customers USING GIN(document);
CREATE TABLE retail_pipeline_jobs (
    id UUID PRIMARY KEY,
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    dataset_id UUID REFERENCES datasets(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'Running',
    stages JSONB NOT NULL DEFAULT '[]',
    error TEXT,
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ
);
CREATE UNIQUE INDEX retail_one_running_job ON retail_pipeline_jobs(workspace_id) WHERE status = 'Running';
