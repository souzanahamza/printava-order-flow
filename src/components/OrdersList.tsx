import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient, keepPreviousData } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { OrderDetails } from "@/components/OrderDetails";
import { OrderCard } from "@/components/OrderCard";
import { Search, ChevronLeft, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";
import { useOrderStatuses } from "@/hooks/useOrderStatuses";
import { useUserRole } from "@/hooks/useUserRole";
import { useDebounce } from "@/hooks/useDebounce";

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

  // Pagination state
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Debounce search query for performance (500ms delay)
  const debouncedSearchQuery = useDebounce(searchQuery, 500);

  // Reset page to 1 when filters change
  useEffect(() => {
    setPage(1);
  }, [debouncedSearchQuery, statusFilter, clientId, paymentStatusFilter]);

  // Role-based financial visibility - wait for role to load first
  const canViewFinancials = !roleLoading && ['admin', 'sales', 'accountant'].includes(role || '');

  // Designer-specific statuses
  const DESIGNER_STATUSES = ['Ready for Design', 'In Design', 'Design Revision', 'Waiting for Print File'];
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

  // Calculate pagination range
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  // Fetch orders with all details (server-side pagination)
  const {
    data: ordersData,
    isLoading,
    isFetching
  } = useQuery({
    queryKey: ["orders", isDesigner, clientId, paymentStatusFilter, statusFilter, debouncedSearchQuery, page, pageSize],
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
        `, { count: 'exact' });

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

      // Filter by status if not "all"
      if (statusFilter !== "all") {
        query = query.ilike('status', statusFilter);
      }

      // Apply search filter if search query exists
      if (debouncedSearchQuery.trim()) {
        const searchTerm = debouncedSearchQuery.trim();
        // Search by order_number, client_name, or email
        query = query.or(
          `client_name.ilike.%${searchTerm}%,email.ilike.%${searchTerm}%,order_number::text.ilike.%${searchTerm}%`
        );
      }

      // Apply pagination range
      query = query.range(from, to);

      const { data, error, count } = await query.order("created_at", { ascending: false });
      if (error) throw error;
      return {
        orders: data as OrderWithDetails[],
        totalCount: count || 0
      };
    },
    placeholderData: keepPreviousData,
  });

  const orders = ordersData?.orders || [];
  const totalCount = ordersData?.totalCount || 0;
  const totalPages = Math.ceil(totalCount / pageSize);

  const handlePageChange = (newPage: number) => {
    if (newPage >= 1 && newPage <= totalPages) {
      setPage(newPage);
    }
  };

  const handlePageSizeChange = (value: string) => {
    setPageSize(Number(value));
    setPage(1); // Reset to first page when changing page size
  };

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
      ) : orders && orders.length > 0 ? (
        <Card>
          <CardContent className="p-4 space-y-4">
            {isFetching && !isLoading && (
              <div className="text-center py-2 text-sm text-muted-foreground">
                Loading...
              </div>
            )}
            {orders.map(order => (
              <OrderCard
                key={order.id}
                id={order.id}
                order_number={order.order_number}
                client_name={order.client_name}
                phone={order.phone || ""}
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
            ))}
          </CardContent>
          
          {/* Pagination Controls */}
          <CardFooter className="flex flex-col sm:flex-row items-center justify-between gap-4 py-4 px-6 border-t">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span>Showing {from + 1}-{Math.min(to + 1, totalCount)} of {totalCount} orders</span>
            </div>
            
            <div className="flex items-center gap-4">
              {/* Rows per page selector */}
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">Rows per page:</span>
                <Select value={String(pageSize)} onValueChange={handlePageSizeChange}>
                  <SelectTrigger className="w-[70px] h-8">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="10">10</SelectItem>
                    <SelectItem value="20">20</SelectItem>
                    <SelectItem value="50">50</SelectItem>
                    <SelectItem value="100">100</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              {/* Page navigation */}
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handlePageChange(page - 1)}
                  disabled={page === 1}
                  className="h-8 px-3"
                >
                  <ChevronLeft className="h-4 w-4 mr-1" />
                  Previous
                </Button>
                
                <span className="text-sm font-medium px-2">
                  Page {page} of {totalPages || 1}
                </span>
                
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handlePageChange(page + 1)}
                  disabled={page >= totalPages}
                  className="h-8 px-3"
                >
                  Next
                  <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              </div>
            </div>
          </CardFooter>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-12 text-center">
            <p className="text-muted-foreground">
              {debouncedSearchQuery 
                ? "No orders match your search" 
                : clientId 
                  ? "No orders found for this client" 
                  : "No orders found"}
            </p>
            {debouncedSearchQuery && (
              <Button 
                variant="outline" 
                className="mt-4"
                onClick={() => setSearchQuery("")}
              >
                Clear Search
              </Button>
            )}
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
