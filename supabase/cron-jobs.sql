-- TubeMaster Cron Job Configuration V2
-- Complete scheduling for hands-off multi-channel automation
-- Run this in Supabase SQL Editor to enable scheduled autopilot runs

-- Enable the pg_cron and pg_net extensions
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Grant usage to postgres user
GRANT USAGE ON SCHEMA cron TO postgres;

-- ===========================================
-- REMOVE OLD JOBS (if they exist)
-- ===========================================
SELECT cron.unschedule('autopilot-initiator') WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'autopilot-initiator');
SELECT cron.unschedule('autopilot-worker') WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'autopilot-worker');

-- ===========================================
-- 1. AUTOPILOT INITIATOR (Daily Topic Generation)
-- ===========================================
-- Runs at 9 AM every day to create new video projects
-- for channels with autopilot enabled based on their frequency settings
SELECT cron.schedule(
    'autopilot-initiator',
    '0 9 * * *',                 -- 9 AM every day
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

-- ===========================================
-- 2. AUTOPILOT WORKER (Pipeline Processing)
-- ===========================================
-- Runs every 5 minutes to process pipeline stages
-- (scripting → audio → visuals → thumbnail → merging → review)
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

-- ===========================================
-- 3. AUTOPILOT PUBLISHER (YouTube Upload)
-- ===========================================
-- Runs every 15 minutes to upload ready videos to YouTube
-- and schedule them for optimal publish times
SELECT cron.schedule(
    'autopilot-publisher',
    '*/15 * * * *',              -- Every 15 minutes
    $$
    SELECT
        net.http_post(
            url := current_setting('app.settings.supabase_url') || '/functions/v1/autopilot-publisher',
            headers := jsonb_build_object(
                'Content-Type', 'application/json',
                'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
            ),
            body := '{}'::jsonb
        ) AS request_id;
    $$
);

-- ===========================================
-- 4. AUTOPILOT NOTIFIER (Email/Webhook Alerts)
-- ===========================================
-- Runs every 5 minutes to send pending notifications
SELECT cron.schedule(
    'autopilot-notifier',
    '*/5 * * * *',               -- Every 5 minutes
    $$
    SELECT
        net.http_post(
            url := current_setting('app.settings.supabase_url') || '/functions/v1/autopilot-notifier',
            headers := jsonb_build_object(
                'Content-Type', 'application/json',
                'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
            ),
            body := '{}'::jsonb
        ) AS request_id;
    $$
);

-- ===========================================
-- 5. ANALYTICS SYNC (Performance Tracking)
-- ===========================================
-- Runs daily at 2 AM to sync YouTube analytics
-- Used for optimal publish time calculation
SELECT cron.schedule(
    'analytics-sync',
    '0 2 * * *',                 -- 2 AM every day
    $$
    SELECT
        net.http_post(
            url := current_setting('app.settings.supabase_url') || '/functions/v1/analytics-sync',
            headers := jsonb_build_object(
                'Content-Type', 'application/json',
                'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
            ),
            body := '{}'::jsonb
        ) AS request_id;
    $$
);

-- ===========================================
-- 6. TOKEN REFRESH (Keep OAuth Alive)
-- ===========================================
-- Runs every 30 minutes to proactively refresh
-- YouTube OAuth tokens before they expire
SELECT cron.schedule(
    'token-refresh',
    '*/30 * * * *',              -- Every 30 minutes
    $$
    SELECT
        net.http_post(
            url := current_setting('app.settings.supabase_url') || '/functions/v1/refresh-token',
            headers := jsonb_build_object(
                'Content-Type', 'application/json',
                'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
            ),
            body := '{"refreshAll": true}'::jsonb
        ) AS request_id;
    $$
);

-- ===========================================
-- 7. CLEANUP OLD NOTIFICATIONS (Weekly)
-- ===========================================
-- Runs weekly to clean up old read notifications
SELECT cron.schedule(
    'cleanup-notifications',
    '0 3 * * 0',                 -- 3 AM every Sunday
    $$
    DELETE FROM notifications
    WHERE read = true
      AND created_at < NOW() - INTERVAL '30 days';
    $$
);

-- ===========================================
-- 8. CLEANUP OLD LOGS (Weekly)
-- ===========================================
-- Runs weekly to trim logs from completed projects
SELECT cron.schedule(
    'cleanup-logs',
    '0 4 * * 0',                 -- 4 AM every Sunday
    $$
    UPDATE video_projects
    SET logs = (
        SELECT array_agg(log)
        FROM (
            SELECT unnest(logs) as log
            ORDER BY 1 DESC
            LIMIT 50
        ) subquery
    )
    WHERE array_length(logs, 1) > 50;
    $$
);

-- ===========================================
-- VIEW SCHEDULED JOBS
-- ===========================================
-- SELECT * FROM cron.job ORDER BY jobname;

-- ===========================================
-- VIEW JOB RUN HISTORY
-- ===========================================
-- SELECT * FROM cron.job_run_details ORDER BY start_time DESC LIMIT 20;

-- ===========================================
-- MANUAL TRIGGER HELPERS
-- ===========================================
-- These can be called manually to trigger jobs

-- Trigger autopilot initiator manually:
-- SELECT net.http_post(url := '<supabase_url>/functions/v1/autopilot-run', ...);

-- Trigger autopilot worker manually:
-- SELECT net.http_post(url := '<supabase_url>/functions/v1/autopilot-worker', ...);

-- Trigger publisher manually:
-- SELECT net.http_post(url := '<supabase_url>/functions/v1/autopilot-publisher', ...);

-- ===========================================
-- SCHEDULE SUMMARY
-- ===========================================
/*
Job Name              | Schedule        | Description
----------------------|-----------------|------------------------------------------
autopilot-initiator   | 9 AM daily      | Creates new video projects
autopilot-worker      | Every 5 min     | Processes pipeline stages
autopilot-publisher   | Every 15 min    | Uploads to YouTube
autopilot-notifier    | Every 5 min     | Sends email/webhook alerts
analytics-sync        | 2 AM daily      | Syncs YouTube analytics
token-refresh         | Every 30 min    | Refreshes OAuth tokens
cleanup-notifications | 3 AM Sunday     | Removes old notifications
cleanup-logs          | 4 AM Sunday     | Trims project logs

Pipeline Processing Time (estimated):
- Script generation: ~5-10 seconds
- Audio generation: ~30-60 seconds per scene (2 scenes/run)
- Video generation: ~60-120 seconds per scene (1 scene/run)
- Thumbnail generation: ~10-20 seconds
- Total for 5-scene video: ~35-60 minutes (7-12 worker runs)
*/
