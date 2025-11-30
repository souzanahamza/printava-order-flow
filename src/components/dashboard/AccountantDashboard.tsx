import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DollarSign, Clock, FileText } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { OrderCard } from '@/components/OrderCard';
import { OrderDetails } from '@/components/OrderDetails';
import { OrdersList } from '@/components/OrdersList';
import { StatusBadge } from '@/components/StatusBadge';
import { useState } from 'react';
import * as React from 'react';
import { Button } from '@/components/ui/button';
import { formatCurrency } from '@/utils/formatCurrency';
import { useUserRole } from '@/hooks/useUserRole';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useOrderStatuses } from '@/hooks/useOrderStatuses';

export function AccountantDashboard() {
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [viewingHistoryClientId, setViewingHistoryClientId] = useState<string | null>(null);
  const [viewingHistoryClientName, setViewingHistoryClientName] = useState<string>('');
  const { data: statuses } = useOrderStatuses();
  const { companyId } = useUserRole();

  // Fetch company profile for currency
  const { data: companyProfile } = useQuery({
    queryKey: ["company-profile", companyId],
    queryFn: async () => {
      if (!companyId) return null;
      const { data, error } = await supabase
        .from("companies")
        .select("currency")
        .eq("id", companyId)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!companyId,
  });

  const currency = companyProfile?.currency || 'AED';

  // Fetch all orders for calculations
  const { data: orders, isLoading } = useQuery({
    queryKey: ['orders-accountant'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('orders')
        .select('*, clients(id, full_name)')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data;
    },
  });

  // Calculate stats
  const pendingReceivables = orders?.reduce((sum, order) => {
    if (order.payment_status === 'pending' || order.payment_status === 'partial') {
      return sum + ((order.total_price || 0) - (order.paid_amount || 0));
    }
    return sum;
  }, 0) || 0;

  const todaysCollections = orders?.reduce((sum, order) => {
    const updatedDate = new Date(order.created_at || '').toDateString();
    const today = new Date().toDateString();
    if (updatedDate === today && order.payment_status === 'paid') {
      return sum + (order.paid_amount || 0);
    }
    return sum;
  }, 0) || 0;

  const ordersToInvoice = orders?.filter(
    (order) => order.status === 'Pending Payment' || order.status === 'Ready for Pickup'
  ).length || 0;

  // Action Required orders
  const actionRequiredOrders = orders?.filter(
    (order) =>
      order.status === 'Pending Payment' ||
      (order.status === 'Ready for Pickup' && order.payment_status !== 'paid')
  ) || [];

  // Top Debtors (Clients with outstanding balances)
  const topDebtors = React.useMemo(() => {
    if (!orders) return [];
    
    // Aggregate debt by client_id
    const clientDebtMap = new Map<string, { 
      clientId: string;
      clientName: string; 
      totalDebt: number; 
      openOrders: number;
    }>();

    orders.forEach((order) => {
      const balance = (order.total_price || 0) - (order.paid_amount || 0);
      if (balance > 0) {
        // Use client_id if available, otherwise fall back to client_name as identifier
        const clientKey = order.client_id || `legacy_${order.client_name}`;
        const clientName = order.clients?.full_name || order.client_name;
        
        const existing = clientDebtMap.get(clientKey);
        if (existing) {
          existing.totalDebt += balance;
          existing.openOrders += 1;
        } else {
          clientDebtMap.set(clientKey, {
            clientId: order.client_id || null,
            clientName: clientName,
            totalDebt: balance,
            openOrders: 1,
          });
        }
      }
    });

    // Convert to array, sort by debt descending, take top 10
    return Array.from(clientDebtMap.values())
      .sort((a, b) => b.totalDebt - a.totalDebt)
      .slice(0, 10);
  }, [orders]);

  const handleViewOrder = (orderId: string) => {
    setSelectedOrderId(orderId);
    setIsDetailsOpen(true);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Financial Dashboard</h1>
        <p className="text-muted-foreground">Payment tracking and receivables overview</p>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending Receivables</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-24" />
            ) : (
              <>
                <div className="text-2xl font-bold">{formatCurrency(pendingReceivables, currency)}</div>
                <p className="text-xs text-muted-foreground">
                  Amount outstanding
                </p>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Today's Collections</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-24" />
            ) : (
              <>
                <div className="text-2xl font-bold">{formatCurrency(todaysCollections, currency)}</div>
                <p className="text-xs text-muted-foreground">
                  Collected today
                </p>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Orders to Invoice</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-24" />
            ) : (
              <>
                <div className="text-2xl font-bold">{ordersToInvoice}</div>
                <p className="text-xs text-muted-foreground">
                  Awaiting payment
                </p>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Action Required */}
      <Card>
        <CardHeader>
          <CardTitle>Action Required</CardTitle>
          <p className="text-sm text-muted-foreground">
            Orders needing immediate accounting attention
          </p>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
            </div>
          ) : actionRequiredOrders.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              No orders require attention
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Order ID</TableHead>
                  <TableHead>Client</TableHead>
                  <TableHead>Amount Due</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {actionRequiredOrders.map((order) => {
                  const amountDue = (order.total_price || 0) - (order.paid_amount || 0);
                  return (
                    <TableRow key={order.id}>
                      <TableCell className="font-medium">
                        #{order.id.slice(0, 8)}
                      </TableCell>
                      <TableCell>{order.client_name}</TableCell>
                      <TableCell className="font-semibold text-destructive">
                        {formatCurrency(amountDue, currency)}
                      </TableCell>
                      <TableCell>
                        <StatusBadge 
                          status={order.status} 
                          color={statuses?.find(s => s.name === order.status)?.color}
                        />
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleViewOrder(order.id)}
                        >
                          View
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Outstanding Balances */}
      <Card>
        <CardHeader>
          <CardTitle>Outstanding Balances</CardTitle>
          <p className="text-sm text-muted-foreground">
            Top clients with unpaid dues
          </p>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
            </div>
          ) : topDebtors.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              No outstanding balances
            </p>
          ) : (
            <div className="space-y-2">
              {topDebtors.map((debtor) => (
                <div
                  key={debtor.clientName}
                  className="flex items-center justify-between p-3 border border-border rounded-lg hover:bg-accent/50 transition-colors"
                >
                  <div className="flex-1">
                    <p className="font-medium text-foreground">
                      {debtor.clientName}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {debtor.openOrders} unpaid {debtor.openOrders === 1 ? 'order' : 'orders'}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <p className="font-bold text-destructive text-lg">
                        {formatCurrency(debtor.totalDebt, currency)}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        if (debtor.clientId) {
                          setViewingHistoryClientId(debtor.clientId);
                          setViewingHistoryClientName(debtor.clientName);
                        }
                      }}
                      disabled={!debtor.clientId}
                    >
                      View
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Order Details Modal */}
      <OrderDetails
        orderId={selectedOrderId}
        open={isDetailsOpen}
        onOpenChange={setIsDetailsOpen}
      />

      {/* Client Payment History Dialog */}
      <Dialog open={!!viewingHistoryClientId} onOpenChange={(open) => !open && setViewingHistoryClientId(null)}>
        <DialogContent className="max-w-6xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle>Outstanding Orders - {viewingHistoryClientName}</DialogTitle>
          </DialogHeader>
          <div className="overflow-y-auto max-h-[calc(90vh-8rem)]">
            {viewingHistoryClientId && (
              <OrdersList 
                clientId={viewingHistoryClientId}
                paymentStatusFilter={['pending', 'partial']}
              />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
