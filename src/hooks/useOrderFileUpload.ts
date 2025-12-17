import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export type FileType = 'design_mockup' | 'print_file' | 'client_reference';

/**
 * Smart File Renaming Utility
 * Pattern: ORD-{orderIdShort}_{SanitizedClientName}_{FileType}_{Timestamp}.{ext}
 * Example: ORD-a1b2c3d4_Brain_Socket_PROOF_1702656000000.pdf
 */
export function generateSmartFileName(
    orderId: string,
    clientName: string,
    fileType: FileType,
    originalFileName: string
): string {
    // 1. Get short order ID (first 8 chars)
    const orderIdShort = orderId.slice(0, 8);

    // 2. Sanitize client name: remove special chars, replace spaces with underscores
    const rawClientName = clientName?.trim() || "Order";
    const sanitizedClientName = rawClientName
        .replace(/[^a-zA-Z0-9\s]/g, '')
        .replace(/\s+/g, '_')
        .replace(/_+/g, '_')
        .substring(0, 30)
        || "Order";

    // 3. Convert file type to shortcode
    const fileTypeShortcode: Record<FileType, string> = {
        'design_mockup': 'PROOF',
        'print_file': 'PRINT',
        'client_reference': 'REF'
    };
    const shortcode = fileTypeShortcode[fileType];

    // 4. Generate timestamp for uniqueness
    const timestamp = Date.now();

    // 5. Extract file extension (lowercase)
    const extension = (originalFileName.split('.').pop() || 'file').toLowerCase();

    // 6. Construct final name
    return `ORD-${orderIdShort}_${sanitizedClientName}_${shortcode}_${timestamp}.${extension}`;
}

interface UseOrderFileUploadProps {
    orderId: string;
    clientName: string;
    companyId: string;
    bucketName?: string;
}

interface UploadFileParams {
    file: File;
    fileType: FileType;
    uploaderId: string;
    orderIdOverride?: string;
    clientNameOverride?: string;
}


/**
 * Custom hook for uploading files to orders with smart file naming
 */
export function useOrderFileUpload({
    orderId,
    clientName,
    companyId,
    bucketName = 'order-files'
}: UseOrderFileUploadProps) {
    const queryClient = useQueryClient();

    const uploadFileMutation = useMutation({
        mutationFn: async ({ file, fileType, uploaderId, orderIdOverride, clientNameOverride }: UploadFileParams) => {
            if (!file || !companyId) {
                throw new Error("Missing required data for file upload");
            }

            const resolvedOrderId = orderIdOverride || orderId;
            const resolvedClientName = clientNameOverride || clientName;

            if (!resolvedOrderId) {
                throw new Error("Missing order id for file upload");
            }

            // Generate smart file name
            const smartFileName = generateSmartFileName(resolvedOrderId, resolvedClientName, fileType, file.name);

            // Construct storage path
            const filePath = `${companyId}/${resolvedOrderId}/${smartFileName}`;

            // Upload to Supabase Storage
            const { error: uploadError } = await supabase.storage
                .from(bucketName)
                .upload(filePath, file);

            if (uploadError) throw uploadError;

            // Get public URL
            const { data: { publicUrl } } = supabase.storage
                .from(bucketName)
                .getPublicUrl(filePath);

            // Insert record into order_attachments table with smart file name
            const { error: attachmentError } = await supabase
                .from("order_attachments")
                .insert({
                    order_id: resolvedOrderId,
                    company_id: companyId,
                    file_url: publicUrl,
                    file_name: smartFileName, // Use smart name instead of original
                    file_type: fileType,
                    file_size: file.size,
                    uploader_id: uploaderId
                });

            if (attachmentError) throw attachmentError;

            return { publicUrl, fileName: smartFileName };
        },
        onSuccess: (data, variables) => {
            toast.success(`File uploaded successfully: ${data.fileName}`);
            // Invalidate relevant queries using the resolved order ID
            const resolvedId = variables.orderIdOverride || orderId;
            queryClient.invalidateQueries({ queryKey: ["order-attachments", resolvedId] });
            queryClient.invalidateQueries({ queryKey: ["order-details", resolvedId] });
            queryClient.invalidateQueries({ queryKey: ["orders"] });
        },
        onError: (error: Error) => {
            toast.error(`Upload failed: ${error.message}`);
        }
    });

    return {
        uploadFile: uploadFileMutation.mutate,
        uploadFileAsync: uploadFileMutation.mutateAsync,
        isUploading: uploadFileMutation.isPending,
        error: uploadFileMutation.error,
        reset: uploadFileMutation.reset
    };
}
