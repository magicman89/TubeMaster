import { supabase } from '../supabase';
import { Idea } from '../../types';

export interface DBIdea {
    id: string;
    user_id: string;
    channel_id: string | null;
    content: string;
    type: string;
    tags: string[];
    promoted: boolean;
    created_at: string;
}

const toIdea = (db: DBIdea): Idea => ({
    id: db.id,
    content: db.content,
    type: db.type as Idea['type'],
    tags: db.tags,
    createdAt: new Date(db.created_at),
});

const toDBIdea = (idea: Partial<Idea>, userId?: string, channelId?: string): Partial<DBIdea> => ({
    ...(userId && { user_id: userId }),
    ...(channelId !== undefined && { channel_id: channelId }),
    ...(idea.content && { content: idea.content }),
    ...(idea.type && { type: idea.type }),
    ...(idea.tags && { tags: idea.tags }),
});

export const ideasDB = {
    async getAll(channelId?: string): Promise<Idea[]> {
        let query = supabase.from('ideas').select('*');

        if (channelId) {
            query = query.eq('channel_id', channelId);
        }

        const { data, error } = await query.order('created_at', { ascending: false });

        if (error) throw error;
        return (data || []).map(toIdea);
    },

    async getByType(type: Idea['type']): Promise<Idea[]> {
        const { data, error } = await supabase
            .from('ideas')
            .select('*')
            .eq('type', type)
            .order('created_at', { ascending: false });

        if (error) throw error;
        return (data || []).map(toIdea);
    },

    async create(idea: Omit<Idea, 'id' | 'createdAt'>, userId: string, channelId?: string): Promise<Idea> {
        const dbData = toDBIdea(idea, userId, channelId);

        const { data, error } = await supabase
            .from('ideas')
            .insert(dbData)
            .select()
            .single();

        if (error) throw error;
        return toIdea(data);
    },

    async update(id: string, updates: Partial<Idea>): Promise<Idea> {
        const dbData = toDBIdea(updates);

        const { data, error } = await supabase
            .from('ideas')
            .update(dbData)
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;
        return toIdea(data);
    },

    async delete(id: string): Promise<void> {
        const { error } = await supabase
            .from('ideas')
            .delete()
            .eq('id', id);

        if (error) throw error;
    },

    async markPromoted(id: string): Promise<void> {
        const { error } = await supabase
            .from('ideas')
            .update({ promoted: true })
            .eq('id', id);

        if (error) throw error;
    },

    async search(query: string): Promise<Idea[]> {
        const { data, error } = await supabase
            .from('ideas')
            .select('*')
            .ilike('content', `%${query}%`)
            .order('created_at', { ascending: false });

        if (error) throw error;
        return (data || []).map(toIdea);
    }
};
