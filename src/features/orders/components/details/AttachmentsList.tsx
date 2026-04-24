import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { FileText, Download, LucideIcon, FileImage, FileArchive, FileCode2 } from "lucide-react";
import { OrderAttachment } from "@/features/orders/types";

interface AttachmentsListProps {
    attachments: OrderAttachment[];
    title: string;
    orderItemNamesById?: Record<string, string>;
    icon?: LucideIcon;
    className?: string;
    iconClassName?: string;
    iconBgClassName?: string;
}

export function AttachmentsList({
    attachments,
    title,
    orderItemNamesById = {},
    icon: Icon = FileText,
    className,
    iconClassName = "text-primary",
    iconBgClassName = "bg-primary/10"
}: AttachmentsListProps) {
    if (attachments.length === 0) return null;

    const formatFileSize = (bytes: number | null) => {
        if (!bytes) return "Unknown size";
        const mb = bytes / (1024 * 1024);
        return mb < 1 ? `${(bytes / 1024).toFixed(1)} KB` : `${mb.toFixed(2)} MB`;
    };

    const formatRole = (role?: string) => {
        if (!role) return null;
        return role
            .split("_")
            .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
            .join(" ");
    };

    const formatUploadedAt = (value?: string) => {
        if (!value) return null;
        const date = new Date(value);
        if (Number.isNaN(date.getTime())) return null;
        return format(date, "MMM d, h:mm a");
    };

    const getFileIcon = (fileName: string) => {
        const ext = fileName.split(".").pop()?.toLowerCase() || "";
        if (["jpg", "jpeg", "png", "webp", "gif", "svg"].includes(ext)) return FileImage;
        if (["zip", "rar", "7z"].includes(ext)) return FileArchive;
        if (["pdf"].includes(ext)) return FileText;
        if (["ai", "psd", "eps", "fig", "xd"].includes(ext)) return FileCode2;
        return FileText;
    };

    return (
        <Card className={`border-white/20 bg-white/60 backdrop-blur-sm shadow-sm dark:bg-white/[0.03] ${className || ""}`}>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <Icon className={`h-5 w-5 ${iconClassName}`} />
                    {title}
                </CardTitle>
            </CardHeader>
            <CardContent>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    {attachments.map((file) => {
                        const FileIcon = getFileIcon(file.file_name);
                        const itemName = file.order_item_id ? orderItemNamesById[file.order_item_id] : null;
                        const uploaderRole = formatRole(file.uploader_role);
                        const uploadedAt = formatUploadedAt(file.created_at);

                        return (
                            <div
                                key={file.id}
                                className="flex items-start justify-between gap-3 rounded-xl border border-border/40 bg-background/70 p-4 transition-colors hover:bg-muted/40"
                            >
                                <div className="flex min-w-0 flex-1 items-start gap-3">
                                    <div className={`h-10 w-10 rounded-lg ${iconBgClassName} flex items-center justify-center flex-shrink-0`}>
                                        <FileIcon className={`h-5 w-5 ${iconClassName}`} />
                                    </div>
                                    <div className="min-w-0 flex-1 space-y-1.5">
                                        <div className="font-medium truncate" title={file.file_name}>
                                            {file.file_name}
                                        </div>
                                        <div className="text-sm text-muted-foreground">
                                            {formatFileSize(file.file_size)}
                                        </div>
                                        <div className="flex flex-wrap gap-1.5 pt-0.5">
                                            {file.order_item_id ? (
                                                <>
                                                    <Badge variant="secondary" className="bg-primary/10 text-primary border-primary/20">
                                                        Linked to Item
                                                    </Badge>
                                                    <Badge variant="outline" className="max-w-full truncate" title={itemName || file.order_item_id}>
                                                        Linked to: {itemName || "Unknown Item"}
                                                    </Badge>
                                                </>
                                            ) : (
                                                <Badge variant="outline" className="bg-muted/40">
                                                    Global Order Asset
                                                </Badge>
                                            )}
                                        </div>
                                        {(file.uploader_name || uploadedAt) && (
                                            <div className="text-xs text-muted-foreground">
                                                {file.uploader_name ? `Uploaded by ${file.uploader_name}${uploaderRole ? ` (${uploaderRole})` : ""}` : "Uploader unknown"}
                                                {uploadedAt ? ` • ${uploadedAt}` : ""}
                                            </div>
                                        )}
                                    </div>
                                </div>
                                <div className="flex-shrink-0">
                                    <Button variant="outline" size="sm" className="ml-2" asChild>
                                        <a
                                            href={file.file_url}
                                            download
                                            target="_blank"
                                            rel="noopener noreferrer"
                                        >
                                            <Download className="h-4 w-4 mr-1" />
                                            Download
                                        </a>
                                    </Button>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </CardContent>
        </Card>
    );
}
