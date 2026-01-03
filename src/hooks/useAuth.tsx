import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: any }>;
  signUp: (email: string, password: string, fullName: string, companyName: string, logo?: File | null, currencyId?: string) => Promise<{ error: any }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Set up auth state listener first
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);
      }
    );

    // Then check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    return { error };
  };

  const signUp = async (email: string, password: string, fullName: string, companyName: string, logo?: File | null, currencyId?: string) => {
    const redirectUrl = `${window.location.origin}/`;
    
    // First, sign up the user
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectUrl,
        data: {
          full_name: fullName,
          company_name: companyName,
          currency_id: currencyId
        }
      }
    });

    // If signup was successful, update company with currency_id and logo
    if (!error && data.user) {
      try {
        const updateData: { currency_id?: string; logo_url?: string } = {};
        
        // Update company with currency_id if provided
        if (currencyId) {
          updateData.currency_id = currencyId;
        }

        // Upload logo if provided
        if (logo) {
          const fileExt = logo.name.split('.').pop();
          const fileName = `${data.user.id}/logo.${fileExt}`;
          
          const { error: uploadError, data: uploadData } = await supabase.storage
            .from('company-logos')
            .upload(fileName, logo, { upsert: true });

          if (!uploadError && uploadData) {
            const { data: { publicUrl } } = supabase.storage
              .from('company-logos')
              .getPublicUrl(fileName);
            
            updateData.logo_url = publicUrl;
          }
        }

        // Update the company with currency_id and/or logo_url
        if (Object.keys(updateData).length > 0) {
          await supabase
            .from('companies')
            .update(updateData)
            .eq('id', data.user.id);
        }
      } catch (updateError) {
        console.error('Error updating company:', updateError);
        // Don't fail the signup if update fails
      }
    }
    
    return { error };
  };

  const signOut = async () => {
    try {
      const { error } = await supabase.auth.signOut({ scope: 'global' });
      if (error) {
        console.error('Error during sign out:', error.message || error);
      }
    } catch (error) {
      console.error('Unexpected sign out error:', error);
    } finally {
      // Always clear local auth state so routing behaves correctly
      setSession(null);
      setUser(null);
      // Optional: clear stored token to avoid stale sessions on reload
      localStorage.removeItem('sb-pqbzcxizlkazhalivqox-auth-token');
    }
  };

  return (
    <AuthContext.Provider value={{ user, session, loading, signIn, signUp, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
