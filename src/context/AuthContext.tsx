import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { User } from '@supabase/supabase-js';

export interface UserProfile {
  fullName: string;
  email: string;
  studentLevel: string;
  avatarUrl?: string;
}

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  signUp: (email: string, password: string, fullName: string, studentLevel: string) => Promise<any>;
  signIn: (email: string, password: string) => Promise<any>;
  signInWithGoogle: () => Promise<any>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<any>;
  updateProfile: (updated: Partial<UserProfile>) => Promise<any>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const getFallbackProfile = (currentUser: User): UserProfile => {
  const fullName = currentUser.user_metadata?.full_name || currentUser.user_metadata?.name || currentUser.email?.split('@')[0] || 'Gabriel Semesco';
  const studentLevel = currentUser.user_metadata?.student_level || 'Undergraduate (Senior)';
  const avatarUrl = currentUser.user_metadata?.avatar_url || `https://api.dicebear.com/7.x/adventurer/svg?seed=${encodeURIComponent(fullName || currentUser.email || '')}`;
  return {
    fullName,
    email: currentUser.email || '',
    studentLevel,
    avatarUrl
  };
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  // Helper to fetch user profile
  const fetchProfile = async (currentUser: User) => {
    const fallback = getFallbackProfile(currentUser);
    // Guarantee fallback profile is immediately populated so UI is never blocked
    setProfile(prev => prev || fallback);

    try {
      // First try to get the profile from the 'profiles' table
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', currentUser.id)
        .maybeSingle();

      if (data) {
        setProfile({
          fullName: data.full_name || fallback.fullName,
          email: currentUser.email || fallback.email,
          studentLevel: data.student_level || fallback.studentLevel,
          avatarUrl: data.avatar_url || fallback.avatarUrl
        });
        return;
      }

      // Profile record not found. Automatically create a profile record after first login
      console.log('Profile record not found. Automatically creating profile record on first login...');
      try {
        const { error: insertError } = await supabase
          .from('profiles')
          .insert({
            id: currentUser.id,
            full_name: fallback.fullName,
            student_level: fallback.studentLevel,
            avatar_url: fallback.avatarUrl,
            updated_at: new Date().toISOString()
          });

        if (insertError) {
          console.warn('Could not insert profile record:', insertError.message);
        }
      } catch (insertCatch) {
        console.warn('Profiles table inserting caught an error:', insertCatch);
      }

      setProfile(fallback);
    } catch (err) {
      console.error('Error fetching/creating profile:', err);
      setProfile(prev => prev || fallback);
    }
  };

  useEffect(() => {
    let mounted = true;

    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!mounted) return;
      if (session?.user) {
        setUser(session.user);
        setProfile(prev => prev || getFallbackProfile(session.user));
        fetchProfile(session.user);
      } else {
        setUser(null);
        setProfile(null);
      }
      setLoading(false);
    }).catch((err) => {
      console.error('Error retrieving session:', err);
      if (mounted) setLoading(false);
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!mounted) return;
      if (session?.user) {
        setUser(session.user);
        setProfile(prev => prev || getFallbackProfile(session.user));
        await fetchProfile(session.user);
      } else {
        setUser(null);
        setProfile(null);
      }
      setLoading(false);
    });

    // Handle OAUTH_AUTH_SUCCESS from popup Window in iframed context
    const handleMessage = async (event: MessageEvent) => {
      const origin = event.origin;
      if (!origin.endsWith('.run.app') && !origin.includes('localhost')) {
        return;
      }
      if (event.data?.type === 'OAUTH_AUTH_SUCCESS') {
        console.log('Received OAUTH_AUTH_SUCCESS from popup!');
        const { hash, search } = event.data;
        
        try {
          if (hash) {
            const params = new URLSearchParams(hash.replace(/^#/, ''));
            const accessToken = params.get('access_token');
            const refreshToken = params.get('refresh_token');
            if (accessToken && refreshToken) {
              const { data, error } = await supabase.auth.setSession({
                access_token: accessToken,
                refresh_token: refreshToken
              });
              if (error) throw error;
              if (data.user && mounted) {
                setUser(data.user);
                setProfile(prev => prev || getFallbackProfile(data.user!));
                await fetchProfile(data.user);
              }
            }
          } else if (search) {
            const params = new URLSearchParams(search);
            const code = params.get('code');
            if (code) {
              const { data, error } = await supabase.auth.exchangeCodeForSession(code);
              if (error) throw error;
              if (data.user && mounted) {
                setUser(data.user);
                setProfile(prev => prev || getFallbackProfile(data.user!));
                await fetchProfile(data.user);
              }
            }
          }
          
          // Force fallback session check to be certain
          const { data: { session } } = await supabase.auth.getSession();
          if (session?.user && mounted) {
            setUser(session.user);
            setProfile(prev => prev || getFallbackProfile(session.user));
            await fetchProfile(session.user);
          }
        } catch (err: any) {
          console.error('Failed to parse and synchronize session from popup:', err);
        }
      }
    };

    window.addEventListener('message', handleMessage);

    return () => {
      mounted = false;
      subscription.unsubscribe();
      window.removeEventListener('message', handleMessage);
    };
  }, []);

  // Email Sign Up
  const signUp = async (email: string, password: string, fullName: string, studentLevel: string) => {
    const avatarUrl = `https://api.dicebear.com/7.x/adventurer/svg?seed=${encodeURIComponent(fullName)}`;
    
    // Sign up the user in Supabase Auth
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
          student_level: studentLevel,
          avatar_url: avatarUrl
        }
      }
    });

    if (error) throw error;

    if (data.user) {
      // Create profile record in the 'profiles' table if accessible
      try {
        const { error: profileError } = await supabase
          .from('profiles')
          .upsert({
            id: data.user.id,
            full_name: fullName,
            student_level: studentLevel,
            avatar_url: avatarUrl,
            updated_at: new Date().toISOString()
          });

        if (profileError) {
          console.warn('Could not write to profiles table, metadata fallback will be used:', profileError.message);
        }
      } catch (e) {
        console.warn('Profiles table writing caught an error (table might not exist yet):', e);
      }
    }

    return data;
  };

  // Email Login
  const signIn = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    });
    if (error) throw error;
    return data;
  };

  // Google Sign In
  const signInWithGoogle = async () => {
    const redirectUrl = `${window.location.origin}/auth/callback`;
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: redirectUrl,
        skipBrowserRedirect: true
      }
    });
    if (error) throw error;
    return data;
  };

  // Sign Out
  const signOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
    setUser(null);
    setProfile(null);
  };

  // Forgot Password
  const resetPassword = async (email: string) => {
    const redirectUrl = window.location.origin;
    const { data, error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: redirectUrl
    });
    if (error) throw error;
    return data;
  };

  // Update Profile
  const updateProfile = async (updated: Partial<UserProfile>) => {
    if (!user) return;

    // Update user_metadata
    const { data, error: authUpdateError } = await supabase.auth.updateUser({
      data: {
        full_name: updated.fullName || profile?.fullName,
        student_level: updated.studentLevel || profile?.studentLevel,
        avatar_url: updated.avatarUrl || profile?.avatarUrl
      }
    });

    if (authUpdateError) throw authUpdateError;

    // Try to update profiles table
    try {
      const { error: dbError } = await supabase
        .from('profiles')
        .upsert({
          id: user.id,
          full_name: updated.fullName || profile?.fullName,
          student_level: updated.studentLevel || profile?.studentLevel,
          avatar_url: updated.avatarUrl || profile?.avatarUrl,
          updated_at: new Date().toISOString()
        });

      if (dbError) {
        console.warn('Profiles table sync skipped:', dbError.message);
      }
    } catch (e) {
      console.warn('Profiles table writing caught an error:', e);
    }

    // Refresh profile in state
    if (data.user) {
      await fetchProfile(data.user);
    }
  };

  return (
    <AuthContext.Provider value={{
      user,
      profile,
      loading,
      signUp,
      signIn,
      signInWithGoogle,
      signOut,
      resetPassword,
      updateProfile
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
