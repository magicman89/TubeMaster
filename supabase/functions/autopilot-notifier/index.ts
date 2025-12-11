// Supabase Edge Function: Autopilot Notifier
// Sends email and webhook notifications for pipeline events
// Runs every 5 minutes to process pending notifications

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.38.0';

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// --- TYPES ---
interface Notification {
    id: string;
    channel_id: string;
    type: 'error' | 'success' | 'approval_needed' | 'published';
    message: string;
    metadata: Record<string, unknown>;
    read: boolean;
    sent_email: boolean;
    sent_webhook: boolean;
    created_at: string;
}

interface NotificationSettings {
    id: string;
    channel_id: string;
    email_enabled: boolean;
    email_address: string;
    webhook_enabled: boolean;
    webhook_url: string;
    notify_on_error: boolean;
    notify_on_success: boolean;
    notify_on_approval: boolean;
    notify_on_published: boolean;
    daily_digest: boolean;
    digest_time: string;
}

interface Channel {
    id: string;
    name: string;
    user_id: string;
}

// --- EMAIL TEMPLATES ---
const emailTemplates = {
    error: (channelName: string, message: string, metadata: Record<string, unknown>) => ({
        subject: `[TubeMaster] Error on ${channelName}`,
        html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <div style="background: linear-gradient(135deg, #ff4444 0%, #cc0000 100%); padding: 20px; border-radius: 10px 10px 0 0;">
                    <h1 style="color: white; margin: 0;">Pipeline Error</h1>
                </div>
                <div style="background: #1a1a2e; color: white; padding: 20px;">
                    <p style="font-size: 16px;">${message}</p>
                    ${metadata.projectId ? `<p><strong>Project ID:</strong> ${metadata.projectId}</p>` : ''}
                    ${metadata.error ? `<p><strong>Error:</strong> <code style="background: #333; padding: 2px 6px; border-radius: 4px;">${metadata.error}</code></p>` : ''}
                    <a href="https://tubemaster.app/dashboard" style="display: inline-block; background: #6366f1; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; margin-top: 15px;">View Dashboard</a>
                </div>
                <div style="background: #0f0f23; padding: 15px; border-radius: 0 0 10px 10px; text-align: center;">
                    <p style="color: #666; margin: 0; font-size: 12px;">TubeMaster AI Studio</p>
                </div>
            </div>
        `
    }),

    approval_needed: (channelName: string, message: string, metadata: Record<string, unknown>) => ({
        subject: `[TubeMaster] Approval Needed: ${metadata.title || 'New Video'}`,
        html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <div style="background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); padding: 20px; border-radius: 10px 10px 0 0;">
                    <h1 style="color: white; margin: 0;">Review Required</h1>
                </div>
                <div style="background: #1a1a2e; color: white; padding: 20px;">
                    <p style="font-size: 16px;">${message}</p>
                    <p><strong>Channel:</strong> ${channelName}</p>
                    ${metadata.title ? `<p><strong>Video:</strong> ${metadata.title}</p>` : ''}
                    <div style="margin-top: 20px;">
                        <a href="https://tubemaster.app/studio/${metadata.projectId}" style="display: inline-block; background: #10b981; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; margin-right: 10px;">Review & Approve</a>
                        <a href="https://tubemaster.app/dashboard" style="display: inline-block; background: #6366f1; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none;">View Dashboard</a>
                    </div>
                </div>
                <div style="background: #0f0f23; padding: 15px; border-radius: 0 0 10px 10px; text-align: center;">
                    <p style="color: #666; margin: 0; font-size: 12px;">TubeMaster AI Studio</p>
                </div>
            </div>
        `
    }),

    published: (channelName: string, message: string, metadata: Record<string, unknown>) => ({
        subject: `[TubeMaster] Video Published: ${metadata.title || 'New Video'}`,
        html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <div style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); padding: 20px; border-radius: 10px 10px 0 0;">
                    <h1 style="color: white; margin: 0;">Video Published!</h1>
                </div>
                <div style="background: #1a1a2e; color: white; padding: 20px;">
                    <p style="font-size: 16px;">${message}</p>
                    <p><strong>Channel:</strong> ${channelName}</p>
                    ${metadata.youtubeVideoId ? `
                        <div style="margin-top: 20px; background: #0f0f23; padding: 15px; border-radius: 8px;">
                            <p style="margin: 0 0 10px 0;"><strong>YouTube Video ID:</strong> ${metadata.youtubeVideoId}</p>
                            ${metadata.publishAt ? `<p style="margin: 0 0 10px 0;"><strong>Scheduled For:</strong> ${new Date(metadata.publishAt as string).toLocaleString()}</p>` : ''}
                            <a href="${metadata.youtubeUrl}" style="color: #6366f1;">Watch on YouTube →</a>
                        </div>
                    ` : ''}
                    <a href="https://tubemaster.app/dashboard" style="display: inline-block; background: #6366f1; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; margin-top: 15px;">View Dashboard</a>
                </div>
                <div style="background: #0f0f23; padding: 15px; border-radius: 0 0 10px 10px; text-align: center;">
                    <p style="color: #666; margin: 0; font-size: 12px;">TubeMaster AI Studio</p>
                </div>
            </div>
        `
    }),

    success: (channelName: string, message: string, metadata: Record<string, unknown>) => ({
        subject: `[TubeMaster] Success: ${channelName}`,
        html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <div style="background: linear-gradient(135deg, #6366f1 0%, #4f46e5 100%); padding: 20px; border-radius: 10px 10px 0 0;">
                    <h1 style="color: white; margin: 0;">Success</h1>
                </div>
                <div style="background: #1a1a2e; color: white; padding: 20px;">
                    <p style="font-size: 16px;">${message}</p>
                    <p><strong>Channel:</strong> ${channelName}</p>
                    <a href="https://tubemaster.app/dashboard" style="display: inline-block; background: #6366f1; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; margin-top: 15px;">View Dashboard</a>
                </div>
                <div style="background: #0f0f23; padding: 15px; border-radius: 0 0 10px 10px; text-align: center;">
                    <p style="color: #666; margin: 0; font-size: 12px;">TubeMaster AI Studio</p>
                </div>
            </div>
        `
    })
};

// --- HELPERS ---
async function sendEmail(
    to: string,
    subject: string,
    html: string
): Promise<boolean> {
    const resendApiKey = Deno.env.get('RESEND_API_KEY');

    if (!resendApiKey) {
        console.log('RESEND_API_KEY not configured - skipping email');
        return false;
    }

    try {
        const response = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${resendApiKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                from: 'TubeMaster <notifications@tubemaster.app>',
                to: [to],
                subject,
                html
            })
        });

        if (!response.ok) {
            const error = await response.text();
            console.error('Email send failed:', error);
            return false;
        }

        return true;
    } catch (error) {
        console.error('Email error:', error);
        return false;
    }
}

async function sendWebhook(
    url: string,
    notification: Notification,
    channelName: string
): Promise<boolean> {
    try {
        const payload = {
            event: notification.type,
            channel: channelName,
            message: notification.message,
            metadata: notification.metadata,
            timestamp: notification.created_at
        };

        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-TubeMaster-Event': notification.type
            },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            console.error('Webhook failed:', response.status);
            return false;
        }

        return true;
    } catch (error) {
        console.error('Webhook error:', error);
        return false;
    }
}

async function getUserEmail(
    supabase: SupabaseClient,
    userId: string
): Promise<string | null> {
    try {
        const { data: { user } } = await supabase.auth.admin.getUserById(userId);
        return user?.email || null;
    } catch (error) {
        console.error('Failed to get user email:', error);
        return null;
    }
}

// --- MAIN HANDLER ---
serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    const supabase = createClient(
        Deno.env.get('SUPABASE_URL') || '',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
    );

    const results: Array<{
        notificationId: string;
        type: string;
        emailSent: boolean;
        webhookSent: boolean;
    }> = [];

    try {
        // Fetch unprocessed notifications
        const { data: notifications, error: fetchError } = await supabase
            .from('notifications')
            .select(`
                *,
                channel:channels(id, name, user_id)
            `)
            .or('sent_email.is.null,sent_email.eq.false,sent_webhook.is.null,sent_webhook.eq.false')
            .order('created_at', { ascending: true })
            .limit(20);

        if (fetchError) throw fetchError;

        if (!notifications || notifications.length === 0) {
            return new Response(
                JSON.stringify({ message: 'No pending notifications', timestamp: new Date().toISOString() }),
                { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        for (const notification of notifications as (Notification & { channel: Channel })[]) {
            const channel = notification.channel;

            // Get notification settings for this channel
            const { data: settings } = await supabase
                .from('notification_settings')
                .select('*')
                .eq('channel_id', channel.id)
                .single();

            let emailSent = notification.sent_email || false;
            let webhookSent = notification.sent_webhook || false;

            // Check if we should send for this notification type
            const shouldNotify = (settings: NotificationSettings | null, type: string): boolean => {
                if (!settings) return true; // Default to send if no settings
                switch (type) {
                    case 'error': return settings.notify_on_error !== false;
                    case 'success': return settings.notify_on_success !== false;
                    case 'approval_needed': return settings.notify_on_approval !== false;
                    case 'published': return settings.notify_on_published !== false;
                    default: return true;
                }
            };

            if (!shouldNotify(settings as NotificationSettings | null, notification.type)) {
                // Mark as sent but skip
                await supabase
                    .from('notifications')
                    .update({ sent_email: true, sent_webhook: true })
                    .eq('id', notification.id);

                results.push({
                    notificationId: notification.id,
                    type: notification.type,
                    emailSent: false,
                    webhookSent: false
                });
                continue;
            }

            // Send email
            if (!emailSent && settings?.email_enabled) {
                const emailAddress = settings.email_address ||
                    await getUserEmail(supabase, channel.user_id);

                if (emailAddress) {
                    const template = emailTemplates[notification.type as keyof typeof emailTemplates];
                    if (template) {
                        const { subject, html } = template(
                            channel.name,
                            notification.message,
                            notification.metadata
                        );
                        emailSent = await sendEmail(emailAddress, subject, html);
                    }
                }
            }

            // Send webhook
            if (!webhookSent && settings?.webhook_enabled && settings?.webhook_url) {
                webhookSent = await sendWebhook(
                    settings.webhook_url,
                    notification,
                    channel.name
                );
            }

            // Update notification status
            await supabase
                .from('notifications')
                .update({
                    sent_email: emailSent,
                    sent_webhook: webhookSent,
                    updated_at: new Date().toISOString()
                })
                .eq('id', notification.id);

            results.push({
                notificationId: notification.id,
                type: notification.type,
                emailSent,
                webhookSent
            });
        }

        return new Response(
            JSON.stringify({
                success: true,
                processed: results.length,
                results,
                timestamp: new Date().toISOString()
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );

    } catch (error) {
        console.error('Notifier Error:', error);

        return new Response(
            JSON.stringify({
                error: String(error),
                timestamp: new Date().toISOString()
            }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }
});
