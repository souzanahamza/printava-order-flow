import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from './useAuth';
import { supabase } from '@/integrations/supabase/client';
import type { AppRole } from '@/features/settings/types/teamRoles';

/** Most privileged first; legacy roles not listed fall back to first in `roles`. */
const PRIMARY_ROLE_PRIORITY = ['admin', 'sales', 'designer', 'production', 'accountant'] as const;

function pickPrimaryRole(roles: string[]): string | null {
  if (roles.length === 0) return null;
  for (const r of PRIMARY_ROLE_PRIORITY) {
    if (roles.includes(r)) return r;
  }
  return roles[0];
}

interface UserProfile {
  id: string;
  full_name: string | null;
  /** Primary role for backward compatibility (most privileged among assigned roles). */
  role: string | null;
  company_id: string | null;
  company_name?: string | null;
}

export function useUserRole() {
  const { user } = useAuth();
  const userId = user?.id ?? null;

  const { data: profileData, isLoading: profileLoading } = useQuery({
    queryKey: ['user-profile', userId],
    enabled: Boolean(userId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, company_id')
        .eq('id', userId!)
        .single();

      if (error) throw error;
      return data;
    },
  });

  const { data: roles = [], isLoading: rolesLoading } = useQuery({
    queryKey: ['user-roles', userId],
    enabled: Boolean(userId),
    queryFn: async () => {
      let roleQuery = supabase.from('user_roles').select('role').eq('user_id', userId!);
      if (profileData?.company_id) {
        roleQuery = roleQuery.eq('company_id', profileData.company_id);
      }

      const { data, error } = await roleQuery;
      if (error) throw error;
      return [...new Set((data ?? []).map((row) => row.role).filter(Boolean) as AppRole[])];
    },
  });

  const { data: companyName } = useQuery({
    queryKey: ['company-name', profileData?.company_id],
    enabled: Boolean(profileData?.company_id),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('companies')
        .select('name')
        .eq('id', profileData!.company_id!)
        .single();

      if (error) throw error;
      return data?.name ?? null;
    },
  });

  const profile = useMemo<UserProfile | null>(() => {
    if (!profileData) return null;
    return {
      ...profileData,
      role: pickPrimaryRole(roles),
      company_name: companyName ?? null,
    };
  }, [companyName, profileData, roles]);

  const loading = Boolean(userId) && (profileLoading || rolesLoading);

  const isAdmin = roles.includes('admin');
  const isSales = roles.includes('sales');
  const isDesigner = roles.includes('designer');
  const isProduction = roles.includes('production');
  const canViewFinancials = isAdmin || isSales;

  return {
    profile,
    loading,
    roles,
    role: profile?.role ?? null,
    companyId: profile?.company_id ?? null,
    fullName: profile?.full_name ?? null,
    companyName: profile?.company_name ?? null,
    isAdmin,
    isSales,
    isDesigner,
    isProduction,
    canViewFinancials,
  };
}
