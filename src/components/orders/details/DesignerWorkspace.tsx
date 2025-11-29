import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Upload, Send } from "lucide-react";
import { toast } from "sonner";
import { useUserRole } from "@/hooks/useUserRole";
import { useOrderStatuses } from "@/hooks/useOrderStatuses";
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
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [designerNotes, setDesignerNotes] = useState("");
    const [printFile, setPrintFile] = useState<File | null>(null);

    const isWaitingForPrintFile = order.status === "Waiting for Print File";

    // Designer submission mutation
    const submitDesignMutation = useMutation({
        mutationFn: async () => {
            if (!selectedFile || !companyId || !order) {
                throw new Error("Missing required data");
            }

            // Get current user
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error("User not authenticated");

            // Step A: Upload file to Supabase Storage
            const fileName = `${Date.now()}-${selectedFile.name}`;
            const filePath = `${companyId}/${orderId}/${fileName}`;
            const { error: uploadError } = await supabase.storage.from("order-files").upload(filePath, selectedFile);
            if (uploadError) throw uploadError;

            // Get public URL
            const { data: { publicUrl } } = supabase.storage.from("order-files").getPublicUrl(filePath);

            // Step B: Insert record into order_attachments
            const { error: attachmentError } = await supabase.from("order_attachments").insert({
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
                const { error: commentError } = await supabase.from("order_comments").insert({
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
                const { error: statusError } = await supabase.from("orders").update({
                    status: designApprovalStatus.name
                }).eq("id", orderId);
                if (statusError) throw statusError;
            }
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["order-details", orderId] });
            queryClient.invalidateQueries({ queryKey: ["orders"] });
            toast.success("Design submitted for approval successfully!");
            setSelectedFile(null);
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
            if (!printFile) throw new Error("No print file selected");
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error("User not authenticated");

            // Upload file to Supabase Storage
            const fileName = `${Date.now()}-${printFile.name}`;
            const filePath = `${companyId}/${orderId}/${fileName}`;
            const { error: uploadError } = await supabase.storage.from("order-files").upload(filePath, printFile);
            if (uploadError) throw uploadError;

            // Get public URL
            const { data: { publicUrl } } = supabase.storage.from("order-files").getPublicUrl(filePath);

            // Insert record into order_attachments
            const { error: attachmentError } = await supabase.from("order_attachments").insert({
                order_id: orderId,
                company_id: companyId,
                file_url: publicUrl,
                file_name: printFile.name,
                file_type: "print_file",
                file_size: printFile.size,
                uploader_id: user.id
            });
            if (attachmentError) throw attachmentError;

            // Update Order Status to 'Pending Payment'
            const pendingPaymentStatus = statuses?.find(s => s.name === "Pending Payment");
            if (pendingPaymentStatus) {
                const { error: statusError } = await supabase.from("orders").update({
                    status: pendingPaymentStatus.name
                }).eq("id", orderId);
                if (statusError) throw statusError;
            }
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["order-details", orderId] });
            queryClient.invalidateQueries({ queryKey: ["orders"] });
            queryClient.invalidateQueries({ queryKey: ["order-attachments", orderId] });
            toast.success("Print file uploaded and sent to accounting!");
            setPrintFile(null);
            onSuccess();
        },
        onError: (error: Error) => {
            toast.error(`Failed to upload print file: ${error.message}`);
        }
    });

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            setSelectedFile(e.target.files[0]);
        }
    };

    const handlePrintFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            setPrintFile(e.target.files[0]);
        }
    };

    const handleSubmitDesign = () => {
        if (!selectedFile) {
            toast.error("Please select a file to upload");
            return;
        }
        submitDesignMutation.mutate();
    };

    const handleUploadPrintFile = () => {
        if (!printFile) {
            toast.error("Please select a print file to upload");
            return;
        }
        uploadPrintFileMutation.mutate();
    };

    if (isWaitingForPrintFile) {
        return (
            <Card className="border-purple-500/50 bg-purple-50 dark:bg-purple-950/20">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Upload className="h-5 w-5 text-purple-600" />
                        Upload Final Print File
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="print-file">Select Print File</Label>
                        <Input
                            id="print-file"
                            type="file"
                            accept=".pdf,.ai,.eps,.zip"
                            onChange={handlePrintFileChange}
                            className="cursor-pointer"
                        />
                        <p className="text-sm text-muted-foreground">
                            Upload the final high-resolution file for production.
                        </p>
                    </div>
                    <Button
                        onClick={handleUploadPrintFile}
                        disabled={!printFile || uploadPrintFileMutation.isPending}
                        className="w-full bg-purple-600 hover:bg-purple-700"
                    >
                        <Send className="h-4 w-4 mr-2" />
                        {uploadPrintFileMutation.isPending ? "Uploading..." : "Upload & Send to Accounting"}
                    </Button>
                </CardContent>
            </Card>
        );
    }

    return (
        <Card className="border-primary/50 bg-primary/5">
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <Upload className="h-5 w-5 text-primary" />
                    Design Submission
                </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="space-y-2">
                    <Label htmlFor="design-file">Upload Proof / Mockup</Label>
                    <Input
                        id="design-file"
                        type="file"
                        accept="image/*,.pdf,.ai,.psd"
                        onChange={handleFileChange}
                        className="cursor-pointer"
                    />
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
                    disabled={!selectedFile || submitDesignMutation.isPending}
                    className="w-full"
                >
                    <Send className="h-4 w-4 mr-2" />
                    {submitDesignMutation.isPending ? "Submitting..." : "Submit for Approval"}
                </Button>
            </CardContent>
        </Card>
    );
}
