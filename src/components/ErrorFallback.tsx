
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

export function ErrorFallback() {
    return (
        <div className="flex min-h-screen flex-col items-center justify-center bg-background p-4 text-center">
            <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/20">
                <AlertTriangle className="h-10 w-10 text-red-600 dark:text-red-400" />
            </div>
            <h1 className="mb-2 text-3xl font-bold tracking-tight text-foreground">
                Something went wrong
            </h1>
            <p className="mb-8 max-w-[400px] text-muted-foreground">
                An unexpected error occurred. Please try reloading the page.
            </p>
            <Button
                onClick={() => window.location.reload()}
                size="lg"
            >
                Try Again
            </Button>
        </div>
    );
}
