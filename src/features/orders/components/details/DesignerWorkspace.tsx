import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Upload, Send, Palette, Clock, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useUserRole } from "@/hooks/useUserRole";
import { useOrderFileUpload } from "@/hooks/useOrderFileUpload";
import { useAuth } from "@/hooks/useAuth";
import { OrderDetail } from "@/features/orders/types";

interface DesignerWorkspaceProps {
  orderId: string;
  order: OrderDetail;
  onSuccess: () => void;
}

type DesignTaskRow = { id: string; status: string; assigned_to: string | null; order_item_id: string };

export function DesignerWorkspace({ orderId, order, onSuccess }: DesignerWorkspaceProps) {
  const queryClient = useQueryClient();
  const { companyId } = useUserRole();
  const { user } = useAuth();
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [designerNotes, setDesignerNotes] = useState("");
  const [printFiles, setPrintFiles] = useState<File[]>([]);

  const { data: designTasks = [] } = useQuery({
    queryKey: ["workspace-design-tasks", orderId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("order_tasks")
        .select("id, status, assigned_to, order_item_id")
        .eq("order_id", orderId)
        .eq("task_type", "design");
      if (error) throw error;
      return (data ?? []) as DesignTaskRow[];
    },
  });

  const uid = user?.id;

  const proofUploadOrderItemId = useMemo(() => {
    if (!uid) return undefined as string | undefined;
    const mine = designTasks.filter(
      (t) => t.assigned_to === uid && ["In Progress", "Design Revision"].includes(t.status)
    );
    if (mine.length !== 1 || !mine[0].order_item_id) return undefined;
    return mine[0].order_item_id;
  }, [designTasks, uid]);

  const printUploadOrderItemId = useMemo(() => {
    if (!uid) return undefined as string | undefined;
    const mine = designTasks.filter((t) => t.assigned_to === uid && t.status === "Waiting for Print File");
    if (mine.length !== 1 || !mine[0].order_item_id) return undefined;
    return mine[0].order_item_id;
  }, [designTasks, uid]);

  const hasPendingUnassigned = designTasks.some((t) => t.status === "Pending" && t.assigned_to == null);
  const hasMyProofWork = Boolean(
    uid && designTasks.some((t) => t.assigned_to === uid && ["In Progress", "Design Revision"].includes(t.status))
  );
  const hasMyPrintPhase = Boolean(uid && designTasks.some((t) => t.assigned_to === uid && t.status === "Waiting for Print File"));

  const isQueueState = hasPendingUnassigned;
  const isWorkingState = hasMyProofWork;
  const isWaitingForPrintFile = hasMyPrintPhase;

  const designMockupUpload = useOrderFileUpload({
    orderId,
    clientName: order.client_name,
    companyId: companyId || "",
    bucketName: "order-files",
  });

  const printFileUpload = useOrderFileUpload({
    orderId,
    clientName: order.client_name,
    companyId: companyId || "",
    bucketName: "order-files",
  });

  const invalidateOrderAndTasks = () => {
    queryClient.invalidateQueries({ queryKey: ["workspace-design-tasks", orderId] });
    queryClient.invalidateQueries({ queryKey: ["order-open-design-tasks", orderId] });
    queryClient.invalidateQueries({ queryKey: ["order-details", orderId] });
    queryClient.invalidateQueries({ queryKey: ["orders"] });
    queryClient.invalidateQueries({ queryKey: ["designer-tasks"] });
    queryClient.invalidateQueries({ queryKey: ["design-approvals"] });
    queryClient.invalidateQueries({ queryKey: ["design-approvals-mockups"] });
    queryClient.invalidateQueries({ queryKey: ["production-tasks"] });
  };

  const startDesignMutation = useMutation({
    mutationFn: async () => {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) throw new Error("User not authenticated");

      const now = new Date().toISOString();
      const { data, error } = await supabase
        .from("order_tasks")
        .update({
          status: "In Progress",
          assigned_to: auth.user.id,
          started_at: now,
        })
        .eq("order_id", orderId)
        .eq("task_type", "design")
        .eq("status", "Pending")
        .is("assigned_to", null)
        .select("id");

      if (error) throw error;
      if (!data?.length) throw new Error("No unclaimed design tasks to start.");
    },
    onSuccess: () => {
      invalidateOrderAndTasks();
      toast.success("Design work started!");
      onSuccess();
    },
    onError: (error: Error) => {
      toast.error(`Failed to start design: ${error.message}`);
    },
  });

  const submitDesignMutation = useMutation({
    mutationFn: async () => {
      if (selectedFiles.length === 0 || !companyId || !order) {
        throw new Error("Missing required data");
      }

      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) throw new Error("User not authenticated");

      for (const file of selectedFiles) {
        await designMockupUpload.uploadFileAsync({
          file,
          fileType: "design_mockup",
          uploaderId: auth.user.id,
          orderItemId: proofUploadOrderItemId,
        });
      }

      if (designerNotes.trim()) {
        const { error: commentError } = await supabase.from("order_comments").insert({
          order_id: orderId,
          user_id: auth.user.id,
          company_id: companyId,
          content: designerNotes.trim(),
        });
        if (commentError) throw commentError;
      }

      const { data: updated, error: taskError } = await supabase
        .from("order_tasks")
        .update({ status: "Design Approval" })
        .eq("order_id", orderId)
        .eq("task_type", "design")
        .eq("assigned_to", auth.user.id)
        .in("status", ["In Progress", "Design Revision"])
        .select("id");

      if (taskError) throw taskError;
      if (!updated?.length) throw new Error("No active design tasks found to submit for approval.");

      return selectedFiles.map((f) => f.name);
    },
    onSuccess: () => {
      invalidateOrderAndTasks();
      toast.success("Design submitted for approval successfully!");
      setSelectedFiles([]);
      setDesignerNotes("");
      onSuccess();
    },
    onError: (error: Error) => {
      toast.error(`Failed to submit design: ${error.message}`);
    },
  });

  const uploadPrintFileMutation = useMutation({
    mutationFn: async () => {
      if (printFiles.length === 0) throw new Error("No print files selected");
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) throw new Error("User not authenticated");

      for (const file of printFiles) {
        await printFileUpload.uploadFileAsync({
          file,
          fileType: "print_file",
          uploaderId: auth.user.id,
          orderItemId: printUploadOrderItemId,
        });
      }

      const now = new Date().toISOString();
      const { data: updated, error: taskError } = await supabase
        .from("order_tasks")
        .update({
          status: "Completed",
          completed_at: now,
        })
        .eq("order_id", orderId)
        .eq("task_type", "design")
        .eq("assigned_to", auth.user.id)
        .eq("status", "Waiting for Print File")
        .select("id");

      if (taskError) throw taskError;
      if (!updated?.length) throw new Error("No design tasks in 'Waiting for Print File' for you to complete.");

      return printFiles.map((f) => f.name);
    },
    onSuccess: () => {
      invalidateOrderAndTasks();
      queryClient.invalidateQueries({ queryKey: ["order-attachments", orderId] });
      toast.success("Print files uploaded. Design tasks completed.");
      setPrintFiles([]);
      onSuccess();
    },
    onError: (error: Error) => {
      toast.error(`Failed to upload print files: ${error.message}`);
    },
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setSelectedFiles((prev) => [...prev, ...Array.from(e.target.files!)]);
    }
  };

  const handlePrintFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setPrintFiles((prev) => [...prev, ...Array.from(e.target.files!)]);
    }
  };

  const removeFile = (index: number) => {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const removePrintFile = (index: number) => {
    setPrintFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const handleSubmitDesign = () => {
    if (selectedFiles.length === 0) {
      toast.error("Please select at least one file to upload");
      return;
    }
    submitDesignMutation.mutate();
  };

  const handleUploadPrintFile = () => {
    if (printFiles.length === 0) {
      toast.error("Please select at least one print file to upload");
      return;
    }
    uploadPrintFileMutation.mutate();
  };

  const FileList = ({
    files,
    onRemove,
  }: {
    files: File[];
    onRemove: (index: number) => void;
  }) => {
    if (files.length === 0) return null;

    return (
      <div className="space-y-2">
        <p className="text-sm font-medium text-foreground">{files.length} file(s) selected</p>
        <div className="space-y-2 max-h-32 overflow-y-auto">
          {files.map((file, index) => (
            <div
              key={`${file.name}-${index}`}
              className="flex items-center justify-between p-2 bg-muted/50 rounded-md border"
            >
              <div className="flex-1 min-w-0 mr-2">
                <p className="text-sm font-medium truncate">{file.name}</p>
                <p className="text-xs text-muted-foreground">{formatFileSize(file.size)}</p>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-destructive hover:text-destructive"
                onClick={() => onRemove(index)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      </div>
    );
  };

  if (isWaitingForPrintFile) {
    return (
      <Card className="border-purple-500/50 bg-purple-50 dark:bg-purple-950/20">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5 text-purple-600" />
            Upload final print files
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-3">
            <Label>Select print files</Label>
            <div
              className="border-2 border-dashed border-purple-300 dark:border-purple-700 rounded-lg p-6 text-center hover:border-purple-500 transition-colors cursor-pointer"
              onClick={() => document.getElementById("print-file-input")?.click()}
            >
              <Upload className="h-8 w-8 mx-auto text-purple-500 mb-2" />
              <p className="text-sm text-muted-foreground">Click to select files or drag and drop</p>
              <p className="text-xs text-muted-foreground mt-1">PDF, AI, EPS, ZIP — multiple files allowed</p>
              <input
                id="print-file-input"
                type="file"
                multiple
                accept=".pdf,.ai,.eps,.zip"
                onChange={handlePrintFileChange}
                className="hidden"
              />
            </div>
            <FileList files={printFiles} onRemove={removePrintFile} />
          </div>
          <Button
            onClick={handleUploadPrintFile}
            disabled={printFiles.length === 0 || uploadPrintFileMutation.isPending}
            className="w-full bg-purple-600 hover:bg-purple-700"
          >
            <Send className="h-4 w-4 mr-2" />
            {uploadPrintFileMutation.isPending ? "Uploading..." : "Upload & complete design tasks"}
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (isWorkingState) {
    return (
      <Card className="border-primary/50 bg-primary/5">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5 text-primary" />
            Design submission
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-3">
            <Label>Upload proof / mockup</Label>
            <div
              className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-6 text-center hover:border-primary/50 transition-colors cursor-pointer"
              onClick={() => document.getElementById("design-file-input")?.click()}
            >
              <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
              <p className="text-sm text-muted-foreground">Click to select files or drag and drop</p>
              <p className="text-xs text-muted-foreground mt-1">Images, PDF, AI, PSD — multiple files allowed</p>
              <input
                id="design-file-input"
                type="file"
                multiple
                accept="image/*,.pdf,.ai,.psd"
                onChange={handleFileChange}
                className="hidden"
              />
            </div>
            <FileList files={selectedFiles} onRemove={removeFile} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="notes">Designer notes (optional)</Label>
            <Textarea
              id="notes"
              placeholder="Add any notes about this design..."
              value={designerNotes}
              onChange={(e) => setDesignerNotes(e.target.value)}
            />
          </div>
          <Button
            onClick={handleSubmitDesign}
            disabled={selectedFiles.length === 0 || submitDesignMutation.isPending}
            className="w-full"
          >
            <Send className="h-4 w-4 mr-2" />
            {submitDesignMutation.isPending ? "Submitting..." : "Submit for approval"}
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (isQueueState) {
    return (
      <Card className="border-amber-500/50 bg-amber-50 dark:bg-amber-950/20">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-amber-600" />
            Design queue
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert className="border-amber-200 bg-amber-100/50 dark:bg-amber-900/20">
            <Clock className="h-4 w-4 text-amber-600" />
            <AlertDescription className="text-amber-800 dark:text-amber-200">
              Unclaimed design tasks are available. Claim them here or from the designer task pool.
            </AlertDescription>
          </Alert>
          <Button
            onClick={() => startDesignMutation.mutate()}
            disabled={startDesignMutation.isPending}
            size="lg"
            className="w-full h-14 text-lg bg-primary hover:bg-primary/90"
          >
            <Palette className="h-5 w-5 mr-2" />
            {startDesignMutation.isPending ? "Starting..." : "🎨 Start designing"}
          </Button>
        </CardContent>
      </Card>
    );
  }

  return null;
}
