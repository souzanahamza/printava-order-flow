import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Package } from "lucide-react";
import { OrderDetail } from "../types";
import { formatCurrency } from "@/utils/formatCurrency";
import { useUserRole } from "@/hooks/useUserRole";

interface OrderItemsTableProps {
    items: OrderDetail["order_items"];
    totalPrice: number;
    currency?: string;
    exchangeRate?: number | null;
}

export function OrderItemsTable({ items, totalPrice, currency, exchangeRate }: OrderItemsTableProps) {
    const { role, loading: roleLoading } = useUserRole();

    // Role-based financial visibility - wait for role to load first
    const canViewFinancials = !roleLoading && ['admin', 'sales', 'accountant'].includes(role || '');

    const convert = (amount: number) => {
        if (exchangeRate && exchangeRate > 0) {
            return amount / exchangeRate;
        }
        return amount;
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <Package className="h-5 w-5 text-primary" />
                    Order Items
                </CardTitle>
            </CardHeader>
            <CardContent>
                <div className="rounded-lg border overflow-hidden">
                    <table className="w-full">
                        <thead className="bg-muted/50">
                            <tr>
                                <th className="text-left p-4 font-medium">Product</th>
                                <th className="text-center p-4 font-medium">SKU</th>
                                <th className="text-center p-4 font-medium">Quantity</th>
                                {canViewFinancials && <th className="text-right p-4 font-medium">Unit Price</th>}
                                {canViewFinancials && <th className="text-right p-4 font-medium">Total</th>}
                            </tr>
                        </thead>
                        <tbody>
                            {items.map((item) => (
                                <tr key={item.id} className="border-t">
                                    <td className="p-4">
                                        <div className="flex items-center gap-3">
                                            {item.product.image_url ? (
                                                <img
                                                    src={item.product.image_url}
                                                    alt={item.product.name_en}
                                                    className="h-12 w-12 rounded object-cover"
                                                />
                                            ) : (
                                                <div className="h-12 w-12 rounded bg-muted flex items-center justify-center">
                                                    <Package className="h-6 w-6 text-muted-foreground" />
                                                </div>
                                            )}
                                            <div>
                                                <div className="font-medium">{item.product.name_en}</div>
                                                <div className="text-sm text-muted-foreground">{item.product.name_ar}</div>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="p-4 text-center text-sm text-muted-foreground">
                                        {item.product.sku}
                                    </td>
                                    <td className="p-4 text-center font-medium">{item.quantity}</td>
                                    {canViewFinancials && <td className="p-4 text-right">{formatCurrency(convert(item.unit_price), currency)}</td>}
                                    {canViewFinancials && <td className="p-4 text-right font-semibold">{formatCurrency(convert(item.item_total), currency)}</td>}
                                </tr>
                            ))}
                        </tbody>
                        {canViewFinancials && (
                            <tfoot className="bg-muted/30 border-t-2">
                                <tr>
                                    <td colSpan={4} className="p-4 text-right font-semibold">
                                        Total:
                                    </td>
                                    <td className="p-4 text-right text-lg font-bold text-primary">
                                        {formatCurrency(convert(totalPrice), currency)}
                                    </td>
                                </tr>
                            </tfoot>
                        )}
                    </table>
                </div>
            </CardContent>
        </Card>
    );
}
