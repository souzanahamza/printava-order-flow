import { format } from "date-fns";
import { Archive, Download, FileText, User } from "lucide-react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { OrderAttachment } from "../types";

interface Comment {
    id: string;
    created_at: string;
    content: string;
    user_name?: string;
    user_role?: string;
}

interface ArchivedHistoryProps {
    attachments: OrderAttachment[];
    comments?: Comment[];
}

export function ArchivedHistory({ attachments, comments }: ArchivedHistoryProps) {
    const archivedFiles = attachments.filter(a => a.file_type === 'archived_mockup');

    // Don't render if there's no archived content
    if (archivedFiles.length === 0 && (!comments || comments.length === 0)) {
        return null;
    }

    return (
        <Accordion type="single" collapsible className="w-full">
            <AccordionItem value="archived-history">
                <AccordionTrigger className="px-6 py-4 hover:no-underline">
                    <div className="flex items-center gap-2">
                        <Archive className="h-5 w-5 text-muted-foreground" />
                        <span className="text-lg font-semibold">Archived Designs & Revision History</span>
                        <Badge variant="secondary" className="ml-2">
                            {archivedFiles.length} archived
                        </Badge>
                    </div>
                </AccordionTrigger>
                <AccordionContent className="px-6 pb-6">
                    <div className="space-y-3">
                        {(() => {
                            // Merge archived files and comments into timeline
                            const archivedFileItems = archivedFiles.map(file => ({
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
                            const timeline = [...archivedFileItems, ...commentItems].sort((a, b) =>
                                new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
                            );

                            if (timeline.length === 0) {
                                return (
                                    <div className="text-center py-8 text-muted-foreground">
                                        No archived designs or history yet
                                    </div>
                                );
                            }

                            return timeline.map(item => {
                                if (item.type === 'file') {
                                    const file = item.data as OrderAttachment;
                                    return (
                                        <div key={item.id} className="flex gap-3 p-4 rounded-lg bg-muted/20 border border-dashed">
                                            <div className="h-10 w-10 rounded bg-muted flex items-center justify-center flex-shrink-0">
                                                <FileText className="h-5 w-5 text-muted-foreground" />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2 mb-1 flex-wrap">
                                                    {file.uploader_name && (
                                                        <>
                                                            <span className="font-semibold text-sm">{file.uploader_name}</span>
                                                            {file.uploader_role && (
                                                                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${file.uploader_role === 'admin'
                                                                        ? 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300'
                                                                        : file.uploader_role === 'sales'
                                                                            ? 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300'
                                                                            : file.uploader_role === 'designer'
                                                                                ? 'bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300'
                                                                                : 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300'
                                                                    }`}>
                                                                    {file.uploader_role.charAt(0).toUpperCase() + file.uploader_role.slice(1)}
                                                                </span>
                                                            )}
                                                        </>
                                                    )}
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
                                                {file.file_size && (
                                                    <span className="text-xs text-muted-foreground">
                                                        {(file.file_size / 1024).toFixed(1)} KB
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    );
                                } else {
                                    const comment = item.data as Comment;
                                    return (
                                        <div key={item.id} className="flex gap-3 p-4 rounded-lg bg-background border">
                                            <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                                                <User className="h-5 w-5 text-primary" />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2 mb-1 flex-wrap">
                                                    <span className="font-semibold text-sm">{comment.user_name}</span>
                                                    {comment.user_role && (
                                                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${comment.user_role === 'admin'
                                                                ? 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300'
                                                                : comment.user_role === 'sales'
                                                                    ? 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300'
                                                                    : comment.user_role === 'designer'
                                                                        ? 'bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300'
                                                                        : 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300'
                                                            }`}>
                                                            {comment.user_role.charAt(0).toUpperCase() + comment.user_role.slice(1)}
                                                        </span>
                                                    )}
                                                    <span className="text-xs text-muted-foreground">
                                                        {format(new Date(comment.created_at), "PPp")}
                                                    </span>
                                                </div>
                                                <p className="text-sm text-muted-foreground whitespace-pre-wrap">{comment.content}</p>
                                            </div>
                                        </div>
                                    );
                                }
                            });
                        })()}
                    </div>
                </AccordionContent>
            </AccordionItem>
        </Accordion>
    );
}
