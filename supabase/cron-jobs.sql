-- Supabase Cron Job Configuration
-- Run this in Supabase SQL Editor to enable scheduled autopilot runs

-- Enable the pg_cron extension (if not already enabled)
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Grant usage to postgres user
GRANT USAGE ON SCHEMA cron TO postgres;

-- Schedule autopilot to run daily at 9:00 AM UTC
-- This calls the autopilot-run Edge Function
SELECT cron.schedule(
    'autopilot-daily',           -- job name
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

-- Alternative: Run every 6 hours for more frequent content generation
-- Uncomment this and comment out the daily schedule if desired
/*
SELECT cron.schedule(
    'autopilot-frequent',
    '0 */6 * * *',               -- Every 6 hours
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
*/

-- View scheduled jobs
-- SELECT * FROM cron.job;

-- Remove a scheduled job (if needed)
-- SELECT cron.unschedule('autopilot-daily');

-- View job run history
-- SELECT * FROM cron.job_run_details ORDER BY start_time DESC LIMIT 10;
