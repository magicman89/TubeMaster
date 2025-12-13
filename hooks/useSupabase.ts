import React, { useState, useEffect, useCallback, createContext, useContext, ReactNode } from 'react';
import { supabase, getSession, getUser, signIn, signUp, signOut, User, Session, hasSupabaseCredentials } from '../services/supabase';

interface AuthContextType {
    user: User | null;
    session: Session | null;
    loading: boolean;
    isEnabled: boolean;
    signIn: (email: string, password: string) => Promise<void>;
    signUp: (email: string, password: string) => Promise<void>;
    signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [user, setUser] = useState<User | null>(null);
    const [session, setSession] = useState<Session | null>(null);
    const [loading, setLoading] = useState(hasSupabaseCredentials);

    useEffect(() => {
        // Skip initialization if no credentials
        if (!hasSupabaseCredentials) {
            setLoading(false);
            return;
        }

        // Initialize auth
        const initAuth = async () => {
            try {
                // Check for hash token from email confirmation
                const hash = window.location.hash;
                if (hash && hash.includes('access_token')) {
                    // Clear hash from URL first for cleaner UX
                    window.history.replaceState(null, '', window.location.pathname);
                }

                // Get session (Supabase client handles hash tokens automatically)
                const { data } = await supabase.auth.getSession();
                if (data?.session) {
                    setSession(data.session);
                    setUser(data.session.user);
                }
            } catch (e) {
                console.error('Auth initialization error:', e);
            } finally {
                // Always stop loading regardless of success/failure
                setLoading(false);
            }
        };

        initAuth();

        // Listen for auth changes
        const { data: { subscription } } = supabase.auth.onAuthStateChange(
            async (_event, sess) => {
                setSession(sess);
                if (sess) {
                    try {
                        const currentUser = await getUser();
                        setUser(currentUser);
                    } catch {
                        setUser(null);
                    }
                } else {
                    setUser(null);
                }
            }
        );

        return () => subscription.unsubscribe();
    }, []);

    const handleSignIn = useCallback(async (email: string, password: string) => {
        if (!hasSupabaseCredentials) {
            throw new Error('Supabase not configured. Please add credentials to .env.local');
        }
        await signIn(email, password);
    }, []);

    const handleSignUp = useCallback(async (email: string, password: string) => {
        if (!hasSupabaseCredentials) {
            throw new Error('Supabase not configured. Please add credentials to .env.local');
        }
        await signUp(email, password);
    }, []);

    const handleSignOut = useCallback(async () => {
        if (!hasSupabaseCredentials) return;
        await signOut();
    }, []);

    const value: AuthContextType = {
        user,
        session,
        loading,
        isEnabled: hasSupabaseCredentials,
        signIn: handleSignIn,
        signUp: handleSignUp,
        signOut: handleSignOut
    };

    return React.createElement(
        AuthContext.Provider,
        { value },
        children
    );
};

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};

export function useSupabaseQuery<T>(
    tableName: string,
    options?: {
        filter?: { column: string; value: string | number };
        orderBy?: { column: string; ascending?: boolean };
        limit?: number;
    }
) {
    const [data, setData] = useState<T[]>([]);
    const [loading, setLoading] = useState(hasSupabaseCredentials);
    const [error, setError] = useState<Error | null>(null);

    const fetchData = useCallback(async () => {
        if (!hasSupabaseCredentials) {
            setLoading(false);
            return;
        }

        setLoading(true);
        try {
            let query = supabase.from(tableName).select('*');

            if (options?.filter) {
                query = query.eq(options.filter.column, options.filter.value);
            }
            if (options?.orderBy) {
                query = query.order(options.orderBy.column, { ascending: options.orderBy.ascending ?? true });
            }
            if (options?.limit) {
                query = query.limit(options.limit);
            }

            const { data: result, error: queryError } = await query;

            if (queryError) throw queryError;
            setData(result as T[]);
        } catch (e) {
            setError(e as Error);
        } finally {
            setLoading(false);
        }
    }, [tableName, options?.filter?.column, options?.filter?.value, options?.orderBy?.column, options?.orderBy?.ascending, options?.limit]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    return { data, loading, error, refetch: fetchData };
}

export function useSupabaseRealtime<T>(
    tableName: string,
    callback?: (payload: { new: T; old: T; eventType: string }) => void
) {
    useEffect(() => {
        if (!hasSupabaseCredentials) return;

        const channel = supabase
            .channel(`public:${tableName}`)
            .on('postgres_changes', { event: '*', schema: 'public', table: tableName }, (payload) => {
                callback?.({
                    new: payload.new as T,
                    old: payload.old as T,
                    eventType: payload.eventType
                });
            })
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [tableName, callback]);
}
