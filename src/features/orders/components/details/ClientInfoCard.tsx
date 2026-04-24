import {
    User,
    Mail,
    Phone,
    Truck,
    Calendar,
    MapPin,
    Tag,
    UserCheck,
    Clock,
    Building2,
} from "lucide-react";
import { format, formatDistanceToNowStrict, isPast } from "date-fns";
import { OrderDetail } from "@/features/orders/types";
import { cn } from "@/lib/utils";

// Extend OrderDetail with optional join data loaded by the parent query
interface ExtendedOrderDetail extends OrderDetail {
    clients?: {
        full_name?: string | null;
        company_name?: string | null;
        address?: string | null;
        phone?: string | null;
        tax_number?: string | null;
    } | null;
    sales_rep?: {
        full_name?: string | null;
    } | null;
}

interface ClientInfoCardProps {
    order: ExtendedOrderDetail;
}

const labelClass = "text-[10px] font-semibold uppercase tracking-wider text-muted-foreground";
const valueClass = "text-sm font-medium text-foreground";

function Field({
    icon: Icon,
    label,
    value,
    valueClassName,
    mono,
}: {
    icon?: React.ComponentType<{ className?: string }>;
    label: string;
    value: React.ReactNode;
    valueClassName?: string;
    mono?: boolean;
}) {
    return (
        <div className="flex items-start gap-2.5 min-w-0">
            {Icon && (
                <Icon className="h-3.5 w-3.5 mt-[3px] text-muted-foreground shrink-0" />
            )}
            <div className="min-w-0 flex-1">
                <div className={labelClass}>{label}</div>
                <div
                    className={cn(
                        valueClass,
                        "truncate",
                        mono && "font-mono",
                        valueClassName
                    )}
                    title={typeof value === "string" ? value : undefined}
                >
                    {value ?? <span className="text-muted-foreground/60">—</span>}
                </div>
            </div>
        </div>
    );
}

function ColumnHeader({
    icon: Icon,
    title,
}: {
    icon: React.ComponentType<{ className?: string }>;
    title: string;
}) {
    return (
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            <Icon className="h-3.5 w-3.5 text-primary" />
            {title}
        </div>
    );
}

export function ClientInfoCard({ order }: ClientInfoCardProps) {
    const companyName = order.clients?.company_name;
    const shippingAddress = order.clients?.address;
    const phone = order.phone || order.clients?.phone || undefined;
    const salesRep = order.sales_rep?.full_name;

    const deliveryDate = new Date(order.delivery_date);
    const isValidDelivery = !Number.isNaN(deliveryDate.getTime());
    const overdue = isValidDelivery && isPast(deliveryDate);
    const distance = isValidDelivery
        ? formatDistanceToNowStrict(deliveryDate)
        : null;
    const timeLabel = isValidDelivery
        ? overdue
            ? `${distance} overdue`
            : `${distance} remaining`
        : null;

    return (
        <section
            aria-label="Order summary"
            className={cn(
                "rounded-lg border border-border/60 bg-card/40",
                "grid grid-cols-1 md:grid-cols-3",
                "divide-y divide-border/60 md:divide-y-0 md:divide-x",
                "p-0"
            )}
        >
            {/* Column A — Customer Identity */}
            <div className="p-4 md:p-5 space-y-3 min-w-0">
                <ColumnHeader icon={User} title="Customer" />
                <div className="space-y-2.5">
                    <Field
                        label="Full Name"
                        value={order.client_name}
                        valueClassName="text-base font-semibold"
                    />
                    {companyName && (
                        <Field
                            icon={Building2}
                            label="Company"
                            value={companyName}
                        />
                    )}
                    {order.email && (
                        <Field icon={Mail} label="Email" value={order.email} />
                    )}
                    {phone && <Field icon={Phone} label="Phone" value={phone} />}
                </div>
            </div>

            {/* Column B — Logistics */}
            <div className="p-4 md:p-5 space-y-3 min-w-0">
                <ColumnHeader icon={Truck} title="Logistics" />
                <div className="space-y-2.5">
                    {order.delivery_method && (
                        <Field
                            icon={Truck}
                            label="Delivery Method"
                            value={
                                <span className="capitalize">
                                    {order.delivery_method}
                                </span>
                            }
                        />
                    )}

                    {/* Delivery Date & Time — time made prominent */}
                    <div className="flex items-start gap-2.5 min-w-0">
                        <Calendar className="h-3.5 w-3.5 mt-[3px] text-muted-foreground shrink-0" />
                        <div className="min-w-0 flex-1">
                            <div className={labelClass}>Delivery Date &amp; Time</div>
                            {isValidDelivery ? (
                                <div className="flex items-baseline gap-1.5 min-w-0">
                                    <span className={cn(valueClass, "truncate")}>
                                        {format(deliveryDate, "PP")}
                                    </span>
                                    <span className="text-sm font-bold text-primary tabular-nums">
                                        {format(deliveryDate, "HH:mm")}
                                    </span>
                                </div>
                            ) : (
                                <div className={valueClass}>—</div>
                            )}
                        </div>
                    </div>

                    {shippingAddress && (
                        <Field
                            icon={MapPin}
                            label="Shipping Address"
                            value={shippingAddress}
                            valueClassName="line-clamp-2 whitespace-normal"
                        />
                    )}
                </div>
            </div>

            {/* Column C — Order Context */}
            <div className="p-4 md:p-5 space-y-3 min-w-0">
                <ColumnHeader icon={Tag} title="Order Context" />
                <div className="space-y-2.5">
                    {order.pricing_tier && (
                        <Field
                            icon={Tag}
                            label="Pricing Tier"
                            value={
                                order.pricing_tier.label ||
                                order.pricing_tier.name
                            }
                        />
                    )}

                    {salesRep && (
                        <Field
                            icon={UserCheck}
                            label="Sales Representative"
                            value={salesRep}
                        />
                    )}

                    {timeLabel && (
                        <div className="flex items-start gap-2.5 min-w-0">
                            <Clock
                                className={cn(
                                    "h-3.5 w-3.5 mt-[3px] shrink-0",
                                    overdue ? "text-destructive" : "text-muted-foreground"
                                )}
                            />
                            <div className="min-w-0 flex-1">
                                <div className={labelClass}>Time Remaining</div>
                                <div
                                    className={cn(
                                        "text-sm font-semibold tabular-nums truncate",
                                        overdue ? "text-destructive" : "text-foreground"
                                    )}
                                >
                                    {timeLabel}
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </section>
    );
}
