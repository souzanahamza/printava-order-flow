import { useEffect, useState } from 'react';
import { useAuth } from './useAuth';
import { supabase } from '@/integrations/supabase/client';

interface UserProfile {
  id: string;
  full_name: string | null;
  role: string | null;
  company_id: string | null;
  company_name?: string | null;
}

export function useUserRole() {
  const { user } = useAuth();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setProfile(null);
      setLoading(false);
      return;
    }

    const fetchProfile = async () => {
      try {
        const { data: profileData, error: profileError } = await supabase
          .from('profiles')
          .select('id, full_name, role, company_id')
          .eq('id', user.id)
          .single();

        if (profileError) throw profileError;

        // Fetch company name if company_id exists
        let companyName = null;
        if (profileData.company_id) {
          const { data: companyData } = await supabase
            .from('companies')
            .select('name')
            .eq('id', profileData.company_id)
            .single();
          
          companyName = companyData?.name;
        }

        setProfile({ ...profileData, company_name: companyName });
      } catch (error) {
        console.error('Error fetching user profile:', error);
        setProfile(null);
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
  }, [user]);

  return {
    profile,
    loading,
    role: profile?.role || null,
    companyId: profile?.company_id || null,
    fullName: profile?.full_name || null,
    companyName: profile?.company_name || null,
  };
}
