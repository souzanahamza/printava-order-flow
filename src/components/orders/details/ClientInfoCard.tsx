import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { User, Mail, Phone, Truck, Calendar } from "lucide-react";
import { format } from "date-fns";
import { OrderDetail } from "../types";

interface ClientInfoCardProps {
    order: OrderDetail;
}

export function ClientInfoCard({ order }: ClientInfoCardProps) {
    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <User className="h-5 w-5 text-primary" />
                    Client Information
                </CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                    <div className="text-sm font-medium text-muted-foreground">Name</div>
                    <div className="text-base font-semibold">{order.client_name}</div>
                </div>
                <div className="space-y-1">
                    <div className="text-sm font-medium text-muted-foreground flex items-center gap-1.5">
                        <Mail className="h-4 w-4" />
                        Email
                    </div>
                    <div className="text-base">{order.email}</div>
                </div>
                {order.phone && (
                    <div className="space-y-1">
                        <div className="text-sm font-medium text-muted-foreground flex items-center gap-1.5">
                            <Phone className="h-4 w-4" />
                            Phone
                        </div>
                        <div className="text-base">{order.phone}</div>
                    </div>
                )}
                {order.delivery_method && (
                    <div className="space-y-1">
                        <div className="text-sm font-medium text-muted-foreground flex items-center gap-1.5">
                            <Truck className="h-4 w-4" />
                            Delivery Method
                        </div>
                        <div className="text-base capitalize">{order.delivery_method}</div>
                    </div>
                )}
                <div className="space-y-1">
                    <div className="text-sm font-medium text-muted-foreground flex items-center gap-1.5">
                        <Calendar className="h-4 w-4" />
                        Delivery Date
                    </div>
                    <div className="text-base">{format(new Date(order.delivery_date), "PPP")}</div>
                </div>
                {order.pricing_tier && (
                    <div className="space-y-1">
                        <div className="text-sm font-medium text-muted-foreground">Pricing Tier</div>
                        <div className="text-base">{order.pricing_tier.label || order.pricing_tier.name}</div>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
