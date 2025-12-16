import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Download, CheckCircle, AlertCircle, Calendar, Package as PackageIcon, User, FileText, Truck, Clock, Cog } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format, isToday, isTomorrow } from "date-fns";

type ProductionOrder = {
  id: string;
  client_name: string;
  email: string;
  phone: string | null;
  delivery_date: string;
  delivery_method: string | null;
  notes: string | null;
  created_at: string;
  status: string;
  order_items: Array<{
    quantity: number;
    product: {
      name_en: string;
      sku: string;
      image_url: string | null;
    };
  }>;
  attachments: Array<{
    file_url: string;
    file_name: string;
  }>;
  clientFiles: Array<{
    file_url: string;
    file_name: string;
  }>;
};

const Production = () => {
  const queryClient = useQueryClient();

  const { data: orders = [], isLoading } = useQuery({
    queryKey: ['production-orders'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('orders')
        .select(`
          id,
          client_name,
          email,
          phone,
          delivery_date,
          delivery_method,
          notes,
          created_at,
          status,
          order_items (
            quantity,
            product:products (
              name_en,
              sku,
              image_url
            )
          )
        `)
        .in('status', ['Ready for Production', 'In Production'])
        .order('delivery_date', { ascending: true });

      if (error) throw error;

      // Fetch print files and client files for each order
      const ordersWithFiles = await Promise.all(
        (data || []).map(async (order) => {
          const { data: printFiles } = await supabase
            .from('order_attachments')
            .select('file_url, file_name')
            .eq('order_id', order.id)
            .eq('file_type', 'print_file');

          const { data: clientFiles } = await supabase
            .from('order_attachments')
            .select('file_url, file_name')
            .eq('order_id', order.id)
            .eq('file_type', 'client_reference');

          return {
            ...order,
            attachments: printFiles || [],
            clientFiles: clientFiles || []
          };
        })
      );

      return ordersWithFiles as ProductionOrder[];
    }
  });

  const startJobMutation = useMutation({
    mutationFn: async (orderId: string) => {
      const { error } = await supabase
        .from('orders')
        .update({ status: 'In Production' })
        .eq('id', orderId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['production-orders'] });
      toast.success('Job started! Printing in progress.');
    },
    onError: (error) => {
      toast.error('Failed to start job');
      console.error(error);
    }
  });

  const markAsReadyMutation = useMutation({
    mutationFn: async (orderId: string) => {
      const { error } = await supabase
        .from('orders')
        .update({ status: 'Ready for Pickup' })
        .eq('id', orderId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['production-orders'] });
      toast.success('Order marked as ready for pickup!');
    },
    onError: (error) => {
      toast.error('Failed to update order status');
      console.error(error);
    }
  });

  const getUrgencyBadge = (deliveryDate: string) => {
    const date = new Date(deliveryDate);

    if (isToday(date)) {
      return <Badge variant="destructive" className="gap-1"><AlertCircle className="h-3 w-3" />Due Today</Badge>;
    }

    if (isTomorrow(date)) {
      return <Badge variant="default" className="bg-orange-500 hover:bg-orange-600 gap-1"><AlertCircle className="h-3 w-3" />Due Tomorrow</Badge>;
    }

    return <Badge variant="outline">{format(date, 'MMM d, yyyy')}</Badge>;
  };

  const getStatusBadge = (status: string) => {
    if (status === 'Ready for Production') {
      return (
        <Badge variant="secondary" className="gap-1 bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400 border-amber-300">
          <Clock className="h-3 w-3" />
          Waiting for Machine
        </Badge>
      );
    }
    return (
      <Badge variant="default" className="gap-1 bg-blue-500 hover:bg-blue-600 animate-pulse">
        <Cog className="h-3 w-3 animate-spin" />
        Printing in Progress
      </Badge>
    );
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Production Queue</h1>
        <p className="text-muted-foreground">Orders ready for production, sorted by delivery urgency</p>
      </div>

      {orders.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <CheckCircle className="h-16 w-16 text-muted-foreground mb-4" />
            <p className="text-lg font-medium text-muted-foreground">No orders in production</p>
            <p className="text-sm text-muted-foreground">All caught up!</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {orders.map((order) => (
            <Card key={order.id} className={`hover:shadow-lg transition-shadow ${order.status === 'In Production' ? 'border-blue-500/50 ring-1 ring-blue-500/20' : ''}`}>
              <CardHeader className="pb-4">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div className="flex items-center gap-3 flex-wrap">
                    <CardTitle className="text-xl font-bold">{order.id}</CardTitle>
                    {getStatusBadge(order.status)}
                    {getUrgencyBadge(order.delivery_date)}
                  </div>
                  <Badge variant="outline" className="gap-1 w-fit">
                    <Calendar className="h-3 w-3" />
                    {format(new Date(order.created_at), 'MMM d, yyyy')}
                  </Badge>
                </div>
              </CardHeader>

              <CardContent className="space-y-4">
                {/* Client Information */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 bg-muted/50 rounded-lg">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <User className="h-4 w-4" />
                      <span className="font-medium">Client</span>
                    </div>
                    <p className="text-base font-semibold ml-6">{order.client_name}</p>
                    {order.phone && (
                      <p className="text-sm text-muted-foreground ml-6">{order.phone}</p>
                    )}
                  </div>

                  <div className="space-y-1">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Truck className="h-4 w-4" />
                      <span className="font-medium">Delivery</span>
                    </div>
                    <p className="text-base font-semibold ml-6">
                      {format(new Date(order.delivery_date), 'EEEE, MMM d, yyyy')}
                    </p>
                    {order.delivery_method && (
                      <Badge variant="secondary" className="ml-6 mt-1">
                        {order.delivery_method}
                      </Badge>
                    )}
                  </div>
                </div>

                <Separator />

                {/* Order Items */}
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                    <PackageIcon className="h-4 w-4" />
                    Production Items
                  </div>
                  <div className="space-y-2">
                    {order.order_items.map((item, idx) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between p-3 bg-background border rounded-lg"
                      >
                        <div className="flex items-center gap-3">
                          {item.product.image_url ? (
                            <img
                              src={item.product.image_url}
                              alt={item.product.name_en}
                              className="h-12 w-12 rounded-lg object-cover border"
                            />
                          ) : (
                            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-muted border">
                              <PackageIcon className="h-6 w-6 text-muted-foreground" />
                            </div>
                          )}
                          <div>
                            <p className="font-medium">{item.product.name_en}</p>
                            <p className="text-sm text-muted-foreground">SKU: {item.product.sku}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant="secondary" className="font-semibold">
                            {item.quantity}x
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Notes */}
                {order.notes && (
                  <>
                    <Separator />
                    <Alert className="bg-yellow-50 border-yellow-200 dark:bg-yellow-950/20 dark:border-yellow-900">
                      <FileText className="h-4 w-4 text-yellow-800 dark:text-yellow-500" />
                      <AlertDescription className="text-sm text-yellow-800 dark:text-yellow-500 ml-2">
                        <strong className="font-semibold">Production Notes:</strong>
                        <p className="mt-1">{order.notes}</p>
                      </AlertDescription>
                    </Alert>
                  </>
                )}

                <Separator />

                {/* Actions */}
                <div className="flex flex-col gap-3">
                  {/* Client Files */}
                  {order.clientFiles.length > 0 && (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                        <FileText className="h-4 w-4" />
                        Client Files & Assets
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {order.clientFiles.map((file, idx) => (
                          <Button
                            key={idx}
                            variant="outline"
                            size="sm"
                            className="gap-2"
                            asChild
                          >
                            <a href={file.file_url} target="_blank" rel="noopener noreferrer">
                              <Download className="h-4 w-4" />
                              {file.file_name}
                            </a>
                          </Button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Print Files & Action Buttons */}
                  <div className="flex flex-col sm:flex-row gap-3">
                    {order.attachments.length > 0 ? (
                      order.attachments.map((file, idx) => (
                        <Button
                          key={idx}
                          variant="outline"
                          className="flex-1 gap-2"
                          asChild
                        >
                          <a href={file.file_url} target="_blank" rel="noopener noreferrer">
                            <Download className="h-4 w-4" />
                            Download Print File
                          </a>
                        </Button>
                      ))
                    ) : (
                      <Button variant="outline" disabled className="flex-1">
                        <AlertCircle className="h-4 w-4 mr-2" />
                        No Print File Available
                      </Button>
                    )}

                    {order.status === 'Ready for Production' ? (
                      <Button
                        onClick={() => startJobMutation.mutate(order.id)}
                        disabled={startJobMutation.isPending}
                        className="flex-1 gap-2 bg-amber-600 hover:bg-amber-700"
                        size="lg"
                      >
                        <Cog className="h-5 w-5" />
                        Start Job
                      </Button>
                    ) : (
                      <Button
                        onClick={() => markAsReadyMutation.mutate(order.id)}
                        disabled={markAsReadyMutation.isPending}
                        className="flex-1 gap-2 bg-emerald-600 hover:bg-emerald-700"
                        size="lg"
                      >
                        <CheckCircle className="h-5 w-5" />
                        Mark as Ready
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default Production;
