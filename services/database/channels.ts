import { supabase } from '../supabase';
import { Channel, ChannelNiche, ChannelBranding, ChannelGoals, ChannelAudience } from '../../types';

export interface DBChannel {
    id: string;
    user_id: string;
    name: string;
    niche: string;
    subscribers: number;
    avatar: string;
    style_memory: string[];
    default_prompt_enhancers: string | null;
    branding: ChannelBranding | null;
    goals: ChannelGoals | null;
    audience: ChannelAudience | null;
    youtube_channel_id: string | null;
    youtube_access_token: string | null;
    youtube_refresh_token: string | null;
    youtube_token_expires_at: string | null;
    created_at: string;
    updated_at: string;
}

// Convert DB format to app format
const toChannel = (db: DBChannel): Channel => ({
    id: db.id,
    name: db.name,
    niche: db.niche as ChannelNiche,
    subscribers: db.subscribers,
    avatar: db.avatar,
    styleMemory: db.style_memory,
    defaultPromptEnhancers: db.default_prompt_enhancers || undefined,
    branding: db.branding || undefined,
    goals: db.goals || undefined,
    audience: db.audience || undefined,
});

// Convert app format to DB format
const toDBChannel = (channel: Partial<Channel>, userId?: string): Partial<DBChannel> => ({
    ...(userId && { user_id: userId }),
    ...(channel.name && { name: channel.name }),
    ...(channel.niche && { niche: channel.niche }),
    ...(channel.subscribers !== undefined && { subscribers: channel.subscribers }),
    ...(channel.avatar && { avatar: channel.avatar }),
    ...(channel.styleMemory && { style_memory: channel.styleMemory }),
    ...(channel.defaultPromptEnhancers !== undefined && { default_prompt_enhancers: channel.defaultPromptEnhancers }),
    ...(channel.branding && { branding: channel.branding }),
    ...(channel.goals && { goals: channel.goals }),
    ...(channel.audience && { audience: channel.audience }),
});

export const channelsDB = {
    async getAll(): Promise<Channel[]> {
        const { data, error } = await supabase
            .from('channels')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) throw error;
        return (data || []).map(toChannel);
    },

    async getById(id: string): Promise<Channel | null> {
        const { data, error } = await supabase
            .from('channels')
            .select('*')
            .eq('id', id)
            .single();

        if (error) {
            if (error.code === 'PGRST116') return null; // Not found
            throw error;
        }
        return data ? toChannel(data) : null;
    },

    async create(channel: Omit<Channel, 'id'>, userId: string): Promise<Channel> {
        const dbData = toDBChannel(channel as Channel, userId);

        const { data, error } = await supabase
            .from('channels')
            .insert(dbData)
            .select()
            .single();

        if (error) throw error;
        return toChannel(data);
    },

    async update(id: string, updates: Partial<Channel>): Promise<Channel> {
        const dbData = toDBChannel(updates);

        const { data, error } = await supabase
            .from('channels')
            .update(dbData)
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;
        return toChannel(data);
    },

    async delete(id: string): Promise<void> {
        const { error } = await supabase
            .from('channels')
            .delete()
            .eq('id', id);

        if (error) throw error;
    },

    async updateYouTubeTokens(
        id: string,
        tokens: {
            channelId: string;
            accessToken: string;
            refreshToken: string;
            expiresAt: Date;
        }
    ): Promise<void> {
        const { error } = await supabase
            .from('channels')
            .update({
                youtube_channel_id: tokens.channelId,
                youtube_access_token: tokens.accessToken,
                youtube_refresh_token: tokens.refreshToken,
                youtube_token_expires_at: tokens.expiresAt.toISOString(),
            })
            .eq('id', id);

        if (error) throw error;
    },

    async getWithYouTubeConnection(): Promise<Channel[]> {
        const { data, error } = await supabase
            .from('channels')
            .select('*')
            .not('youtube_channel_id', 'is', null);

        if (error) throw error;
        return (data || []).map(toChannel);
    }
};
