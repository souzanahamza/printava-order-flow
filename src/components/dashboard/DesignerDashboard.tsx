import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Clock, CheckCircle, FileText, AlertCircle, Upload } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { useMemo, useState } from "react";
import { OrderDetails } from "@/components/OrderDetails";
import { DesignerTaskCard } from "@/components/DesignerTaskCard";

type DesignerOrder = {
    id: string;
    order_number?: number | null;
    client_name: string;
    delivery_date: string;
    status: string;
    notes?: string | null;
    pricing_tier?: {
        name: string;
        label: string;
    } | null;
};

export const DesignerDashboard = () => {
    const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
    const [isDetailsOpen, setIsDetailsOpen] = useState(false);

    // Designer-specific query
    const {
        data: designerOrders,
        isLoading: isLoadingDesignerOrders
    } = useQuery({
        queryKey: ["designer-orders"],
        queryFn: async () => {
            const { data, error } = await supabase
                .from("orders")
                .select(`
          id,
          order_number,
          client_name,
          delivery_date,
          status,
          notes,
          pricing_tier:pricing_tiers(name, label)
        `)
                .in("status", ["Ready for Design", "In Design", "Design Revision", "Waiting for Print File"])
                .order("delivery_date", { ascending: true });

            if (error) throw error;
            return data as DesignerOrder[];
        }
    });

    const designerStats = useMemo(() => {
        if (!designerOrders) return [];

        const readyForDesign = designerOrders.filter(o => o.status === "Ready for Design").length;
        const inDesign = designerOrders.filter(o => o.status === "In Design").length;
        const revisions = designerOrders.filter(o => o.status === "Design Revision").length;
        const waitingForFiles = designerOrders.filter(o => o.status === "Waiting for Print File").length;

        return [
            {
                title: "Queue",
                value: readyForDesign.toString(),
                icon: Clock,
                change: "Ready for Design"
            },
            {
                title: "In Progress",
                value: inDesign.toString(),
                icon: FileText,
                change: "Currently designing"
            },
            {
                title: "Revisions",
                value: revisions.toString(),
                icon: AlertCircle,
                change: "Client requested changes",
                highlight: true
            },
            {
                title: "Print Files",
                value: waitingForFiles.toString(),
                icon: Upload,
                change: "Upload final files"
            }
        ];
    }, [designerOrders]);

    // All designer orders (no 7-day filter)
    const allDesignerTasks = useMemo(() => {
        if (!designerOrders) return [];
        return designerOrders;
    }, [designerOrders]);

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold text-foreground">Designer Workspace</h1>
                <p className="text-muted-foreground">Your active design tasks and pending work</p>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
                {isLoadingDesignerOrders ? (
                    <>
                        {[1, 2, 3].map(i => (
                            <Card key={i}>
                                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                    <Skeleton className="h-4 w-24" />
                                    <Skeleton className="h-4 w-4" />
                                </CardHeader>
                                <CardContent>
                                    <Skeleton className="h-8 w-16 mb-2" />
                                    <Skeleton className="h-3 w-32" />
                                </CardContent>
                            </Card>
                        ))}
                    </>
                ) : (
                    designerStats.map(stat => (
                        <Card key={stat.title} className={stat.highlight ? "border-orange-500" : ""}>
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-sm font-medium">{stat.title}</CardTitle>
                                <stat.icon className={`h-4 w-4 ${stat.highlight ? 'text-orange-500' : 'text-muted-foreground'}`} />
                            </CardHeader>
                            <CardContent>
                                <div className={`text-2xl font-bold ${stat.highlight ? 'text-orange-500' : ''}`}>
                                    {stat.value}
                                </div>
                                <p className="text-xs text-muted-foreground">{stat.change}</p>
                            </CardContent>
                        </Card>
                    ))
                )}
            </div>

            <Card className="bg-background/60 backdrop-blur">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <FileText className="h-5 w-5 text-primary" />
                        Active Task Queue
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    {isLoadingDesignerOrders ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {[1, 2, 3].map((i) => (
                                <div key={i} className="space-y-3">
                                    <Skeleton className="h-64 w-full" />
                                </div>
                            ))}
                        </div>
                    ) : allDesignerTasks && allDesignerTasks.length > 0 ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {allDesignerTasks.map((order) => (
                                <DesignerTaskCard key={order.id} order={order} />
                            ))}
                        </div>
                    ) : (
                        <div className="text-center py-12">
                            <CheckCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                            <p className="text-muted-foreground">No design tasks pending. Great work!</p>
                        </div>
                    )}
                </CardContent>
            </Card>

            <OrderDetails
                orderId={selectedOrderId || ""}
                open={isDetailsOpen}
                onOpenChange={setIsDetailsOpen}
            />
        </div>
    );
};
