import { OrdersList } from "@/components/OrdersList";

const Orders = () => {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Orders</h1>
        <p className="text-muted-foreground">
          Manage and track all your print orders.
        </p>
      </div>

      <OrdersList />
    </div>
  );
};

export default Orders;