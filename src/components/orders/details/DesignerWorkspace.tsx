import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Upload, Send, Palette, Clock, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useUserRole } from "@/hooks/useUserRole";
import { useOrderStatuses } from "@/hooks/useOrderStatuses";
import { useOrderFileUpload } from "@/hooks/useOrderFileUpload";
import { OrderDetail } from "../types";

interface DesignerWorkspaceProps {
    orderId: string;
    order: OrderDetail;
    onSuccess: () => void;
}

export function DesignerWorkspace({ orderId, order, onSuccess }: DesignerWorkspaceProps) {
    const queryClient = useQueryClient();
    const { companyId } = useUserRole();
    const { data: statuses } = useOrderStatuses();
    const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
    const [designerNotes, setDesignerNotes] = useState("");
    const [printFiles, setPrintFiles] = useState<File[]>([]);

    const isQueueState = order.status === "New" || order.status === "Ready for Design";
    const isWorkingState = order.status === "In Design" || order.status === "Design Revision";
    const isWaitingForPrintFile = order.status === "Waiting for Print File";

    // Use the new file upload hook for design mockups
    const designMockupUpload = useOrderFileUpload({
        orderId,
        clientName: order.client_name,
        companyId: companyId || "",
        bucketName: "order-files"
    });

    // Use the new file upload hook for print files
    const printFileUpload = useOrderFileUpload({
        orderId,
        clientName: order.client_name,
        companyId: companyId || "",
        bucketName: "order-files"
    });

    // Start designing mutation
    const startDesignMutation = useMutation({
        mutationFn: async () => {
            const inDesignStatus = statuses?.find(s => s.name === "In Design");
            if (!inDesignStatus) throw new Error("'In Design' status not found");

            const { error } = await supabase
                .from("orders")
                .update({ status: inDesignStatus.name })
                .eq("id", orderId);

            if (error) throw error;
        },
        onSuccess: () => {
            // Wait 500ms to ensure DB Trigger has finished creating the row
            setTimeout(async () => {
                const { error } = await supabase
                    .from("order_status_history")
                    .update({ action_details: "Started working on design" })
                    .eq("order_id", orderId)
                    .eq("new_status", "In Design")
                    .order("created_at", { ascending: false })
                    .limit(1);
                
                if (error) console.error("Failed to update history details:", error);
            }, 500);

            queryClient.invalidateQueries({ queryKey: ["order-details", orderId] });
            queryClient.invalidateQueries({ queryKey: ["orders"] });
            toast.success("Design work started!");
            onSuccess();
        },
        onError: (error: Error) => {
            toast.error(`Failed to start design: ${error.message}`);
        }
    });

    // Designer submission mutation
    const submitDesignMutation = useMutation({
        mutationFn: async () => {
            if (selectedFiles.length === 0 || !companyId || !order) {
                throw new Error("Missing required data");
            }

            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error("User not authenticated");

            // Upload all files
            for (const file of selectedFiles) {
                await designMockupUpload.uploadFileAsync({
                    file,
                    fileType: "design_mockup",
                    uploaderId: user.id
                });
            }

            // Add designer notes if provided
            if (designerNotes.trim()) {
                const { error: commentError } = await supabase.from("order_comments").insert({
                    order_id: orderId,
                    user_id: user.id,
                    company_id: companyId,
                    content: designerNotes.trim()
                });
                if (commentError) throw commentError;
            }

            // Update order status to Design Approval
            const designApprovalStatus = statuses?.find(s => s.name === "Design Approval");
            if (designApprovalStatus) {
                const { error: statusError } = await supabase.from("orders").update({
                    status: designApprovalStatus.name
                }).eq("id", orderId);
                if (statusError) throw statusError;
            }

            // Return file names for action details
            return selectedFiles.map(f => f.name);
        },
        onSuccess: (fileNames) => {
            // Wait 500ms to ensure DB Trigger has finished creating the row
            setTimeout(async () => {
                const fileList = fileNames.length === 1 
                    ? `Uploaded: ${fileNames[0]}`
                    : `Uploaded ${fileNames.length} files: ${fileNames.join(", ")}`;

                const { error } = await supabase
                    .from("order_status_history")
                    .update({ action_details: fileList })
                    .eq("order_id", orderId)
                    .eq("new_status", "Design Approval")
                    .order("created_at", { ascending: false })
                    .limit(1);
                
                if (error) console.error("Failed to update history details:", error);
            }, 500);

            queryClient.invalidateQueries({ queryKey: ["order-details", orderId] });
            queryClient.invalidateQueries({ queryKey: ["orders"] });
            toast.success("Design submitted for approval successfully!");
            setSelectedFiles([]);
            setDesignerNotes("");
            onSuccess();
        },
        onError: (error: Error) => {
            toast.error(`Failed to submit design: ${error.message}`);
        }
    });

    // Upload print file mutation
    const uploadPrintFileMutation = useMutation({
        mutationFn: async () => {
            if (printFiles.length === 0) throw new Error("No print files selected");
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error("User not authenticated");

            // Upload all print files
            for (const file of printFiles) {
                await printFileUpload.uploadFileAsync({
                    file,
                    fileType: "print_file",
                    uploaderId: user.id
                });
            }

            // Update order status to Pending Payment
            const pendingPaymentStatus = statuses?.find(s => s.name === "Pending Payment");
            if (pendingPaymentStatus) {
                const { error: statusError } = await supabase.from("orders").update({
                    status: pendingPaymentStatus.name
                }).eq("id", orderId);
                if (statusError) throw statusError;
            }

            // Return file names for action details
            return printFiles.map(f => f.name);
        },
        onSuccess: (fileNames) => {
            // Wait 500ms to ensure DB Trigger has finished creating the row
            setTimeout(async () => {
                const fileList = fileNames.length === 1 
                    ? `Uploaded: ${fileNames[0]}`
                    : `Uploaded ${fileNames.length} print files: ${fileNames.join(", ")}`;

                const { error } = await supabase
                    .from("order_status_history")
                    .update({ action_details: fileList })
                    .eq("order_id", orderId)
                    .eq("new_status", "Pending Payment")
                    .order("created_at", { ascending: false })
                    .limit(1);
                
                if (error) console.error("Failed to update history details:", error);
            }, 500);

            queryClient.invalidateQueries({ queryKey: ["order-details", orderId] });
            queryClient.invalidateQueries({ queryKey: ["orders"] });
            queryClient.invalidateQueries({ queryKey: ["order-attachments", orderId] });
            toast.success("Print files uploaded and sent to accounting!");
            setPrintFiles([]);
            onSuccess();
        },
        onError: (error: Error) => {
            toast.error(`Failed to upload print files: ${error.message}`);
        }
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

    // File list component
    const FileList = ({ 
        files, 
        onRemove 
    }: { 
        files: File[]; 
        onRemove: (index: number) => void;
    }) => {
        if (files.length === 0) return null;
        
        return (
            <div className="space-y-2">
                <p className="text-sm font-medium text-foreground">
                    {files.length} file(s) selected
                </p>
                <div className="space-y-2 max-h-32 overflow-y-auto">
                    {files.map((file, index) => (
                        <div
                            key={`${file.name}-${index}`}
                            className="flex items-center justify-between p-2 bg-muted/50 rounded-md border"
                        >
                            <div className="flex-1 min-w-0 mr-2">
                                <p className="text-sm font-medium truncate">{file.name}</p>
                                <p className="text-xs text-muted-foreground">
                                    {formatFileSize(file.size)}
                                </p>
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

    // Condition A: Queue State - Show "Start Designing" button
    if (isQueueState) {
        return (
            <Card className="border-amber-500/50 bg-amber-50 dark:bg-amber-950/20">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Clock className="h-5 w-5 text-amber-600" />
                        Design Queue
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <Alert className="border-amber-200 bg-amber-100/50 dark:bg-amber-900/20">
                        <Clock className="h-4 w-4 text-amber-600" />
                        <AlertDescription className="text-amber-800 dark:text-amber-200">
                            ⏳ Ready for Design
                        </AlertDescription>
                    </Alert>
                    <Button
                        onClick={() => startDesignMutation.mutate()}
                        disabled={startDesignMutation.isPending}
                        size="lg"
                        className="w-full h-14 text-lg bg-primary hover:bg-primary/90"
                    >
                        <Palette className="h-5 w-5 mr-2" />
                        {startDesignMutation.isPending ? "Starting..." : "🎨 Start Designing"}
                    </Button>
                </CardContent>
            </Card>
        );
    }

    // Condition C: Waiting for Print File
    if (isWaitingForPrintFile) {
        return (
            <Card className="border-purple-500/50 bg-purple-50 dark:bg-purple-950/20">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Upload className="h-5 w-5 text-purple-600" />
                        Upload Final Print Files
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="space-y-3">
                        <Label>Select Print Files</Label>
                        <div
                            className="border-2 border-dashed border-purple-300 dark:border-purple-700 rounded-lg p-6 text-center hover:border-purple-500 transition-colors cursor-pointer"
                            onClick={() => document.getElementById("print-file-input")?.click()}
                        >
                            <Upload className="h-8 w-8 mx-auto text-purple-500 mb-2" />
                            <p className="text-sm text-muted-foreground">
                                Click to select files or drag and drop
                            </p>
                            <p className="text-xs text-muted-foreground mt-1">
                                PDF, AI, EPS, ZIP - You can select multiple files
                            </p>
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
                        {uploadPrintFileMutation.isPending ? "Uploading..." : "Upload & Send to Accounting"}
                    </Button>
                </CardContent>
            </Card>
        );
    }

    // Condition B: Working State - Show Upload Form
    if (isWorkingState) {
        return (
            <Card className="border-primary/50 bg-primary/5">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Upload className="h-5 w-5 text-primary" />
                        Design Submission
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="space-y-3">
                        <Label>Upload Proof / Mockup</Label>
                        <div
                            className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-6 text-center hover:border-primary/50 transition-colors cursor-pointer"
                            onClick={() => document.getElementById("design-file-input")?.click()}
                        >
                            <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                            <p className="text-sm text-muted-foreground">
                                Click to select files or drag and drop
                            </p>
                            <p className="text-xs text-muted-foreground mt-1">
                                Images, PDF, AI, PSD - You can select multiple files
                            </p>
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
                        <Label htmlFor="notes">Designer Notes (Optional)</Label>
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
                        {submitDesignMutation.isPending ? "Submitting..." : "Submit for Approval"}
                    </Button>
                </CardContent>
            </Card>
        );
    }

    return null;
}
