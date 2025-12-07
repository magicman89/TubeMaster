import { supabase } from '../supabase';
import { VideoProject, SocialPost } from '../../types';

export interface DBVideoProject {
    id: string;
    channel_id: string;
    series_id: string | null;
    title: string;
    description: string | null;
    tags: string[];
    status: string;
    date: string | null;
    script: string | null;
    video_url: string | null;
    audio_url: string | null;
    aspect_ratio: string;
    thumbnail_prompt: string | null;
    thumbnail_url: string | null;
    instructions: string | null;
    social_posts: SocialPost[];
    youtube_video_id: string | null;
    pipeline_stage: string;
    virality_score: number | null;
    created_at: string;
    updated_at: string;
}

const toProject = (db: DBVideoProject): VideoProject => ({
    id: db.id,
    channelId: db.channel_id,
    seriesId: db.series_id || undefined,
    title: db.title,
    description: db.description || undefined,
    tags: db.tags,
    status: db.status as VideoProject['status'],
    date: db.date ? new Date(db.date) : new Date(),
    script: db.script || undefined,
    videoUrl: db.video_url || undefined,
    audioUrl: db.audio_url || undefined,
    aspectRatio: db.aspect_ratio as '16:9' | '9:16',
    thumbnailPrompt: db.thumbnail_prompt || undefined,
    instructions: db.instructions || undefined,
    socialPosts: db.social_posts || [],
});

const toDBProject = (project: Partial<VideoProject>): Partial<DBVideoProject> => ({
    ...(project.channelId && { channel_id: project.channelId }),
    ...(project.seriesId !== undefined && { series_id: project.seriesId }),
    ...(project.title && { title: project.title }),
    ...(project.description !== undefined && { description: project.description }),
    ...(project.tags && { tags: project.tags }),
    ...(project.status && { status: project.status }),
    ...(project.date && { date: project.date.toISOString() }),
    ...(project.script !== undefined && { script: project.script }),
    ...(project.videoUrl !== undefined && { video_url: project.videoUrl }),
    ...(project.audioUrl !== undefined && { audio_url: project.audioUrl }),
    ...(project.aspectRatio && { aspect_ratio: project.aspectRatio }),
    ...(project.thumbnailPrompt !== undefined && { thumbnail_prompt: project.thumbnailPrompt }),
    ...(project.instructions !== undefined && { instructions: project.instructions }),
    ...(project.socialPosts && { social_posts: project.socialPosts }),
});

export const projectsDB = {
    async getAll(channelId?: string): Promise<VideoProject[]> {
        let query = supabase.from('video_projects').select('*');

        if (channelId) {
            query = query.eq('channel_id', channelId);
        }

        const { data, error } = await query.order('date', { ascending: false });

        if (error) throw error;
        return (data || []).map(toProject);
    },

    async getById(id: string): Promise<VideoProject | null> {
        const { data, error } = await supabase
            .from('video_projects')
            .select('*')
            .eq('id', id)
            .single();

        if (error) {
            if (error.code === 'PGRST116') return null;
            throw error;
        }
        return data ? toProject(data) : null;
    },

    async getByDateRange(startDate: Date, endDate: Date, channelId?: string): Promise<VideoProject[]> {
        let query = supabase
            .from('video_projects')
            .select('*')
            .gte('date', startDate.toISOString())
            .lte('date', endDate.toISOString());

        if (channelId) {
            query = query.eq('channel_id', channelId);
        }

        const { data, error } = await query.order('date', { ascending: true });

        if (error) throw error;
        return (data || []).map(toProject);
    },

    async getByStatus(status: VideoProject['status'], channelId?: string): Promise<VideoProject[]> {
        let query = supabase
            .from('video_projects')
            .select('*')
            .eq('status', status);

        if (channelId) {
            query = query.eq('channel_id', channelId);
        }

        const { data, error } = await query.order('date', { ascending: true });

        if (error) throw error;
        return (data || []).map(toProject);
    },

    async create(project: Omit<VideoProject, 'id'>): Promise<VideoProject> {
        const dbData = toDBProject(project as VideoProject);

        const { data, error } = await supabase
            .from('video_projects')
            .insert(dbData)
            .select()
            .single();

        if (error) throw error;
        return toProject(data);
    },

    async update(id: string, updates: Partial<VideoProject>): Promise<VideoProject> {
        const dbData = toDBProject(updates);

        const { data, error } = await supabase
            .from('video_projects')
            .update(dbData)
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;
        return toProject(data);
    },

    async updateStatus(id: string, status: VideoProject['status']): Promise<void> {
        const { error } = await supabase
            .from('video_projects')
            .update({ status })
            .eq('id', id);

        if (error) throw error;
    },

    async delete(id: string): Promise<void> {
        const { error } = await supabase
            .from('video_projects')
            .delete()
            .eq('id', id);

        if (error) throw error;
    },

    async deleteSeries(seriesId: string): Promise<void> {
        const { error } = await supabase
            .from('video_projects')
            .delete()
            .eq('series_id', seriesId);

        if (error) throw error;
    },

    async setViralityScore(id: string, score: number): Promise<void> {
        const { error } = await supabase
            .from('video_projects')
            .update({ virality_score: score })
            .eq('id', id);

        if (error) throw error;
    },

    async setYouTubeVideoId(id: string, youtubeVideoId: string): Promise<void> {
        const { error } = await supabase
            .from('video_projects')
            .update({
                youtube_video_id: youtubeVideoId,
                status: 'published'
            })
            .eq('id', id);

        if (error) throw error;
    }
};
