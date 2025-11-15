import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/StatusBadge";
import { Search, ChevronDown, ChevronUp } from "lucide-react";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Label } from "@/components/ui/label";
interface OrderStatus {
  id: string;
  name: string;
  sort_order: number;
}
type OrderWithDetails = {
  id: string;
  client_name: string;
  email: string;
  phone: string | null;
  delivery_date: string;
  status: string;
  total_price: number;
  notes: string | null;
  delivery_method: string | null;
  pricing_tier_id: string | null;
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
const Orders = () => {
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedOrders, setExpandedOrders] = useState<Set<string>>(new Set());
  const queryClient = useQueryClient();

  // Fetch order statuses
  const {
    data: statuses
  } = useQuery({
    queryKey: ["orderStatuses"],
    queryFn: async () => {
      const {
        data,
        error
      } = await supabase.from("order_statuses").select("*").order("sort_order");
      if (error) throw error;
      return data as OrderStatus[];
    }
  });

  // Fetch orders with all details
  const {
    data: orders,
    isLoading
  } = useQuery({
    queryKey: ["orders"],
    queryFn: async () => {
      const {
        data,
        error
      } = await supabase.from("orders").select(`
          *,
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
        `).order("created_at", {
        ascending: false
      });
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
  const filteredOrders = orders?.filter(order => {
    const matchesStatus = statusFilter === "all" || order.status?.toLowerCase() === statusFilter.toLowerCase();
    const matchesSearch = order.id.toLowerCase().includes(searchQuery.toLowerCase()) || order.client_name.toLowerCase().includes(searchQuery.toLowerCase()) || order.email.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesStatus && matchesSearch;
  });
  const toggleOrderExpansion = (orderId: string) => {
    setExpandedOrders(prev => {
      const newSet = new Set(prev);
      if (newSet.has(orderId)) {
        newSet.delete(orderId);
      } else {
        newSet.add(orderId);
      }
      return newSet;
    });
  };
  const handleStatusUpdate = (orderId: string, newStatus: string) => {
    updateStatusMutation.mutate({
      orderId,
      newStatus
    });
  };
  return <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Orders</h1>
        <p className="text-muted-foreground">Manage and track all your print orders.</p>
      </div>

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
              <SelectItem value="all">All Statuses</SelectItem>
              {statuses?.map(status => <SelectItem key={status.id} value={status.name.toLowerCase()}>
                  {status.name}
                </SelectItem>)}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {isLoading ? <div className="space-y-4">
          {[1, 2, 3].map(i => <Card key={i}>
              <CardContent className="p-6">
                <Skeleton className="h-24 w-full" />
              </CardContent>
            </Card>)}
        </div> : filteredOrders && filteredOrders.length > 0 ? <div className="space-y-4">
          {filteredOrders.map(order => <Card key={order.id}>
              <Collapsible open={expandedOrders.has(order.id)} onOpenChange={() => toggleOrderExpansion(order.id)}>
                <CardHeader className="pb-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex-1 space-y-2">
                      <div className="flex items-center gap-3">
                        <CardTitle className="text-lg font-semibold">
                          {order.client_name}
                        </CardTitle>
                        <StatusBadge status={order.status} />
                      </div>
                      <div className="text-sm text-muted-foreground space-y-1">
                        <p>Order ID: <span className="font-mono">{order.id.slice(0, 8)}</span></p>
                        <p>Delivery: {new Date(order.delivery_date).toLocaleDateString()}</p>
                        {order.pricing_tier && <p>Tier: {order.pricing_tier.label || order.pricing_tier.name}</p>}
                        <p className="font-semibold text-foreground">
                          Total: ${order.total_price?.toFixed(2) || "0.00"}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Select value={order.status} onValueChange={value => handleStatusUpdate(order.id, value)}>
                        <SelectTrigger className="w-[180px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {statuses?.map(status => <SelectItem key={status.id} value={status.name}>
                              {status.name}
                            </SelectItem>)}
                        </SelectContent>
                      </Select>
                      <CollapsibleTrigger asChild>
                        <Button variant="ghost" size="sm">
                          {expandedOrders.has(order.id) ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                        </Button>
                      </CollapsibleTrigger>
                    </div>
                  </div>
                </CardHeader>
                <CollapsibleContent>
                  <CardContent>
                    <div className="space-y-4">
                      <div className="border-t pt-4">
                        <h4 className="font-semibold mb-3">Order Items</h4>
                        <div className="space-y-3">
                          {order.order_items.map(item => <div key={item.id} className="flex flex-col sm:flex-row gap-4 p-4 bg-muted/50 rounded-lg">
                              {item.product.image_url && <img src={item.product.image_url} alt={item.product.name_en} className="w-20 h-20 object-cover rounded" />}
                              <div className="flex-1 space-y-1">
                                <p className="font-medium">{item.product.name_en}</p>
                                <p className="text-sm text-muted-foreground">
                                  SKU: {item.product.sku}
                                </p>
                                {item.product.product_code && <p className="text-sm text-muted-foreground">
                                    Code: {item.product.product_code}
                                  </p>}
                              </div>
                              <div className="text-sm space-y-1 sm:text-right">
                                <p>Quantity: <span className="font-medium">{item.quantity}</span></p>
                                <p>Unit Price: <span className="font-medium">${item.unit_price.toFixed(2)}</span></p>
                                <p className="font-semibold text-foreground">
                                  Total: ${item.item_total.toFixed(2)}
                                </p>
                              </div>
                            </div>)}
                        </div>
                      </div>
                      {(order.notes || order.email || order.phone) && <div className="border-t pt-4">
                          <h4 className="font-semibold mb-2">Contact & Notes</h4>
                          <div className="text-sm text-muted-foreground space-y-1">
                            <p>Email: {order.email}</p>
                            {order.phone && <p>Phone: {order.phone}</p>}
                            {order.delivery_method && <p>Delivery: {order.delivery_method}</p>}
                            {order.notes && <p className="mt-2 text-foreground">Notes: {order.notes}</p>}
                          </div>
                        </div>}
                    </div>
                  </CardContent>
                </CollapsibleContent>
              </Collapsible>
            </Card>)}
        </div> : <Card>
          <CardContent className="p-12 text-center">
            <p className="text-muted-foreground">No orders found</p>
          </CardContent>
        </Card>}
    </div>;
};
export default Orders;