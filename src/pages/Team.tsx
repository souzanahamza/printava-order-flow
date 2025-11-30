import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useUserRole } from '@/hooks/useUserRole';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { MoreVertical, Plus, UserPlus } from 'lucide-react';
import { Navigate } from 'react-router-dom';

interface TeamMember {
  id: string;
  full_name: string | null;
  role: string | null;
  email: string | null;
}

const ROLES = ['admin', 'sales', 'designer', 'accountant', 'production', 'packaging'];

export default function Team() {
  const { user } = useAuth();
  const { role, companyId, loading: roleLoading } = useUserRole();
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [selectedMember, setSelectedMember] = useState<TeamMember | null>(null);
  const [editedMember, setEditedMember] = useState({
    fullName: '',
    role: 'sales' as string,
  });
  const [newMember, setNewMember] = useState({
    email: '',
    fullName: '',
    role: 'sales' as string,
    password: '',
  });

  useEffect(() => {
    if (companyId) {
      fetchTeamMembers();
    }
  }, [companyId]);

  const fetchTeamMembers = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, role, email')
        .eq('company_id', companyId)
        .order('full_name');

      if (error) throw error;
      setTeamMembers(data || []);
    } catch (error) {
      console.error('Error fetching team members:', error);
      toast.error('Failed to load team members');
    } finally {
      setLoading(false);
    }
  };

  const handleAddMember = async () => {
    try {
      if (!newMember.email || !newMember.fullName || !newMember.password) {
        toast.error('Please fill in all fields');
        return;
      }

      const { data, error } = await supabase.functions.invoke('create-user-direct', {
        body: {
          email: newMember.email,
          password: newMember.password,
          fullName: newMember.fullName,
          role: newMember.role,
          companyId: companyId,
        },
      });

      if (error) throw error;

      // Check if the response contains an error
      if (data?.error) {
        toast.error(data.error);
        return;
      }

      toast.success('Team member created successfully');
      setIsAddDialogOpen(false);
      setNewMember({ email: '', fullName: '', role: 'sales', password: '' });
      fetchTeamMembers();
    } catch (error) {
      console.error('Error adding member:', error);
      toast.error('Failed to add team member');
    }
  };

  const handleUpdateMember = async () => {
    if (!selectedMember) return;
    
    try {
      if (!editedMember.fullName.trim()) {
        toast.error('Full name cannot be empty');
        return;
      }

      const { error } = await supabase
        .from('profiles')
        .update({ 
          full_name: editedMember.fullName,
          role: editedMember.role 
        })
        .eq('id', selectedMember.id);

      if (error) throw error;
      
      toast.success('Member updated successfully');
      fetchTeamMembers();
      setIsEditDialogOpen(false);
      setSelectedMember(null);
    } catch (error) {
      console.error('Error updating member:', error);
      toast.error('Failed to update member');
    }
  };

  const handleDeleteMember = async (memberId: string) => {
    if (memberId === user?.id) {
      toast.error('You cannot delete yourself');
      return;
    }

    if (!confirm('Are you sure you want to delete this team member?')) {
      return;
    }

    try {
      const { error } = await supabase
        .from('profiles')
        .delete()
        .eq('id', memberId);

      if (error) throw error;
      
      toast.success('Team member deleted successfully');
      fetchTeamMembers();
    } catch (error) {
      console.error('Error deleting member:', error);
      toast.error('Failed to delete team member');
    }
  };

  // Redirect if not admin
  if (role && role !== 'admin') {
    return (
      <div className="container mx-auto p-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold">Access Denied</h1>
          <p className="text-muted-foreground mt-2">You don't have permission to access this page.</p>
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
          <p className="text-muted-foreground mt-2">
            Manage your team members and their roles
          </p>
        </div>
        
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <UserPlus className="mr-2 h-4 w-4" />
              Add Member
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Team Member</DialogTitle>
              <DialogDescription>
                Create a new team member account with direct access
              </DialogDescription>
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
              <div className="space-y-2">
                <Label htmlFor="role">Role</Label>
                <Select
                  value={newMember.role}
                  onValueChange={(value) => setNewMember({ ...newMember, role: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ROLES.map((role) => (
                      <SelectItem key={role} value={role}>
                        {role.charAt(0).toUpperCase() + role.slice(1)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
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
              <TableHead>Role</TableHead>
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
                  <TableCell className="text-muted-foreground">
                    {member.email || 'N/A'}
                  </TableCell>
                  <TableCell>
                    <span className="capitalize">{member.role || 'N/A'}</span>
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
                              role: member.role || 'sales',
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
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Team Member</DialogTitle>
            <DialogDescription>
              Update details for {selectedMember?.full_name || 'this member'}
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
            <div className="space-y-2">
              <Label htmlFor="edit-role">Role</Label>
              <Select
                value={editedMember.role}
                onValueChange={(value) => setEditedMember({ ...editedMember, role: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ROLES.map((role) => (
                    <SelectItem key={role} value={role}>
                      {role.charAt(0).toUpperCase() + role.slice(1)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleUpdateMember}>Save Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
