import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { usePricingTiers } from "@/hooks/usePricingTiers";
import { useUserRole } from "@/hooks/useUserRole";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";

export default function PricingSettings() {
  const navigate = useNavigate();
  const { role, companyId } = useUserRole();
  const { data: tiers, isLoading } = usePricingTiers();
  const queryClient = useQueryClient();

  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingTier, setEditingTier] = useState<any>(null);
  const [formData, setFormData] = useState({
    name: "",
    label: "",
    markup_percent: "",
  });

  // Redirect if not admin (using useEffect to avoid hooks violation)
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

  const handleAdd = async () => {
    const markupValue = parseFloat(formData.markup_percent);
    
    if (!formData.name || isNaN(markupValue)) {
      toast.error("Please fill all fields with valid values");
      return;
    }

    const { error } = await supabase.from("pricing_tiers").insert({
      name: formData.name,
      label: formData.label || null,
      markup_percent: markupValue,
      company_id: companyId,
    });

    if (error) {
      toast.error("Failed to add pricing tier");
      console.error(error);
      return;
    }

    toast.success("Pricing tier added successfully");
    setIsAddDialogOpen(false);
    setFormData({ name: "", label: "", markup_percent: "" });
    queryClient.invalidateQueries({ queryKey: ["pricingTiers"] });
  };

  const handleEdit = async () => {
    const markupValue = parseFloat(formData.markup_percent);
    
    if (!formData.name || isNaN(markupValue)) {
      toast.error("Please fill all fields with valid values");
      return;
    }

    const { error } = await supabase
      .from("pricing_tiers")
      .update({
        name: formData.name,
        label: formData.label || null,
        markup_percent: markupValue,
      })
      .eq("id", editingTier.id);

    if (error) {
      toast.error("Failed to update pricing tier");
      console.error(error);
      return;
    }

    toast.success("Pricing tier updated successfully");
    setIsEditDialogOpen(false);
    setEditingTier(null);
    setFormData({ name: "", label: "", markup_percent: "" });
    queryClient.invalidateQueries({ queryKey: ["pricingTiers"] });
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this pricing tier?")) return;

    const { error } = await supabase.from("pricing_tiers").delete().eq("id", id);

    if (error) {
      toast.error("Failed to delete pricing tier");
      console.error(error);
      return;
    }

    toast.success("Pricing tier deleted successfully");
    queryClient.invalidateQueries({ queryKey: ["pricingTiers"] });
  };

  const openEditDialog = (tier: any) => {
    setEditingTier(tier);
    setFormData({
      name: tier.name,
      label: tier.label || "",
      markup_percent: tier.markup_percent.toString(),
    });
    setIsEditDialogOpen(true);
  };

  if (isLoading) {
    return <div className="p-8">Loading...</div>;
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Pricing Tiers</h1>
          <p className="text-muted-foreground mt-2">
            Manage pricing tiers and markup percentages
          </p>
        </div>
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Add Pricing Tier
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add New Pricing Tier</DialogTitle>
              <DialogDescription>
                Create a custom pricing tier for your company
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="name">Name</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                  placeholder="e.g., Retail, Wholesale"
                />
              </div>
              <div>
                <Label htmlFor="label">Label (Optional)</Label>
                <Input
                  id="label"
                  value={formData.label}
                  onChange={(e) =>
                    setFormData({ ...formData, label: e.target.value })
                  }
                  placeholder="e.g., Best for retail customers"
                />
              </div>
              <div>
                <Label htmlFor="markup">Markup Percentage (%)</Label>
                <Input
                  id="markup"
                  type="number"
                  step="1"
                  min="0"
                  value={formData.markup_percent}
                  onChange={(e) =>
                    setFormData({ ...formData, markup_percent: e.target.value })
                  }
                  placeholder="e.g., 20"
                />
                <p className="text-sm text-muted-foreground mt-1">
                  Example: Enter 20 for a 20% price increase
                </p>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleAdd}>Add Tier</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Available Pricing Tiers</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Label</TableHead>
                <TableHead>Markup</TableHead>
                <TableHead>Type</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tiers?.map((tier) => {
                const isGlobal = tier.company_id === null;
                return (
                  <TableRow key={tier.id}>
                    <TableCell className="font-medium">{tier.name}</TableCell>
                    <TableCell>{tier.label || "-"}</TableCell>
                    <TableCell>{tier.markup_percent}%</TableCell>
                    <TableCell>
                      {isGlobal ? (
                        <Badge variant="secondary">System</Badge>
                      ) : (
                        <Badge>Custom</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      {!isGlobal && (
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => openEditDialog(tier)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDelete(tier.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Pricing Tier</DialogTitle>
            <DialogDescription>
              Update the pricing tier details
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="edit-name">Name</Label>
              <Input
                id="edit-name"
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
              />
            </div>
            <div>
              <Label htmlFor="edit-label">Label (Optional)</Label>
              <Input
                id="edit-label"
                value={formData.label}
                onChange={(e) =>
                  setFormData({ ...formData, label: e.target.value })
                }
              />
            </div>
            <div>
              <Label htmlFor="edit-markup">Markup Percentage (%)</Label>
              <Input
                id="edit-markup"
                type="number"
                step="1"
                min="0"
                value={formData.markup_percent}
                onChange={(e) =>
                  setFormData({ ...formData, markup_percent: e.target.value })
                }
              />
              <p className="text-sm text-muted-foreground mt-1">
                Example: Enter 20 for a 20% price increase
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsEditDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button onClick={handleEdit}>Save Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
