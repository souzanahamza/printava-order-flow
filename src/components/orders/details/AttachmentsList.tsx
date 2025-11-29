import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FileText, Download, LucideIcon } from "lucide-react";
import { OrderAttachment } from "../types";

interface AttachmentsListProps {
    attachments: OrderAttachment[];
    title: string;
    icon?: LucideIcon;
    className?: string;
    iconClassName?: string;
    iconBgClassName?: string;
}

export function AttachmentsList({
    attachments,
    title,
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

    return (
        <Card className={className}>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <Icon className={`h-5 w-5 ${iconClassName}`} />
                    {title}
                </CardTitle>
            </CardHeader>
            <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {attachments.map((file) => (
                        <div
                            key={file.id}
                            className="flex items-center justify-between p-4 rounded-lg border bg-card hover:bg-muted/50 transition-colors"
                        >
                            <div className="flex items-center gap-3 min-w-0 flex-1">
                                <div className={`h-10 w-10 rounded ${iconBgClassName} flex items-center justify-center flex-shrink-0`}>
                                    <FileText className={`h-5 w-5 ${iconClassName}`} />
                                </div>
                                <div className="min-w-0 flex-1">
                                    <div className="font-medium truncate">{file.file_name}</div>
                                    <div className="text-sm text-muted-foreground">
                                        {formatFileSize(file.file_size)}
                                    </div>
                                    {file.uploader_name && (
                                        <div className="text-xs text-muted-foreground mt-1">
                                            Uploaded by: {file.uploader_name}
                                        </div>
                                    )}
                                </div>
                            </div>
                            <Button variant="outline" size="sm" className="ml-2 flex-shrink-0" asChild>
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
                    ))}
                </div>
            </CardContent>
        </Card>
    );
}
