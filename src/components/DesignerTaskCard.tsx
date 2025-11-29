import { useState } from "react";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { StatusBadge } from "@/components/StatusBadge";
import { Download, Upload, Send, Calendar, FileText } from "lucide-react";
import { format, isToday } from "date-fns";
import { toast } from "sonner";
import { useOrderStatuses } from "@/hooks/useOrderStatuses";
import { useUserRole } from "@/hooks/useUserRole";
import { Badge } from "@/components/ui/badge";

interface DesignerTaskCardProps {
  order: {
    id: string;
    client_name: string;
    delivery_date: string;
    status: string;
    notes?: string | null;
  };
}

export function DesignerTaskCard({ order }: DesignerTaskCardProps) {
  const queryClient = useQueryClient();
  const { companyId } = useUserRole();
  const { data: statuses } = useOrderStatuses();

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [designerNotes, setDesignerNotes] = useState("");

  // ---------------------------------------------------------
  // 1. Determine stage intelligently (case-insensitive)
  // ---------------------------------------------------------
  const currentStatus = order.status?.trim().toLowerCase() || "";
  const printStatusTarget = "waiting for print file";
  const isPrintStage = currentStatus === printStatusTarget;

  console.log("DEBUG STATE:", {
    id: order.id,
    rawStatus: order.status,
    isPrintStage
  });

  const statusColor = statuses?.find(s => s.name === order.status)?.color;

  const { data: clientFiles } = useQuery({
    queryKey: ["client-files", order.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("order_attachments")
        .select("*")
        .eq("order_id", order.id)
        .eq("file_type", "client_reference")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const submitDesignMutation = useMutation({
    mutationFn: async () => {
      if (!selectedFile || !companyId) throw new Error("Missing data");
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Unauthorized");

      // Upload File
      const fileName = `${Date.now()}-${selectedFile.name}`;
      const folder = isPrintStage ? "print_files" : "mockups";
      const filePath = `${companyId}/${order.id}/${folder}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from("order-files")
        .upload(filePath, selectedFile);
      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from("order-files")
        .getPublicUrl(filePath);

      // Determine file type based on stage
      const fileTypeToSave = isPrintStage ? "print_file" : "design_mockup";

      console.log("Saving as type:", fileTypeToSave);

      // Insert Attachment
      const { error: attachmentError } = await supabase
        .from("order_attachments")
        .insert({
          order_id: order.id,
          company_id: companyId,
          file_url: publicUrl,
          file_name: selectedFile.name,
          file_type: fileTypeToSave,
          file_size: selectedFile.size,
          uploader_id: user.id,
        });
      if (attachmentError) throw attachmentError;

      // Add Comment (Optional)
      if (designerNotes.trim()) {
        await supabase.from("order_comments").insert({
          order_id: order.id,
          user_id: user.id,
          company_id: companyId,
          content: designerNotes.trim(),
        });
      }

      // Update Order Status
      const nextStatus = isPrintStage ? "Pending Payment" : "Design Approval";
      const { error: statusError } = await supabase
        .from("orders")
        .update({ status: nextStatus })
        .eq("id", order.id);
      if (statusError) throw statusError;
    },
    onSuccess: () => {
      const successMsg = isPrintStage
        ? "Print file uploaded! Sent to Accounting."
        : "Design submitted for approval!";
      toast.success(successMsg);

      setSelectedFile(null);
      setDesignerNotes("");

      // Invalidate queries
      queryClient.invalidateQueries({ queryKey: ["designer-tasks"] });
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      queryClient.invalidateQueries({ queryKey: ["order-details"] });
      queryClient.invalidateQueries({ queryKey: ["order-attachments"] });
    },
    onError: (err) => toast.error(err.message),
  });

  const handleDownloadClientFiles = () => {
    clientFiles?.forEach(f => window.open(f.file_url, "_blank"));
  };

  const deliveryDate = new Date(order.delivery_date);
  const isDueToday = isToday(deliveryDate);

  const cardStyle = isPrintStage
    ? "border-purple-500/40 bg-purple-50/50 dark:bg-purple-900/10"
    : "border-muted bg-muted/30";

  return (
    <Card className={`${cardStyle} hover:shadow-md transition-shadow`}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant="outline" className="font-mono text-xs">
                #{order.id.slice(0, 8)}
              </Badge>
              <h3 className="font-semibold text-base truncate">{order.client_name}</h3>
            </div>
          </div>
          <StatusBadge status={order.status} color={statusColor} />
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Date Info */}
        <div className="flex items-center gap-2 text-sm">
          <Calendar className="h-4 w-4 text-muted-foreground" />
          <span className={isDueToday ? "text-orange-600 font-semibold" : "text-foreground"}>
            Due: {format(deliveryDate, "MMM dd, yyyy")} {isDueToday && "(TODAY)"}
          </span>
        </div>

        {/* Notes */}
        {order.notes && (
          <div className="flex items-start gap-2 text-sm">
            <FileText className="h-4 w-4 text-muted-foreground mt-0.5" />
            <p className="text-muted-foreground line-clamp-2">{order.notes}</p>
          </div>
        )}

        <Button
          variant="outline"
          size="sm"
          onClick={handleDownloadClientFiles}
          disabled={!clientFiles?.length}
          className="w-full"
        >
          <Download className="h-4 w-4 mr-2" />
          Client Files ({clientFiles?.length || 0})
        </Button>

        {/* Upload Section */}
        <div className="border-t pt-4 space-y-3">
          <div className="space-y-2">
            <Label className={`text-sm font-medium ${isPrintStage ? "text-purple-700 dark:text-purple-400" : ""}`}>
              {isPrintStage ? "Upload Final Print File" : "Upload Design Proof"}
            </Label>

            <div className="flex items-center gap-2">
              <Input
                type="file"
                onChange={(e) => e.target.files?.[0] && setSelectedFile(e.target.files[0])}
                className="text-sm cursor-pointer"
              />
              {selectedFile && (
                <Badge variant={isPrintStage ? "default" : "secondary"} className={`shrink-0 ${isPrintStage ? "bg-purple-600" : ""}`}>
                  <Upload className="h-3 w-3 mr-1" />
                  Ready
                </Badge>
              )}
            </div>
          </div>

          {!isPrintStage && (
            <div className="space-y-2">
              <Label className="text-sm font-medium">Notes (Optional)</Label>
              <Textarea
                value={designerNotes}
                onChange={(e) => setDesignerNotes(e.target.value)}
                placeholder="Add notes for the client..."
                rows={2}
                className="text-sm"
              />
            </div>
          )}

          <Button
            onClick={() => submitDesignMutation.mutate()}
            disabled={!selectedFile || submitDesignMutation.isPending}
            className={`w-full ${isPrintStage
              ? "bg-purple-600 hover:bg-purple-700 text-white"
              : ""
              }`}
          >
            <Send className="h-4 w-4 mr-2" />
            {submitDesignMutation.isPending
              ? "Uploading..."
              : isPrintStage
                ? "Upload & Send to Accounting"
                : "Send for Approval"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}