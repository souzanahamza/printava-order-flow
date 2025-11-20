import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Package, User, Mail, Phone, Truck, Calendar, DollarSign, FileText, Download, Upload, Send, Archive } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";
import { useUserRole } from "@/hooks/useUserRole";
import { useOrderStatuses } from "@/hooks/useOrderStatuses";
import { toast } from "sonner";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
interface OrderDetailsProps {
  orderId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}
type OrderDetail = {
  id: string;
  client_name: string;
  email: string;
  phone: string | null;
  delivery_date: string;
  delivery_method: string | null;
  status: string;
  total_price: number;
  notes: string | null;
  created_at: string;
  pricing_tier?: {
    name: string;
    label: string;
  } | null;
  order_items: Array<{
    id: string;
    quantity: number;
    unit_price: number;
    item_total: number;
    product: {
      name_en: string;
      name_ar: string;
      image_url: string | null;
      sku: string;
    };
  }>;
};
type OrderAttachment = {
  id: string;
  file_name: string;
  file_url: string;
  file_type: string;
  file_size: number | null;
  created_at: string;
  uploader_id?: string;
  uploader_name?: string;
  uploader_role?: string;
};
export function OrderDetails({
  orderId,
  open,
  onOpenChange
}: OrderDetailsProps) {
  const queryClient = useQueryClient();
  const {
    role,
    companyId
  } = useUserRole();
  const {
    data: statuses
  } = useOrderStatuses();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [designerNotes, setDesignerNotes] = useState("");
  const [revisionFeedback, setRevisionFeedback] = useState("");
  const {
    data: order,
    isLoading
  } = useQuery({
    queryKey: ["order-details", orderId],
    queryFn: async () => {
      const {
        data,
        error
      } = await supabase.from("orders").select(`
          *,
          pricing_tier:pricing_tiers(name, label),
          order_items(
            id,
            quantity,
            unit_price,
            item_total,
            product:products(
              name_en,
              name_ar,
              sku,
              image_url
            )
          )
        `).eq("id", orderId).single();
      if (error) throw error;
      return data as OrderDetail;
    },
    enabled: open && !!orderId
  });
  const {
    data: attachments
  } = useQuery({
    queryKey: ["order-attachments", orderId],
    queryFn: async () => {
      const {
        data,
        error
      } = await supabase.from("order_attachments").select("*").eq("order_id", orderId).order("created_at", {
        ascending: false
      });
      if (error) throw error;

      // Fetch uploader profiles
      const uploaderIds = [...new Set(data?.map(a => a.uploader_id).filter(Boolean))];
      if (uploaderIds.length > 0) {
        const {
          data: profiles
        } = await supabase.from("profiles").select("id, full_name, role").in("id", uploaderIds);
        const profileMap = new Map(profiles?.map(p => [p.id, p]) || []);
        return data.map(attachment => ({
          ...attachment,
          uploader_name: attachment.uploader_id ? profileMap.get(attachment.uploader_id)?.full_name || "Unknown User" : undefined,
          uploader_role: attachment.uploader_id ? profileMap.get(attachment.uploader_id)?.role : undefined
        })) as OrderAttachment[];
      }
      return data as OrderAttachment[];
    },
    enabled: open && !!orderId
  });

  // Fetch order comments with user profiles
  const {
    data: comments
  } = useQuery({
    queryKey: ["order-comments", orderId],
    queryFn: async () => {
      // Fetch comments
      const {
        data: commentsData,
        error: commentsError
      } = await supabase.from("order_comments").select("*").eq("order_id", orderId).order("created_at", {
        ascending: true
      });
      if (commentsError) throw commentsError;
      if (!commentsData || commentsData.length === 0) return [];

      // Get unique user IDs
      const userIds = [...new Set(commentsData.map(c => c.user_id))];

      // Fetch profiles for these users
      const {
        data: profilesData,
        error: profilesError
      } = await supabase.from("profiles").select("id, full_name, role").in("id", userIds);
      if (profilesError) throw profilesError;

      // Map profiles to comments
      const profilesMap = new Map(profilesData?.map(p => [p.id, {
        name: p.full_name,
        role: p.role
      }]) || []);
      return commentsData.map(comment => {
        const profile = profilesMap.get(comment.user_id);
        return {
          ...comment,
          user_name: profile?.name || "Unknown User",
          user_role: profile?.role || null
        };
      });
    },
    enabled: open && !!orderId
  });

  // Separate attachments by type
  const clientFiles = attachments?.filter(file => file.file_type === "client_reference") || [];
  const designFiles = attachments?.filter(file => file.file_type === "design_mockup") || [];
  const formatFileSize = (bytes: number | null) => {
    if (!bytes) return "Unknown size";
    const mb = bytes / (1024 * 1024);
    return mb < 1 ? `${(bytes / 1024).toFixed(1)} KB` : `${mb.toFixed(2)} MB`;
  };

  // Designer submission mutation
  const submitDesignMutation = useMutation({
    mutationFn: async () => {
      if (!selectedFile || !companyId || !order) {
        throw new Error("Missing required data");
      }

      // Get current user
      const {
        data: {
          user
        }
      } = await supabase.auth.getUser();
      if (!user) throw new Error("User not authenticated");

      // Step A: Upload file to Supabase Storage
      const fileName = `${Date.now()}-${selectedFile.name}`;
      const filePath = `${companyId}/${orderId}/${fileName}`;
      const {
        error: uploadError
      } = await supabase.storage.from("order-files").upload(filePath, selectedFile);
      if (uploadError) throw uploadError;

      // Get public URL
      const {
        data: {
          publicUrl
        }
      } = supabase.storage.from("order-files").getPublicUrl(filePath);

      // Step B: Insert record into order_attachments
      const {
        error: attachmentError
      } = await supabase.from("order_attachments").insert({
        order_id: orderId,
        company_id: companyId,
        file_url: publicUrl,
        file_name: selectedFile.name,
        file_type: "design_mockup",
        file_size: selectedFile.size,
        uploader_id: user.id
      });
      if (attachmentError) throw attachmentError;

      // Step B.5: Save designer notes as a comment if provided
      if (designerNotes.trim()) {
        const {
          error: commentError
        } = await supabase.from("order_comments").insert({
          order_id: orderId,
          user_id: user.id,
          company_id: companyId,
          content: designerNotes.trim()
        });
        if (commentError) throw commentError;
      }

      // Step C: Update Order Status to 'Design Approval'
      const designApprovalStatus = statuses?.find(s => s.name === "Design Approval");
      if (designApprovalStatus) {
        const {
          error: statusError
        } = await supabase.from("orders").update({
          status: designApprovalStatus.name
        }).eq("id", orderId);
        if (statusError) throw statusError;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["order-details", orderId]
      });
      queryClient.invalidateQueries({
        queryKey: ["orders"]
      });
      toast.success("Design submitted for approval successfully!");
      setSelectedFile(null);
      setDesignerNotes("");
      onOpenChange(false);
    },
    onError: (error: Error) => {
      toast.error(`Failed to submit design: ${error.message}`);
    }
  });
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0]);
    }
  };
  const handleSubmitDesign = () => {
    if (!selectedFile) {
      toast.error("Please select a file to upload");
      return;
    }
    submitDesignMutation.mutate();
  };

  // Approve design mutation
  const approveDesignMutation = useMutation({
    mutationFn: async () => {
      const pendingPaymentStatus = statuses?.find(s => s.name === "Pending Payment");
      if (!pendingPaymentStatus) throw new Error("Pending Payment status not found");
      const {
        error
      } = await supabase.from("orders").update({
        status: pendingPaymentStatus.name
      }).eq("id", orderId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["order-details", orderId]
      });
      queryClient.invalidateQueries({
        queryKey: ["orders"]
      });
      toast.success("Design approved successfully!");
      onOpenChange(false);
    },
    onError: (error: Error) => {
      toast.error(`Failed to approve design: ${error.message}`);
    }
  });

  // Request revision mutation
  const requestRevisionMutation = useMutation({
    mutationFn: async () => {
      if (!revisionFeedback.trim()) {
        throw new Error("Feedback is required");
      }
      const currentUser = (await supabase.auth.getUser()).data.user;
      if (!currentUser || !companyId) throw new Error("Missing user data");

      // Step 1: Archive old design mockups
      const {
        error: archiveError
      } = await supabase.from("order_attachments").update({
        file_type: "archived_mockup"
      }).eq("order_id", orderId).eq("file_type", "design_mockup");
      if (archiveError) throw archiveError;

      // Step 2: Insert comment
      const {
        error: commentError
      } = await supabase.from("order_comments").insert({
        order_id: orderId,
        user_id: currentUser.id,
        company_id: companyId,
        content: revisionFeedback
      });
      if (commentError) throw commentError;

      // Step 3: Update order status
      const designRevisionStatus = statuses?.find(s => s.name === "Design Revision");
      if (designRevisionStatus) {
        const {
          error: statusError
        } = await supabase.from("orders").update({
          status: designRevisionStatus.name
        }).eq("id", orderId);
        if (statusError) throw statusError;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["order-details", orderId]
      });
      queryClient.invalidateQueries({
        queryKey: ["order-attachments", orderId]
      });
      queryClient.invalidateQueries({
        queryKey: ["order-comments", orderId]
      });
      queryClient.invalidateQueries({
        queryKey: ["orders"]
      });
      toast.success("Revision requested successfully! Previous designs archived.");
      setRevisionFeedback("");
      onOpenChange(false);
    },
    onError: (error: Error) => {
      toast.error(`Failed to request revision: ${error.message}`);
    }
  });
  const handleApproveDesign = () => {
    approveDesignMutation.mutate();
  };
  const handleRequestRevision = () => {
    if (!revisionFeedback.trim()) {
      toast.error("Please provide feedback for the revision");
      return;
    }
    requestRevisionMutation.mutate();
  };

  // Check if Designer Workspace should be visible
  const showDesignerWorkspace = role === "designer" && order?.status && (order.status === "In Design" || order.status === "Design Revision");

  // Check if Sales Review section should be visible
  const showSalesReview = (role === "sales" || role === "admin") && order?.status === "Design Approval";
  return <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        {isLoading ? <div className="space-y-6">
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-48 w-full" />
            <Skeleton className="h-64 w-full" />
          </div> : order ? <div className="space-y-10">
            {/* Header */}
            <DialogHeader className="-bottom-10 ">
              <div className="flex items-start justify-between gap-16 ">
                <div className="space-y-2">
                  <DialogTitle className="text-3xl font-bold flex items-center gap-3">
                    <Package className="h-8 w-8 text-primary" />
                    Order #{order.id.slice(0, 8).toUpperCase()}
                  </DialogTitle>
                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    <span className="flex items-center gap-1.5">
                      <Calendar className="h-4 w-4" />
                      {format(new Date(order.created_at), "PPP")}
                    </span>
                    <span className="flex items-center gap-1.5">
                      <DollarSign className="h-4 w-4" />
                      ${order.total_price?.toFixed(2)}
                    </span>
                  </div>
                </div>
                <StatusBadge status={order.status} className="text-lg px-4 py-2" />
              </div>
            </DialogHeader>

            {/* Client Info Card */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <User className="h-5 w-5 text-primary" />
                  Client Information
                </CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <div className="text-sm font-medium text-muted-foreground">Name</div>
                  <div className="text-base font-semibold">{order.client_name}</div>
                </div>
                <div className="space-y-1">
                  <div className="text-sm font-medium text-muted-foreground flex items-center gap-1.5">
                    <Mail className="h-4 w-4" />
                    Email
                  </div>
                  <div className="text-base">{order.email}</div>
                </div>
                {order.phone && <div className="space-y-1">
                    <div className="text-sm font-medium text-muted-foreground flex items-center gap-1.5">
                      <Phone className="h-4 w-4" />
                      Phone
                    </div>
                    <div className="text-base">{order.phone}</div>
                  </div>}
                {order.delivery_method && <div className="space-y-1">
                    <div className="text-sm font-medium text-muted-foreground flex items-center gap-1.5">
                      <Truck className="h-4 w-4" />
                      Delivery Method
                    </div>
                    <div className="text-base capitalize">{order.delivery_method}</div>
                  </div>}
                <div className="space-y-1">
                  <div className="text-sm font-medium text-muted-foreground flex items-center gap-1.5">
                    <Calendar className="h-4 w-4" />
                    Delivery Date
                  </div>
                  <div className="text-base">{format(new Date(order.delivery_date), "PPP")}</div>
                </div>
                {order.pricing_tier && <div className="space-y-1">
                    <div className="text-sm font-medium text-muted-foreground">Pricing Tier</div>
                    <div className="text-base">{order.pricing_tier.label || order.pricing_tier.name}</div>
                  </div>}
              </CardContent>
            </Card>

            {/* Order Items Table */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Package className="h-5 w-5 text-primary" />
                  Order Items
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="rounded-lg border overflow-hidden">
                  <table className="w-full">
                    <thead className="bg-muted/50">
                      <tr>
                        <th className="text-left p-4 font-medium">Product</th>
                        <th className="text-center p-4 font-medium">SKU</th>
                        <th className="text-center p-4 font-medium">Quantity</th>
                        <th className="text-right p-4 font-medium">Unit Price</th>
                        <th className="text-right p-4 font-medium">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {order.order_items.map(item => <tr key={item.id} className="border-t">
                          <td className="p-4">
                            <div className="flex items-center gap-3">
                              {item.product.image_url ? <img src={item.product.image_url} alt={item.product.name_en} className="h-12 w-12 rounded object-cover" /> : <div className="h-12 w-12 rounded bg-muted flex items-center justify-center">
                                  <Package className="h-6 w-6 text-muted-foreground" />
                                </div>}
                              <div>
                                <div className="font-medium">{item.product.name_en}</div>
                                <div className="text-sm text-muted-foreground">{item.product.name_ar}</div>
                              </div>
                            </div>
                          </td>
                          <td className="p-4 text-center text-sm text-muted-foreground">
                            {item.product.sku}
                          </td>
                          <td className="p-4 text-center font-medium">{item.quantity}</td>
                          <td className="p-4 text-right">${item.unit_price.toFixed(2)}</td>
                          <td className="p-4 text-right font-semibold">${item.item_total.toFixed(2)}</td>
                        </tr>)}
                    </tbody>
                    <tfoot className="bg-muted/30 border-t-2">
                      <tr>
                        <td colSpan={4} className="p-4 text-right font-semibold">Total:</td>
                        <td className="p-4 text-right text-lg font-bold text-primary">
                          ${order.total_price?.toFixed(2)}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </CardContent>
            </Card>

            {/* Design Proofs & Mockups */}
            {designFiles.length > 0 && <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Upload className="h-5 w-5 text-primary" />
                    Design Proofs & Mockups
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {designFiles.map(file => <div key={file.id} className="flex items-center justify-between p-4 rounded-lg border bg-card hover:bg-muted/50 transition-colors">
                        <div className="flex items-center gap-3 min-w-0 flex-1">
                          <div className="h-10 w-10 rounded bg-primary/10 flex items-center justify-center flex-shrink-0">
                            <FileText className="h-5 w-5 text-primary" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="font-medium truncate">{file.file_name}</div>
                            <div className="text-sm text-muted-foreground">
                              {formatFileSize(file.file_size)}
                            </div>
                          </div>
                        </div>
                        <Button variant="outline" size="sm" className="ml-2 flex-shrink-0" asChild>
                          <a href={file.file_url} download target="_blank" rel="noopener noreferrer">
                            <Download className="h-4 w-4 mr-1" />
                            Download
                          </a>
                        </Button>
                      </div>)}
                  </div>
                </CardContent>
              </Card>}

            {/* Client Files & Assets */}
            {clientFiles.length > 0 && <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <FileText className="h-5 w-5 text-primary" />
                    Client Files & Assets
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {clientFiles.map(file => <div key={file.id} className="flex items-center justify-between p-4 rounded-lg border bg-card hover:bg-muted/50 transition-colors">
                        <div className="flex items-center gap-3 min-w-0 flex-1">
                          <div className="h-10 w-10 rounded bg-primary/10 flex items-center justify-center flex-shrink-0">
                            <FileText className="h-5 w-5 text-primary" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="font-medium truncate">{file.file_name}</div>
                            <div className="text-sm text-muted-foreground">
                              {formatFileSize(file.file_size)}
                            </div>
                          </div>
                        </div>
                        <Button variant="outline" size="sm" className="ml-2 flex-shrink-0" asChild>
                          <a href={file.file_url} download target="_blank" rel="noopener noreferrer">
                            <Download className="h-4 w-4 mr-1" />
                            Download
                          </a>
                        </Button>
                      </div>)}
                  </div>
                </CardContent>
              </Card>}

            {/* Designer Workspace */}
            {showDesignerWorkspace && <Card className="border-primary/50 bg-primary/5">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Upload className="h-5 w-5 text-primary" />
                    Design Submission
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="design-file">Upload Proof / Mockup</Label>
                    <Input id="design-file" type="file" accept="image/*,.pdf,.ai,.psd" onChange={handleFileChange} className="cursor-pointer" />
                    {selectedFile && <p className="text-sm text-muted-foreground">
                        Selected: {selectedFile.name} ({formatFileSize(selectedFile.size)})
                      </p>}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="designer-notes">Designer Notes (Optional)</Label>
                    <Textarea id="designer-notes" placeholder="Add any notes about the design..." value={designerNotes} onChange={e => setDesignerNotes(e.target.value)} rows={3} />
                  </div>

                  <Button onClick={handleSubmitDesign} disabled={!selectedFile || submitDesignMutation.isPending} className="w-full">
                    <Send className="h-4 w-4 mr-2" />
                    {submitDesignMutation.isPending ? "Sending..." : "Send for Approval"}
                  </Button>
                </CardContent>
              </Card>}

            {/* Sales Review Section */}
            {showSalesReview && designFiles.length > 0 && <Card className="border-green-500/50 bg-green-50 dark:bg-green-950/20">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Upload className="h-5 w-5 text-green-600" />
                    Design Review & Approval
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label>Design Mockup to Review</Label>
                    <div className="grid grid-cols-1 gap-3">
                      {designFiles.map(file => <div key={file.id} className="flex items-center justify-between p-4 rounded-lg border bg-card">
                          <div className="flex items-center gap-3 min-w-0 flex-1">
                            <div className="h-10 w-10 rounded bg-primary/10 flex items-center justify-center flex-shrink-0">
                              <FileText className="h-5 w-5 text-primary" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="font-medium truncate">{file.file_name}</div>
                              <div className="text-sm text-muted-foreground">
                                {formatFileSize(file.file_size)}
                              </div>
                            </div>
                          </div>
                          <Button variant="outline" size="sm" className="ml-2 flex-shrink-0" asChild>
                            <a href={file.file_url} download target="_blank" rel="noopener noreferrer">
                              <Download className="h-4 w-4 mr-1" />
                              Download
                            </a>
                          </Button>
                        </div>)}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="revision-feedback">Feedback / Revision Reason</Label>
                    <Textarea id="revision-feedback" placeholder="Provide feedback if requesting a revision..." value={revisionFeedback} onChange={e => setRevisionFeedback(e.target.value)} rows={4} />
                  </div>

                  <div className="flex gap-3">
                    <Button onClick={handleApproveDesign} disabled={approveDesignMutation.isPending} className="flex-1 bg-green-600 hover:bg-green-700">
                      {approveDesignMutation.isPending ? "Approving..." : "Approve Design"}
                    </Button>
                    <Button onClick={handleRequestRevision} disabled={!revisionFeedback.trim() || requestRevisionMutation.isPending} variant="outline" className="flex-1 border-orange-500 text-orange-600 hover:bg-orange-50 dark:hover:bg-orange-950/20">
                      {requestRevisionMutation.isPending ? "Requesting..." : "Request Revision"}
                    </Button>
                  </div>
                </CardContent>
              </Card>}

            {/* Notes */}
            {order.notes && <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <FileText className="h-5 w-5 text-primary" />
                    Additional Notes
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground whitespace-pre-wrap">{order.notes}</p>
                </CardContent>
              </Card>}

            {/* Comments & History Timeline */}
            {comments && comments.length > 0}

            {/* Archived Revisions History */}
            {(attachments?.some(a => a.file_type === 'archived_mockup') || comments?.length > 0) && <Accordion type="single" collapsible className="w-full">
                <AccordionItem value="archived-history">
                  <AccordionTrigger className="px-6 py-4 hover:no-underline">
                    <div className="flex items-center gap-2">
                      <Archive className="h-5 w-5 text-muted-foreground" />
                      <span className="text-lg font-semibold">Archived Designs & Revision History</span>
                      <Badge variant="secondary" className="ml-2">
                        {attachments?.filter(a => a.file_type === 'archived_mockup').length || 0} archived
                      </Badge>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="px-6 pb-6">
                    <div className="space-y-3">
                      {(() => {
                  // Merge archived files and comments into timeline
                  const archivedFiles = (attachments || []).filter(a => a.file_type === 'archived_mockup').map(file => ({
                    type: 'file' as const,
                    id: file.id,
                    created_at: file.created_at,
                    data: file
                  }));
                  const commentItems = (comments || []).map(comment => ({
                    type: 'comment' as const,
                    id: comment.id,
                    created_at: comment.created_at,
                    data: comment
                  }));

                  // Merge and sort by created_at (most recent first)
                  const timeline = [...archivedFiles, ...commentItems].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
                  if (timeline.length === 0) {
                    return <div className="text-center py-8 text-muted-foreground">
                              No archived designs or history yet
                            </div>;
                  }
                  return timeline.map(item => {
                    if (item.type === 'file') {
                      const file = item.data as OrderAttachment;
                      return <div key={item.id} className="flex gap-3 p-4 rounded-lg bg-muted/20 border border-dashed">
                                <div className="h-10 w-10 rounded bg-muted flex items-center justify-center flex-shrink-0">
                                  <FileText className="h-5 w-5 text-muted-foreground" />
                                </div>
                                 <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                                    {file.uploader_name && <>
                                        <span className="font-semibold text-sm">{file.uploader_name}</span>
                                        {file.uploader_role && <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${file.uploader_role === 'admin' ? 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300' : file.uploader_role === 'sales' ? 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300' : file.uploader_role === 'designer' ? 'bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300' : 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300'}`}>
                                            {file.uploader_role.charAt(0).toUpperCase() + file.uploader_role.slice(1)}
                                          </span>}
                                      </>}
                                    <Badge variant="outline" className="text-xs">Archived Design</Badge>
                                    <span className="text-xs text-muted-foreground">
                                      {format(new Date(file.created_at), "PPp")}
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-2 justify-between">
                                    <span className="text-sm font-medium truncate">{file.file_name}</span>
                                    <Button variant="ghost" size="sm" asChild className="flex-shrink-0">
                                      <a href={file.file_url} target="_blank" rel="noopener noreferrer">
                                        <Download className="h-4 w-4" />
                                      </a>
                                    </Button>
                                  </div>
                                  {file.file_size && <span className="text-xs text-muted-foreground">
                                      {(file.file_size / 1024).toFixed(1)} KB
                                    </span>}
                                </div>
                              </div>;
                    } else {
                      const comment = item.data as any;
                      return <div key={item.id} className="flex gap-3 p-4 rounded-lg bg-background border">
                                <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                                  <User className="h-5 w-5 text-primary" />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                                    <span className="font-semibold text-sm">{comment.user_name}</span>
                                    {comment.user_role && <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${comment.user_role === 'admin' ? 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300' : comment.user_role === 'sales' ? 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300' : comment.user_role === 'designer' ? 'bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300' : 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300'}`}>
                                        {comment.user_role.charAt(0).toUpperCase() + comment.user_role.slice(1)}
                                      </span>}
                                    <span className="text-xs text-muted-foreground">
                                      {format(new Date(comment.created_at), "PPp")}
                                    </span>
                                  </div>
                                  <p className="text-sm text-muted-foreground whitespace-pre-wrap">{comment.content}</p>
                                </div>
                              </div>;
                    }
                  });
                })()}
                    </div>
                  </AccordionContent>
                </AccordionItem>
              </Accordion>}
          </div> : null}
      </DialogContent>
    </Dialog>;
}