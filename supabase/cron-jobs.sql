-- Supabase Cron Job Configuration
-- Run this in Supabase SQL Editor to enable scheduled autopilot runs

-- Enable the pg_cron extension (if not already enabled)
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Grant usage to postgres user
GRANT USAGE ON SCHEMA cron TO postgres;

-- 1. Schedule Autopilot Initiator (Run Daily)
-- Starts new projects for channels based on frequency settings
SELECT cron.schedule(
    'autopilot-initiator',           -- job name
    '0 9 * * *',                 -- cron expression: 9 AM every day
    $$
    SELECT
        net.http_post(
            url := current_setting('app.settings.supabase_url') || '/functions/v1/autopilot-run',
            headers := jsonb_build_object(
                'Content-Type', 'application/json',
                'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
            ),
            body := '{}'::jsonb
        ) AS request_id;
    $$
);

-- 2. Schedule Autopilot Worker (Run Frequently)
-- Processes the pipeline stages (Scripting -> Audio -> Visuals -> Review)
-- Runs every 5 minutes to ensure steady progress
SELECT cron.schedule(
    'autopilot-worker',
    '*/5 * * * *',               -- Every 5 minutes
    $$
    SELECT
        net.http_post(
            url := current_setting('app.settings.supabase_url') || '/functions/v1/autopilot-worker',
            headers := jsonb_build_object(
                'Content-Type', 'application/json',
                'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
            ),
            body := '{}'::jsonb
        ) AS request_id;
    $$
);

-- View scheduled jobs
-- SELECT * FROM cron.job;

-- Remove a scheduled job (if needed)
-- SELECT cron.unschedule('autopilot-initiator');
-- SELECT cron.unschedule('autopilot-worker');

-- View job run history
-- SELECT * FROM cron.job_run_details ORDER BY start_time DESC LIMIT 10;
