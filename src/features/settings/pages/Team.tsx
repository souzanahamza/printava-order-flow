import { useState, useEffect, useCallback } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { useUserRole } from '@/hooks/useUserRole';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RolePicker } from '@/features/settings/components/RolePicker';
import { ROLE_OPTIONS, formatRoleLabel, type AppRole } from '@/features/settings/types/teamRoles';
import { toast } from 'sonner';
import { MoreVertical, UserPlus } from 'lucide-react';

interface TeamMember {
  id: string;
  full_name: string | null;
  roles: AppRole[];
  email: string | null;
}

interface UpdateMemberPayload {
  memberId: string;
  fullName: string;
  nextRoles: AppRole[];
  companyId: string;
  actorUserId: string | null;
}

export default function Team() {
  const { user } = useAuth();
  const { isAdmin, companyId, loading: roleLoading } = useUserRole();
  const queryClient = useQueryClient();
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [selectedMember, setSelectedMember] = useState<TeamMember | null>(null);
  const [editedMember, setEditedMember] = useState({
    fullName: '',
    roles: ['sales'] as AppRole[],
  });
  const [newMember, setNewMember] = useState({
    email: '',
    fullName: '',
    roles: ['sales'] as AppRole[],
    password: '',
  });

  const fetchTeamMembers = useCallback(async () => {
    if (!companyId) return;
    try {
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('id, full_name, email')
        .eq('company_id', companyId)
        .order('full_name');

      if (profilesError) throw profilesError;

      const { data: roleRows, error: rolesError } = await supabase
        .from('user_roles')
        .select('user_id, role')
        .eq('company_id', companyId);

      if (rolesError) throw rolesError;

      const rolesByUser = new Map<string, string[]>();
      for (const row of roleRows ?? []) {
        const list = rolesByUser.get(row.user_id) ?? [];
        list.push(row.role);
        rolesByUser.set(row.user_id, list);
      }

      const membersWithRoles: TeamMember[] = (profiles ?? []).map((profile) => ({
        ...profile,
        roles: ([...(rolesByUser.get(profile.id) ?? [])].sort() as AppRole[]),
      }));

      setTeamMembers(membersWithRoles);
    } catch (error) {
      console.error('Error fetching team members:', error);
      toast.error('Failed to load team members');
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => {
    if (companyId) {
      fetchTeamMembers();
    }
  }, [companyId, fetchTeamMembers]);

  const handleAddMember = async () => {
    try {
      if (!newMember.email || !newMember.fullName || !newMember.password) {
        toast.error('Please fill in all fields');
        return;
      }
      if (newMember.roles.length === 0) {
        toast.error('Select at least one role');
        return;
      }

      const { data, error } = await supabase.functions.invoke('create-user-direct', {
        body: {
          email: newMember.email,
          password: newMember.password,
          fullName: newMember.fullName,
          roles: newMember.roles,
          companyId: companyId,
        },
      });

      const getEdgeFunctionErrorMessage = (err: { context?: { body?: unknown }; message?: string }) => {
        const body = err?.context?.body;
        if (typeof body === 'string') {
          try {
            const parsed = JSON.parse(body) as { error?: string };
            if (parsed?.error) return String(parsed.error);
          } catch {
            // ignore
          }
        }
        if (body && typeof body === 'object' && body !== null && 'error' in body) {
          return String((body as { error?: string }).error);
        }
        return err?.message ? String(err.message) : 'Failed to add team member';
      };

      if (error) {
        toast.error(getEdgeFunctionErrorMessage(error));
        return;
      }

      if (!data?.success) {
        toast.error(String((data as { error?: string })?.error ?? 'Failed to add team member'));
        return;
      }

      toast.success('Team member created successfully');
      setIsAddDialogOpen(false);
      setNewMember({ email: '', fullName: '', roles: ['sales'], password: '' });
      fetchTeamMembers();
    } catch (error: unknown) {
      console.error('Error adding member:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to add team member');
    }
  };

  const handleUpdateMember = async () => {
    if (!selectedMember || !companyId) return;

    if (!editedMember.fullName.trim()) {
      toast.error('Full name cannot be empty');
      return;
    }
    if (editedMember.roles.length === 0) {
      toast.error('Select at least one role');
      return;
    }

    await updateMemberMutation.mutateAsync({
      memberId: selectedMember.id,
      fullName: editedMember.fullName,
      nextRoles: editedMember.roles,
      companyId,
      actorUserId: user?.id ?? null,
    });
  };

  const updateMemberMutation = useMutation({
    mutationFn: async (payload: UpdateMemberPayload) => {
      const dedupedNextRoles = [...new Set(payload.nextRoles)] as AppRole[];
      if (dedupedNextRoles.length === 0) {
        throw new Error('Select at least one role');
      }

      const { data: existingRoleRows, error: existingRolesError } = await supabase
        .from('user_roles')
        .select('id, role, user_id, company_id')
        .eq('user_id', payload.memberId)
        .eq('company_id', payload.companyId);

      if (existingRolesError) throw existingRolesError;

      const existingRoles = (existingRoleRows ?? []).map((row) => row.role) as AppRole[];
      const existingRoleSet = new Set(existingRoles);
      const nextRoleSet = new Set(dedupedNextRoles);

      if (
        payload.actorUserId === payload.memberId &&
        existingRoleSet.has('admin') &&
        !nextRoleSet.has('admin')
      ) {
        throw new Error("You can't remove the admin role from your own account.");
      }

      const rolesToDelete = existingRoles.filter((role) => !nextRoleSet.has(role));
      const rolesToInsert = dedupedNextRoles.filter((role) => !existingRoleSet.has(role));

      const { error: profileError } = await supabase
        .from('profiles')
        .update({ full_name: payload.fullName.trim() })
        .eq('id', payload.memberId)
        .eq('company_id', payload.companyId);
      if (profileError) throw profileError;

      const roleOps = [];
      if (rolesToDelete.length > 0) {
        roleOps.push(
          supabase
            .from('user_roles')
            .delete()
            .eq('user_id', payload.memberId)
            .eq('company_id', payload.companyId)
            .in('role', rolesToDelete)
        );
      }
      if (rolesToInsert.length > 0) {
        roleOps.push(
          supabase.from('user_roles').insert(
            rolesToInsert.map((role) => ({
              user_id: payload.memberId,
              company_id: payload.companyId,
              role,
            }))
          )
        );
      }

      const roleResults = await Promise.all(roleOps);
      for (const result of roleResults) {
        if (result.error) throw result.error;
      }

      return { memberId: payload.memberId };
    },
    onSuccess: async ({ memberId }) => {
      toast.success('Member updated successfully');
      await Promise.all([
        fetchTeamMembers(),
        queryClient.invalidateQueries({ queryKey: ['user-roles', memberId] }),
      ]);
      if (user?.id === memberId) {
        await queryClient.invalidateQueries({ queryKey: ['user-profile', memberId] });
      }
      setIsEditDialogOpen(false);
      setSelectedMember(null);
    },
    onError: (error) => {
      console.error('Error updating member:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to update member');
    },
  });

  const handleDeleteMember = async (memberId: string) => {
    if (memberId === user?.id) {
      toast.error('You cannot delete yourself');
      return;
    }

    if (!confirm('Are you sure you want to delete this team member?')) {
      return;
    }

    if (!companyId) return;

    try {
      const { error } = await supabase.from('profiles').delete().eq('id', memberId).eq('company_id', companyId);

      if (error) throw error;

      toast.success('Team member deleted successfully');
      fetchTeamMembers();
    } catch (error) {
      console.error('Error deleting member:', error);
      toast.error('Failed to delete team member');
    }
  };

  if (!isAdmin) {
    return (
      <div className="container mx-auto p-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold">Access Denied</h1>
          <p className="text-muted-foreground mt-2">You don&apos;t have permission to access this page.</p>
        </div>
      </div>
    );
  }

  if (loading || roleLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold">Team Management</h1>
          <p className="text-muted-foreground mt-2">Manage your team members and their roles</p>
        </div>

        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <UserPlus className="mr-2 h-4 w-4" />
              Add Member
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Add Team Member</DialogTitle>
              <DialogDescription>Create a new team member account with direct access</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="member@example.com"
                  value={newMember.email}
                  onChange={(e) => setNewMember({ ...newMember, email: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="fullName">Full Name</Label>
                <Input
                  id="fullName"
                  placeholder="John Doe"
                  value={newMember.fullName}
                  onChange={(e) => setNewMember({ ...newMember, fullName: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="Enter password"
                  value={newMember.password}
                  onChange={(e) => setNewMember({ ...newMember, password: e.target.value })}
                />
              </div>
              <RolePicker
                idPrefix="add"
                value={newMember.roles}
                onChange={(roles) => setNewMember({ ...newMember, roles })}
              />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleAddMember}>Create User</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Full Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Roles</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {teamMembers.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                  No team members found
                </TableCell>
              </TableRow>
            ) : (
              teamMembers.map((member) => (
                <TableRow key={member.id}>
                  <TableCell className="font-medium">
                    {member.full_name || 'Unnamed User'}
                    {member.id === user?.id && (
                      <span className="ml-2 text-xs text-muted-foreground">(You)</span>
                    )}
                  </TableCell>
                  <TableCell className="text-muted-foreground">{member.email || 'N/A'}</TableCell>
                  <TableCell>
                    {member.roles.length ? (
                      <div className="flex flex-wrap gap-1.5">
                        {member.roles.map((role) => (
                          <Badge
                            key={`${member.id}-${role}`}
                            variant="outline"
                            className={ROLE_OPTIONS.find((option) => option.role === role)?.badgeClassName}
                          >
                            {formatRoleLabel(role)}
                          </Badge>
                        ))}
                      </div>
                    ) : (
                      <span className="text-sm text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                      Active
                    </span>
                  </TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          onClick={() => {
                            setSelectedMember(member);
                            setEditedMember({
                              fullName: member.full_name || '',
                              roles: member.roles,
                            });
                            setIsEditDialogOpen(true);
                          }}
                        >
                          Edit Member
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="text-destructive"
                          onClick={() => handleDeleteMember(member.id)}
                          disabled={member.id === user?.id}
                        >
                          Delete Member
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>

      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Team Member</DialogTitle>
            <DialogDescription>
              Update details and roles for {selectedMember?.full_name || 'this member'}.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit-fullName">Full Name</Label>
              <Input
                id="edit-fullName"
                placeholder="John Doe"
                value={editedMember.fullName}
                onChange={(e) => setEditedMember({ ...editedMember, fullName: e.target.value })}
              />
            </div>
            <RolePicker
              idPrefix="edit"
              value={editedMember.roles}
              onChange={(roles) => setEditedMember({ ...editedMember, roles })}
              disabledRoles={
                selectedMember?.id === user?.id && selectedMember.roles.includes('admin') ? ['admin'] : []
              }
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleUpdateMember} disabled={updateMemberMutation.isPending}>
              {updateMemberMutation.isPending ? 'Saving...' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
