import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { CheckCircle2, XCircle, FileText, Download } from "lucide-react";
import { toast } from "sonner";
import { useUserRole } from "@/hooks/useUserRole";
import { OrderAttachment } from "@/features/orders/types";

interface SalesReviewProps {
  orderId: string;
  designFiles: OrderAttachment[];
  onSuccess: () => void;
}

export function SalesReview({ orderId, designFiles, onSuccess }: SalesReviewProps) {
  const queryClient = useQueryClient();
  const { companyId } = useUserRole();
  const [revisionFeedback, setRevisionFeedback] = useState("");

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: ["order-details", orderId] });
    queryClient.invalidateQueries({ queryKey: ["orders"] });
    queryClient.invalidateQueries({ queryKey: ["designer-tasks"] });
    queryClient.invalidateQueries({ queryKey: ["design-approvals"] });
    queryClient.invalidateQueries({ queryKey: ["design-approvals-mockups"] });
    queryClient.invalidateQueries({ queryKey: ["workspace-design-tasks", orderId] });
  };

  const approveDesignMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase
        .from("order_tasks")
        .update({ status: "Waiting for Print File" })
        .eq("order_id", orderId)
        .eq("task_type", "design")
        .eq("status", "Design Approval")
        .select("id");

      if (error) throw error;
      if (!data?.length) throw new Error("No design tasks in approval for this order.");
    },
    onSuccess: () => {
      invalidateAll();
      toast.success("Design approved. Waiting for designer to upload final files.");
      onSuccess();
    },
    onError: (error: Error) => {
      toast.error(`Failed to approve design: ${error.message}`);
    },
  });

  const requestRevisionMutation = useMutation({
    mutationFn: async () => {
      if (!revisionFeedback.trim()) {
        throw new Error("Feedback is required");
      }
      const currentUser = (await supabase.auth.getUser()).data.user;
      if (!currentUser || !companyId) throw new Error("Missing user data");

      const { error: archiveError } = await supabase
        .from("order_attachments")
        .update({ file_type: "archived_mockup" })
        .eq("order_id", orderId)
        .eq("file_type", "design_mockup");
      if (archiveError) throw archiveError;

      const { error: commentError } = await supabase.from("order_comments").insert({
        order_id: orderId,
        user_id: currentUser.id,
        company_id: companyId,
        content: revisionFeedback,
      });
      if (commentError) throw commentError;

      const { data: updated, error: taskError } = await supabase
        .from("order_tasks")
        .update({ status: "Design Revision" })
        .eq("order_id", orderId)
        .eq("task_type", "design")
        .eq("status", "Design Approval")
        .select("id");

      if (taskError) throw taskError;
      if (!updated?.length) throw new Error("No design tasks in approval to send back for revision.");
    },
    onSuccess: () => {
      invalidateAll();
      queryClient.invalidateQueries({ queryKey: ["order-attachments", orderId] });
      queryClient.invalidateQueries({ queryKey: ["order-comments", orderId] });
      toast.success("Revision requested successfully! Previous designs archived.");
      setRevisionFeedback("");
      onSuccess();
    },
    onError: (error: Error) => {
      toast.error(`Failed to request revision: ${error.message}`);
    },
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

  const formatFileSize = (bytes: number | null) => {
    if (!bytes) return "Unknown size";
    const mb = bytes / (1024 * 1024);
    return mb < 1 ? `${(bytes / 1024).toFixed(1)} KB` : `${mb.toFixed(2)} MB`;
  };

  return (
    <Card className="border-orange-500/50 bg-orange-50 dark:bg-orange-950/20">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CheckCircle2 className="h-5 w-5 text-orange-600" />
          Design approval required
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-3">
          <h4 className="font-medium text-sm text-muted-foreground">Latest design submission</h4>
          {designFiles.length > 0 ? (
            <div className="grid grid-cols-1 gap-3">
              {designFiles.map((file) => (
                <div key={file.id} className="flex items-center justify-between p-3 rounded-lg border bg-background">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="h-10 w-10 rounded bg-primary/10 flex items-center justify-center">
                      <FileText className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <div className="font-medium text-sm truncate">{file.file_name}</div>
                      <div className="text-xs text-muted-foreground">{formatFileSize(file.file_size)}</div>
                    </div>
                  </div>
                  <Button variant="ghost" size="sm" asChild>
                    <a href={file.file_url} target="_blank" rel="noopener noreferrer">
                      <Download className="h-4 w-4" />
                    </a>
                  </Button>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground italic">No design files found.</p>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-3">
            <Button
              onClick={handleApproveDesign}
              disabled={approveDesignMutation.isPending}
              className="w-full bg-green-600 hover:bg-green-700"
            >
              <CheckCircle2 className="h-4 w-4 mr-2" />
              {approveDesignMutation.isPending ? "Approving..." : "Approve design"}
            </Button>
            <p className="text-xs text-muted-foreground text-center">Approves all line-item design tasks awaiting approval on this order.</p>
          </div>

          <div className="space-y-3">
            <Textarea
              placeholder="Enter feedback for revision..."
              value={revisionFeedback}
              onChange={(e) => setRevisionFeedback(e.target.value)}
              className="min-h-[80px]"
            />
            <Button
              variant="destructive"
              onClick={handleRequestRevision}
              disabled={!revisionFeedback.trim() || requestRevisionMutation.isPending}
              className="w-full"
            >
              <XCircle className="h-4 w-4 mr-2" />
              {requestRevisionMutation.isPending ? "Requesting..." : "Request revision"}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
