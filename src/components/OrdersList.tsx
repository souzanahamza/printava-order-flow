import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { OrderDetails } from "@/components/OrderDetails";
import { OrderCard } from "@/components/OrderCard";
import { Search, Eye } from "lucide-react";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";
import { useOrderStatuses } from "@/hooks/useOrderStatuses";
import { useUserRole } from "@/hooks/useUserRole";

type OrderWithDetails = {
  id: string;
  order_number?: number | null;
  client_name: string;
  email: string;
  phone: string | null;
  delivery_date: string;
  status: string;
  total_price: number;
  notes: string | null;
  delivery_method: string | null;
  pricing_tier_id: string | null;
  total_price_foreign?: number | null;
  total_price_company?: number | null;
  currencies?: {
    code: string;
    symbol: string | null;
  } | null;
  pricing_tier?: {
    name: string;
    label: string;
  } | null;
  order_items: Array<{
    id: string;
    quantity: number;
    unit_price: number;
    item_total: number;
    product: {
      id: string;
      name_en: string;
      name_ar: string;
      sku: string;
      image_url: string | null;
      product_code: string | null;
    };
  }>;
};

interface OrdersListProps {
  clientId?: string;
  hideFilters?: boolean;
  paymentStatusFilter?: string[];
}

export const OrdersList = ({ clientId, hideFilters = false, paymentStatusFilter }: OrdersListProps) => {
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const { role, companyId, loading: roleLoading } = useUserRole();

  // Role-based financial visibility - wait for role to load first
  const canViewFinancials = !roleLoading && ['admin', 'sales', 'accountant'].includes(role || '');

  // Designer-specific statuses
  const DESIGNER_STATUSES = ['In Design', 'Design Revision', 'Waiting for Print File'];
  const isDesigner = role === 'designer';

  // Fetch order statuses using custom hook
  const { data: statuses } = useOrderStatuses();

  // Fetch company profile for currency
  const { data: companyProfile } = useQuery({
    queryKey: ["company-profile", companyId],
    queryFn: async () => {
      if (!companyId) return null;
      const { data, error } = await supabase
        .from("companies")
        .select("currency_id, base_currency:currencies(code)")
        .eq("id", companyId)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!companyId,
  });

  const currency = companyProfile?.base_currency?.code;

  // Fetch orders with all details
  const {
    data: orders,
    isLoading
  } = useQuery({
    queryKey: ["orders", isDesigner, clientId, paymentStatusFilter],
    queryFn: async () => {
      let query = supabase.from("orders").select(`
          *,
          total_price_foreign,
          currencies:currency_id ( code, symbol ),
          pricing_tier:pricing_tiers(name, label),
          order_items(
            id,
            quantity,
            unit_price,
            item_total,
            product:products(
              id,
              name_en,
              name_ar,
              sku,
              image_url,
              product_code
            )
          )
        `);

      // Filter by client if clientId is provided
      if (clientId) {
        query = query.eq('client_id', clientId);
      }

      // Filter by payment status if provided
      if (paymentStatusFilter && paymentStatusFilter.length > 0) {
        query = query.in('payment_status', paymentStatusFilter);
      }

      // Filter by designer statuses if user is designer
      if (isDesigner) {
        query = query.in('status', DESIGNER_STATUSES);
      }

      const { data, error } = await query.order("created_at", { ascending: false });
      if (error) throw error;
      return data as OrderWithDetails[];
    }
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({
      orderId,
      newStatus
    }: {
      orderId: string;
      newStatus: string;
    }) => {
      const {
        error
      } = await supabase.from("orders").update({
        status: newStatus
      }).eq("id", orderId);
      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["orders"]
      });
      toast.success(`Order status updated to ${variables.newStatus}`);
    },
    onError: error => {
      toast.error(`Failed to update order: ${error.message}`);
    }
  });

  // Filter statuses for dropdown based on role
  const availableStatuses = isDesigner
    ? statuses?.filter(s => DESIGNER_STATUSES.includes(s.name))
    : statuses;

  const filteredOrders = orders?.filter(order => {
    const matchesStatus = statusFilter === "all" || order.status?.toLowerCase() === statusFilter.toLowerCase();
    const orderNumberStr = order.order_number != null ? String(order.order_number) : '';
    const matchesSearch = !searchQuery || 
      order.id.toLowerCase().includes(searchQuery.toLowerCase()) || 
      order.client_name.toLowerCase().includes(searchQuery.toLowerCase()) || 
      order.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      orderNumberStr.includes(searchQuery);
    return matchesStatus && matchesSearch;
  }) || [];

  const handleStatusUpdate = (orderId: string, newStatus: string) => {
    updateStatusMutation.mutate({
      orderId,
      newStatus
    });
  };

  return (
    <div className="space-y-6">
      {!hideFilters && (
        <Card>
          <CardHeader>
            <CardTitle>Filter Orders</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search by order ID, client, or product..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="pl-9" />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-[200px]">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{isDesigner ? 'All Active' : 'All Statuses'}</SelectItem>
                {availableStatuses?.map(status => <SelectItem key={status.id} value={status.name.toLowerCase()}>
                  {status.name}
                </SelectItem>)}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>
      )}

      {isLoading ? (
        <div className="space-y-4">
          {[1, 2, 3].map(i => <Card key={i}>
            <CardContent className="p-6">
              <Skeleton className="h-24 w-full" />
            </CardContent>
          </Card>)}
        </div>
      ) : filteredOrders && filteredOrders.length > 0 ? (
        <div className="space-y-4">
          {filteredOrders.map(order => (
            <div key={order.id} className="relative group">
              <OrderCard
                id={order.id}
                order_number={order.order_number}
                client_name={order.client_name}
                email={order.email}
                delivery_date={order.delivery_date}
                status={order.status}
                statusColor={statuses?.find(s => s.name === order.status)?.color}
                total_price={order.total_price}
                foreignPrice={order.total_price_foreign}
                basePriceCompany={order.total_price_company}
                currencyCode={order.currencies?.code}
                pricing_tier={order.pricing_tier}
                currency={currency}
                onClick={() => setSelectedOrderId(order.id)}
              />
              <div className="absolute top-6 right-6 opacity-0 group-hover:opacity-100 transition-opacity">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedOrderId(order.id);
                  }}
                >
                  <Eye className="mr-2 h-4 w-4" />
                  View Details
                </Button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="p-12 text-center">
            <p className="text-muted-foreground">
              {clientId ? "No orders found for this client" : "No orders found"}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Order Details Dialog */}
      {selectedOrderId && (
        <OrderDetails
          orderId={selectedOrderId}
          open={!!selectedOrderId}
          onOpenChange={(open) => !open && setSelectedOrderId(null)}
        />
      )}
    </div>
  );
};
