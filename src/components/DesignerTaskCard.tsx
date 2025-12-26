import { useState } from "react";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { StatusBadge } from "@/components/StatusBadge";
import { Download, Send, Calendar, FileText, Clock, Play, X } from "lucide-react";
import { format, isToday } from "date-fns";
import { toast } from "sonner";
import { useOrderStatuses } from "@/hooks/useOrderStatuses";
import { useUserRole } from "@/hooks/useUserRole";
import { useOrderFileUpload } from "@/hooks/useOrderFileUpload";
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

  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [designerNotes, setDesignerNotes] = useState("");

  // Logic Stages
  const currentStatus = order.status?.trim().toLowerCase() || "";
  const isPrintStage = currentStatus === "waiting for print file";
  const isQueueStage = currentStatus === "ready for design" || currentStatus === "new";

  // Get Dynamic Color from DB
  const statusColor = statuses?.find(s => s.name === order.status)?.color || "#64748b"; // Fallback gray

  // Use the new file upload hook
  const fileUpload = useOrderFileUpload({
    orderId: order.id,
    clientName: order.client_name,
    companyId: companyId || "",
    bucketName: "order-files"
  });

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

  const startDesignMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("orders")
        .update({ status: "In Design" })
        .eq("id", order.id);
      if (error) throw error;
    },
    onSuccess: () => {
      // Wait 500ms to ensure DB Trigger has finished creating the row
      setTimeout(async () => {
        const { error } = await supabase
          .from("order_status_history")
          .update({ action_details: "Started working on design" })
          .eq("order_id", order.id)
          .eq("new_status", "In Design")
          .order("created_at", { ascending: false })
          .limit(1);
        
        if (error) console.error("Failed to update history details:", error);
      }, 500);

      toast.success("Design started!");
      queryClient.invalidateQueries({ queryKey: ["designer-orders"] });
      queryClient.invalidateQueries({ queryKey: ["orders"] });
    },
    onError: (err) => toast.error(err.message),
  });

  const submitDesignMutation = useMutation({
    mutationFn: async () => {
      if (selectedFiles.length === 0 || !companyId) throw new Error("Missing data");
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Unauthorized");

      // Determine file type based on stage
      const fileTypeToSave = isPrintStage ? "print_file" : "design_mockup";

      // Upload all files sequentially
      const uploadPromises = selectedFiles.map(file =>
        fileUpload.uploadFileAsync({
          file,
          fileType: fileTypeToSave,
          uploaderId: user.id
        })
      );

      await Promise.all(uploadPromises);

      // Add designer notes if provided (only for design mockups)
      if (designerNotes.trim() && !isPrintStage) {
        await supabase.from("order_comments").insert({
          order_id: order.id,
          user_id: user.id,
          company_id: companyId,
          content: designerNotes.trim(),
        });
      }

      // Update order status
      const nextStatus = isPrintStage ? "Pending Payment" : "Design Approval";
      const { error: statusError } = await supabase
        .from("orders")
        .update({ status: nextStatus })
        .eq("id", order.id);
      if (statusError) throw statusError;

      // Return data for onSuccess
      return { nextStatus, fileNames: selectedFiles.map(f => f.name) };
    },
    onSuccess: (data) => {
      // Wait 500ms to ensure DB Trigger has finished creating the row
      setTimeout(async () => {
        const fileList = data.fileNames.length === 1 
          ? `Uploaded: ${data.fileNames[0]}`
          : `Uploaded ${data.fileNames.length} files: ${data.fileNames.join(", ")}`;
        
        const { error } = await supabase
          .from("order_status_history")
          .update({ action_details: fileList })
          .eq("order_id", order.id)
          .eq("new_status", data.nextStatus)
          .order("created_at", { ascending: false })
          .limit(1);
        
        if (error) console.error("Failed to update history details:", error);
      }, 500);

      toast.success(`${selectedFiles.length} file(s) uploaded successfully!`);
      setSelectedFiles([]);
      setDesignerNotes("");
      queryClient.invalidateQueries({ queryKey: ["designer-orders"] });
      queryClient.invalidateQueries({ queryKey: ["orders"] });
    },
    onError: (err) => toast.error(err.message),
  });

  const handleDownloadClientFiles = async () => {
    if (!clientFiles?.length) return;

    // Download files sequentially with a small delay to prevent browser blocking
    for (const file of clientFiles) {
      const link = document.createElement('a');
      link.href = file.file_url;
      link.download = file.file_name || 'download';
      link.target = '_blank';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      // Small delay between downloads
      await new Promise(resolve => setTimeout(resolve, 300));
    }

    toast.success(`Downloaded ${clientFiles.length} file(s)`);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      setSelectedFiles(prev => [...prev, ...Array.from(files)]);
    }
  };

  const removeFile = (index: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };

  const deliveryDate = new Date(order.delivery_date);
  const isDueToday = isToday(deliveryDate);

  return (
    <Card
      className="bg-card border-muted hover:shadow-md transition-all duration-200 overflow-hidden"
      style={{ borderLeft: `4px solid ${statusColor}` }}
    >
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <Badge variant="outline" className="font-mono text-xs bg-background/50">
                #{order.id.slice(0, 8)}
              </Badge>
              {isQueueStage && (
                <Badge variant="secondary" className="text-xs">
                  <Clock className="h-3 w-3 mr-1" />
                  Ready to Start
                </Badge>
              )}
            </div>
            <h3 className="font-semibold text-base truncate leading-tight text-foreground">
              {order.client_name}
            </h3>
          </div>
          <StatusBadge status={order.status} color={statusColor} />
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Date Info */}
        <div className="flex items-center gap-2 text-sm">
          <Calendar className="h-4 w-4 text-muted-foreground shrink-0" />
          <span className={`${isDueToday ? "text-destructive font-semibold" : "text-muted-foreground"} break-words`}>
            Due: {format(deliveryDate, "MMM dd, h:mm a")} {isDueToday && "(TODAY)"}
          </span>
        </div>

        {/* Notes */}
        {order.notes && (
          <div className="flex items-start gap-2 text-sm bg-muted/30 p-2 rounded border border-border">
            <FileText className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
            <p className="text-muted-foreground text-xs line-clamp-2">{order.notes}</p>
          </div>
        )}

        <Button
          variant="outline"
          size="sm"
          onClick={handleDownloadClientFiles}
          disabled={!clientFiles?.length}
          className="w-full h-8 text-xs"
        >
          <Download className="h-3 w-3 mr-2" />
          Client Files ({clientFiles?.length || 0})
        </Button>

        {/* --- DYNAMIC ACTION AREA --- */}
        <div className="border-t pt-4 space-y-3">

          {/* A: Start Designing */}
          {isQueueStage && (
            <Button
              onClick={() => startDesignMutation.mutate()}
              disabled={startDesignMutation.isPending}
              className="w-full"
              style={{ backgroundColor: statusColor, color: '#fff' }}
            >
              <Play className="h-4 w-4 mr-2" />
              {startDesignMutation.isPending ? "Starting..." : "Start Designing"}
            </Button>
          )}

          {/* B: Upload Section */}
          {!isQueueStage && (
            <>
              <div className="space-y-2">
                <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {isPrintStage ? "Final Print File(s)" : "Design Proof(s)"}
                </Label>

                <div className="flex items-center gap-2">
                  <Input
                    type="file"
                    onChange={handleFileSelect}
                    multiple
                    className="text-sm cursor-pointer"
                  />
                </div>

                {/* Selected Files List */}
                {selectedFiles.length > 0 && (
                  <div className="space-y-2 mt-3">
                    <Label className="text-xs text-muted-foreground">
                      Selected Files ({selectedFiles.length})
                    </Label>
                    <div className="space-y-1.5 max-h-32 overflow-y-auto">
                      {selectedFiles.map((file, index) => (
                        <div
                          key={index}
                          className="flex items-center justify-between gap-2 p-2 bg-muted/30 rounded border border-border text-xs"
                        >
                          <div className="flex-1 min-w-0">
                            <p className="truncate font-medium text-foreground">
                              {file.name}
                            </p>
                            <p className="text-muted-foreground text-[10px]">
                              {formatFileSize(file.size)}
                            </p>
                          </div>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => removeFile(index)}
                            className="h-6 w-6 p-0 hover:bg-destructive/10 hover:text-destructive"
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {!isPrintStage && (
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Notes</Label>
                  <Textarea
                    value={designerNotes}
                    onChange={(e) => setDesignerNotes(e.target.value)}
                    placeholder="Add notes..."
                    rows={1}
                    className="text-sm min-h-[40px]"
                  />
                </div>
              )}

              <Button
                onClick={() => submitDesignMutation.mutate()}
                disabled={selectedFiles.length === 0 || submitDesignMutation.isPending}
                className="w-full text-white"
                style={{ backgroundColor: statusColor }}
              >
                <Send className="h-4 w-4 mr-2" />
                {submitDesignMutation.isPending
                  ? `Uploading ${selectedFiles.length} file(s)...`
                  : isPrintStage
                    ? `Upload ${selectedFiles.length > 0 ? selectedFiles.length : ''} File(s) & Finish`
                    : `Send ${selectedFiles.length > 0 ? selectedFiles.length : ''} File(s) for Approval`}
              </Button>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}