import { OrdersList } from "@/features/orders/components/OrdersList";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useUserRole } from "@/hooks/useUserRole";

const OrdersPage = () => {
  const navigate = useNavigate();
  const { loading, isAdmin, isSales } = useUserRole();
  const canCreateOrder = !loading && (isAdmin || isSales);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Orders</h1>
          <p className="text-muted-foreground">Manage and track all your print orders..</p>
        </div>
        {canCreateOrder && (
          <Button onClick={() => navigate("/new-order")}>
            <Plus className="mr-2 h-4 w-4" />
            Create Order
          </Button>
        )}
      </div>

      <OrdersList />
    </div>
  );
};

export default OrdersPage;
