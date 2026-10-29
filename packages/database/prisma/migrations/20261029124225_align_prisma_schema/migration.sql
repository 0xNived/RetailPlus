-- DropForeignKey
ALTER TABLE "audit_logs" DROP CONSTRAINT "audit_logs_actor_id_fkey";

-- DropForeignKey
ALTER TABLE "audit_logs" DROP CONSTRAINT "audit_logs_workspace_id_fkey";

-- DropForeignKey
ALTER TABLE "cleaning_runs" DROP CONSTRAINT "cleaning_runs_dataset_id_fkey";

-- DropForeignKey
ALTER TABLE "cleaning_runs" DROP CONSTRAINT "cleaning_runs_started_by_id_fkey";

-- DropForeignKey
ALTER TABLE "dashboard_widgets" DROP CONSTRAINT "dashboard_widgets_dashboard_id_fkey";

-- DropForeignKey
ALTER TABLE "dashboards" DROP CONSTRAINT "dashboards_created_by_id_fkey";

-- DropForeignKey
ALTER TABLE "dashboards" DROP CONSTRAINT "dashboards_workspace_id_fkey";

-- DropForeignKey
ALTER TABLE "data_quality_issues" DROP CONSTRAINT "data_quality_issues_dataset_id_fkey";

-- DropForeignKey
ALTER TABLE "dataset_profiles" DROP CONSTRAINT "dataset_profiles_dataset_id_fkey";

-- DropForeignKey
ALTER TABLE "datasets" DROP CONSTRAINT "datasets_import_job_id_fkey";

-- DropForeignKey
ALTER TABLE "datasets" DROP CONSTRAINT "datasets_workspace_id_fkey";

-- DropForeignKey
ALTER TABLE "export_jobs" DROP CONSTRAINT "export_jobs_dataset_id_fkey";

-- DropForeignKey
ALTER TABLE "export_jobs" DROP CONSTRAINT "export_jobs_workspace_id_fkey";

-- DropForeignKey
ALTER TABLE "import_jobs" DROP CONSTRAINT "import_jobs_created_by_id_fkey";

-- DropForeignKey
ALTER TABLE "import_jobs" DROP CONSTRAINT "import_jobs_workspace_id_fkey";

-- DropForeignKey
ALTER TABLE "memberships" DROP CONSTRAINT "memberships_user_id_fkey";

-- DropForeignKey
ALTER TABLE "memberships" DROP CONSTRAINT "memberships_workspace_id_fkey";

-- DropForeignKey
ALTER TABLE "source_files" DROP CONSTRAINT "source_files_import_job_id_fkey";

-- DropForeignKey
ALTER TABLE "transformations" DROP CONSTRAINT "transformations_created_by_id_fkey";

-- DropForeignKey
ALTER TABLE "transformations" DROP CONSTRAINT "transformations_dataset_id_fkey";

-- DropIndex
DROP INDEX "audit_logs_workspace_created_at_idx";

-- DropIndex
DROP INDEX "cleaning_runs_dataset_status_created_at_idx";

-- DropIndex
DROP INDEX "dashboards_workspace_updated_at_idx";

-- DropIndex
DROP INDEX "datasets_workspace_status_updated_at_idx";

-- DropIndex
DROP INDEX "export_jobs_workspace_status_created_at_idx";

-- DropIndex
DROP INDEX "import_jobs_workspace_status_created_at_idx";

-- DropIndex
DROP INDEX "transformations_dataset_created_at_idx";

-- AlterTable
ALTER TABLE "audit_logs" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "cleaning_runs" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "dashboard_widgets" ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "dashboards" ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "data_quality_issues" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "dataset_profiles" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "datasets" ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "export_jobs" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "import_jobs" ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "source_files" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "transformations" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "users" ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "workspaces" ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "updated_at" DROP DEFAULT;

-- CreateIndex
CREATE INDEX "audit_logs_workspace_id_created_at_idx" ON "audit_logs"("workspace_id", "created_at");

-- CreateIndex
CREATE INDEX "cleaning_runs_dataset_id_status_created_at_idx" ON "cleaning_runs"("dataset_id", "status", "created_at");

-- CreateIndex
CREATE INDEX "dashboards_workspace_id_updated_at_idx" ON "dashboards"("workspace_id", "updated_at");

-- CreateIndex
CREATE INDEX "datasets_workspace_id_status_updated_at_idx" ON "datasets"("workspace_id", "status", "updated_at");

-- CreateIndex
CREATE INDEX "export_jobs_workspace_id_status_created_at_idx" ON "export_jobs"("workspace_id", "status", "created_at");

-- CreateIndex
CREATE INDEX "import_jobs_workspace_id_status_created_at_idx" ON "import_jobs"("workspace_id", "status", "created_at");

-- CreateIndex
CREATE INDEX "transformations_dataset_id_created_at_idx" ON "transformations"("dataset_id", "created_at");

-- AddForeignKey
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "import_jobs" ADD CONSTRAINT "import_jobs_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "import_jobs" ADD CONSTRAINT "import_jobs_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "source_files" ADD CONSTRAINT "source_files_import_job_id_fkey" FOREIGN KEY ("import_job_id") REFERENCES "import_jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "datasets" ADD CONSTRAINT "datasets_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "datasets" ADD CONSTRAINT "datasets_import_job_id_fkey" FOREIGN KEY ("import_job_id") REFERENCES "import_jobs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dataset_profiles" ADD CONSTRAINT "dataset_profiles_dataset_id_fkey" FOREIGN KEY ("dataset_id") REFERENCES "datasets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "data_quality_issues" ADD CONSTRAINT "data_quality_issues_dataset_id_fkey" FOREIGN KEY ("dataset_id") REFERENCES "datasets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cleaning_runs" ADD CONSTRAINT "cleaning_runs_dataset_id_fkey" FOREIGN KEY ("dataset_id") REFERENCES "datasets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cleaning_runs" ADD CONSTRAINT "cleaning_runs_started_by_id_fkey" FOREIGN KEY ("started_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transformations" ADD CONSTRAINT "transformations_dataset_id_fkey" FOREIGN KEY ("dataset_id") REFERENCES "datasets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transformations" ADD CONSTRAINT "transformations_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dashboards" ADD CONSTRAINT "dashboards_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dashboards" ADD CONSTRAINT "dashboards_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dashboard_widgets" ADD CONSTRAINT "dashboard_widgets_dashboard_id_fkey" FOREIGN KEY ("dashboard_id") REFERENCES "dashboards"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "export_jobs" ADD CONSTRAINT "export_jobs_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "export_jobs" ADD CONSTRAINT "export_jobs_dataset_id_fkey" FOREIGN KEY ("dataset_id") REFERENCES "datasets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- RenameIndex
ALTER INDEX "data_quality_issues_dataset_severity_resolved_idx" RENAME TO "data_quality_issues_dataset_id_severity_resolved_at_idx";
