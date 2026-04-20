import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useUserRole } from "@/hooks/useUserRole";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Edit, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { OrderStatus, useOrderStatuses } from "@/hooks/useOrderStatuses";
import { type TaskStatus, useTaskStatuses } from "@/hooks/useTaskStatuses";

const StatusSettings = () => {
  const { role, loading: roleLoading } = useUserRole();
  const queryClient = useQueryClient();
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingStatus, setEditingStatus] = useState<OrderStatus | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    color: "#6366f1",
    sort_order: 0,
  });

  const [isEditTaskDialogOpen, setIsEditTaskDialogOpen] = useState(false);
  const [editingTaskStatus, setEditingTaskStatus] = useState<TaskStatus | null>(null);
  const [taskFormData, setTaskFormData] = useState({
    name: "",
    color: "#6366f1",
    sort_order: 0,
  });

  const { data: statuses, isLoading } = useOrderStatuses();
  const { data: taskStatuses, isLoading: taskStatusesLoading } = useTaskStatuses();

  const updateMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<OrderStatus> }) => {
      const { error } = await supabase
        .from("order_statuses")
        .update(updates)
        .eq("id", id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["orderStatuses"] });
      toast.success("Status updated successfully");
      setIsEditDialogOpen(false);
      setEditingStatus(null);
    },
    onError: (error: Error) => {
      toast.error(`Failed to update status: ${error.message}`);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("order_statuses")
        .delete()
        .eq("id", id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["orderStatuses"] });
      toast.success("Status deleted successfully");
    },
    onError: (error: Error) => {
      toast.error(`Failed to delete status: ${error.message}`);
    },
  });

  const updateTaskMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<TaskStatus> }) => {
      const { error } = await supabase.from("task_statuses").update(updates).eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["taskStatuses"] });
      toast.success("Task status updated successfully");
      setIsEditTaskDialogOpen(false);
      setEditingTaskStatus(null);
    },
    onError: (error: Error) => {
      toast.error(`Failed to update task status: ${error.message}`);
    },
  });

  const deleteTaskMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("task_statuses").delete().eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["taskStatuses"] });
      toast.success("Task status deleted successfully");
    },
    onError: (error: Error) => {
      toast.error(`Failed to delete task status: ${error.message}`);
    },
  });

  const handleEdit = () => {
    if (!editingStatus) return;
    updateMutation.mutate({
      id: editingStatus.id,
      updates: {
        name: formData.name,
        color: formData.color,
        sort_order: formData.sort_order,
      },
    });
  };

  const handleDelete = (id: string) => {
    if (confirm("Are you sure you want to delete this status?")) {
      deleteMutation.mutate(id);
    }
  };

  const openEditDialog = (status: OrderStatus) => {
    setEditingStatus(status);
    setFormData({
      name: status.name,
      color: status.color,
      sort_order: status.sort_order,
    });
    setIsEditDialogOpen(true);
  };

  const handleEditTask = () => {
    if (!editingTaskStatus) return;
    updateTaskMutation.mutate({
      id: editingTaskStatus.id,
      updates: {
        name: taskFormData.name,
        color: taskFormData.color,
        sort_order: taskFormData.sort_order,
      },
    });
  };

  const handleDeleteTask = (id: string) => {
    if (confirm("Are you sure you want to delete this task status?")) {
      deleteTaskMutation.mutate(id);
    }
  };

  const openTaskEditDialog = (status: TaskStatus) => {
    setEditingTaskStatus(status);
    setTaskFormData({
      name: status.name,
      color: status.color?.trim() ? status.color : "#6366f1",
      sort_order: status.sort_order,
    });
    setIsEditTaskDialogOpen(true);
  };

  if (roleLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (role && role !== "admin") {
    return (
      <div className="container mx-auto p-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold">Access Denied</h1>
          <p className="text-muted-foreground mt-2">You don't have permission to access this page.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Status Settings</h1>
        <p className="text-muted-foreground mt-2">
          Manage order workflow statuses and granular task statuses for design and production.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Order Statuses</CardTitle>
          <CardDescription>
            System statuses are read-only. Custom statuses can be edited or deleted.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8">Loading statuses...</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Color</TableHead>
                  <TableHead>Sort Order</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {statuses?.map((status) => {
                  const isGlobal = status.company_id === null;
                  return (
                    <TableRow key={status.id}>
                      <TableCell className="font-medium">{status.name}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div
                            className="w-6 h-6 rounded border"
                            style={{ backgroundColor: status.color }}
                          />
                          <span className="text-sm text-muted-foreground">{status.color}</span>
                        </div>
                      </TableCell>
                      <TableCell>{status.sort_order}</TableCell>
                      <TableCell>
                        {isGlobal ? (
                          <Badge variant="secondary">System</Badge>
                        ) : (
                          <Badge variant="outline">Custom</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        {isGlobal ? (
                          <span className="text-sm text-muted-foreground">Read-only</span>
                        ) : (
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => openEditDialog(status)}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleDelete(status.id)}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Task Statuses</CardTitle>
          <CardDescription>
            Manage statuses for individual design and production tasks.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {taskStatusesLoading ? (
            <div className="text-center py-8">Loading task statuses...</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Color</TableHead>
                  <TableHead>Sort Order</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {taskStatuses?.map((status) => {
                  const isGlobal = status.company_id === null;
                  const previewColor =
                    status.color?.trim() ? status.color : "#94a3b8";
                  const hexLabel = status.color?.trim() ?? "—";
                  return (
                    <TableRow key={status.id}>
                      <TableCell className="font-medium">{status.name}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div
                            className="w-6 h-6 rounded border shrink-0"
                            style={{ backgroundColor: previewColor }}
                          />
                          <span className="text-sm text-muted-foreground">{hexLabel}</span>
                        </div>
                      </TableCell>
                      <TableCell>{status.sort_order}</TableCell>
                      <TableCell>
                        {isGlobal ? (
                          <span className="text-sm text-muted-foreground">
                            System (Read-only)
                          </span>
                        ) : (
                          <Badge variant="outline">Custom</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        {isGlobal ? (
                          <span className="text-sm text-muted-foreground">Read-only</span>
                        ) : (
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => openTaskEditDialog(status)}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleDeleteTask(status.id)}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Status</DialogTitle>
            <DialogDescription>
              Update the status details
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit-name">Status Name</Label>
              <Input
                id="edit-name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-color">Color (Hex)</Label>
              <div className="flex gap-2">
                <Input
                  id="edit-color"
                  type="color"
                  value={formData.color}
                  onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                  className="w-20 h-10"
                />
                <Input
                  value={formData.color}
                  onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-sort_order">Sort Order</Label>
              <Input
                id="edit-sort_order"
                type="number"
                value={formData.sort_order}
                onChange={(e) => setFormData({ ...formData, sort_order: parseInt(e.target.value) || 0 })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleEdit} disabled={updateMutation.isPending}>
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isEditTaskDialogOpen} onOpenChange={setIsEditTaskDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Task Status</DialogTitle>
            <DialogDescription>Update the task status details</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="task-edit-name">Status Name</Label>
              <Input
                id="task-edit-name"
                value={taskFormData.name}
                onChange={(e) => setTaskFormData({ ...taskFormData, name: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="task-edit-color">Color (Hex)</Label>
              <div className="flex gap-2">
                <Input
                  id="task-edit-color"
                  type="color"
                  value={taskFormData.color}
                  onChange={(e) => setTaskFormData({ ...taskFormData, color: e.target.value })}
                  className="w-20 h-10"
                />
                <Input
                  value={taskFormData.color}
                  onChange={(e) => setTaskFormData({ ...taskFormData, color: e.target.value })}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="task-edit-sort_order">Sort Order</Label>
              <Input
                id="task-edit-sort_order"
                type="number"
                value={taskFormData.sort_order}
                onChange={(e) =>
                  setTaskFormData({ ...taskFormData, sort_order: parseInt(e.target.value) || 0 })
                }
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditTaskDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleEditTask} disabled={updateTaskMutation.isPending}>
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default StatusSettings;
