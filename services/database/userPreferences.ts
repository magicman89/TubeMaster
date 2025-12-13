import { supabase, hasSupabaseCredentials } from '../supabase';
import { UserPreferences } from '../../types';

// Default preferences for new users
const DEFAULT_PREFERENCES: Omit<UserPreferences, 'id' | 'user_id' | 'created_at' | 'updated_at'> = {
    resolution: '720p',
    aspect_ratio: '16:9',
    ai_persona: 'Professional',
    voice: 'Fenrir',
    theme: 'dark'
};

export const userPreferencesService = {
    /**
     * Fetch user preferences from Supabase
     */
    async get(userId: string): Promise<UserPreferences | null> {
        if (!hasSupabaseCredentials) {
            console.warn('Supabase not configured, using defaults');
            return { ...DEFAULT_PREFERENCES } as UserPreferences;
        }

        try {
            const { data, error } = await supabase
                .from('user_preferences')
                .select('*')
                .eq('user_id', userId)
                .single();

            if (error) {
                // If no record exists (PGRST116), return defaults
                if (error.code === 'PGRST116') {
                    return { ...DEFAULT_PREFERENCES, user_id: userId } as UserPreferences;
                }
                throw error;
            }

            return data as UserPreferences;
        } catch (e) {
            console.error('Failed to fetch user preferences:', e);
            return { ...DEFAULT_PREFERENCES, user_id: userId } as UserPreferences;
        }
    },

    /**
     * Save or update user preferences in Supabase
     */
    async upsert(userId: string, prefs: Partial<UserPreferences>): Promise<UserPreferences | null> {
        if (!hasSupabaseCredentials) {
            console.warn('Supabase not configured, preferences not saved');
            return null;
        }

        try {
            const { data, error } = await supabase
                .from('user_preferences')
                .upsert({
                    user_id: userId,
                    resolution: prefs.resolution || DEFAULT_PREFERENCES.resolution,
                    aspect_ratio: prefs.aspect_ratio || DEFAULT_PREFERENCES.aspect_ratio,
                    ai_persona: prefs.ai_persona || DEFAULT_PREFERENCES.ai_persona,
                    voice: prefs.voice || DEFAULT_PREFERENCES.voice,
                    theme: prefs.theme || DEFAULT_PREFERENCES.theme,
                    updated_at: new Date().toISOString()
                }, { onConflict: 'user_id' })
                .select()
                .single();

            if (error) throw error;
            return data as UserPreferences;
        } catch (e) {
            console.error('Failed to save user preferences:', e);
            throw e;
        }
    }
};
