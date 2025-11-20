import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";
import { usePricingTiers } from "@/hooks/usePricingTiers";
import { CalendarIcon, Plus, Trash2, Upload } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";

interface Product {
  id: string;
  name_ar: string;
  name_en: string;
  product_code: string;
  unit_price: number;
}

interface OrderItem {
  product_id: string;
  product_name: string;
  product_code: string;
  quantity: number;
  unit_price: number;
  item_total: number;
}

const NewOrder = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { companyId } = useUserRole();
  const { data: pricingTiers } = usePricingTiers();
  const [deliveryDate, setDeliveryDate] = useState<Date>();
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedTier, setSelectedTier] = useState<any>(null);
  const [orderItems, setOrderItems] = useState<OrderItem[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [openProductPopover, setOpenProductPopover] = useState<number | null>(null);
  const [requiresDesign, setRequiresDesign] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);

  const [formData, setFormData] = useState({
    client_name: "",
    email: "",
    phone: "",
    delivery_method: "",
    pricing_tier_id: "",
    notes: "",
  });

  // Fetch products
  useEffect(() => {
    const fetchProducts = async () => {
      const { data } = await supabase
        .from("products")
        .select("*")
        .order("name_en");
      
      if (data) setProducts(data);
    };

    fetchProducts();
  }, []);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    setFormData((prev) => ({
      ...prev,
      [e.target.name]: e.target.value,
    }));
  };

  const addOrderItem = () => {
    setOrderItems([
      ...orderItems,
      {
        product_id: "",
        product_name: "",
        product_code: "",
        quantity: 1,
        unit_price: 0,
        item_total: 0,
      },
    ]);
  };

  const removeOrderItem = (index: number) => {
    setOrderItems(orderItems.filter((_, i) => i !== index));
  };

  const updateOrderItem = (index: number, product: Product) => {
    const basePrice = product.unit_price;
    const markup = selectedTier ? selectedTier.markup_percent / 100 : 0;
    const unitPrice = basePrice + basePrice * markup;
    const quantity = orderItems[index]?.quantity || 1;

    const updatedItems = [...orderItems];
    updatedItems[index] = {
      product_id: product.id,
      product_name: `${product.name_ar} (${product.name_en})`,
      product_code: product.product_code,
      quantity,
      unit_price: unitPrice,
      item_total: unitPrice * quantity,
    };
    setOrderItems(updatedItems);
    setOpenProductPopover(null);
  };

  const updateQuantity = (index: number, quantity: number) => {
    if (quantity < 1) return;

    const updatedItems = [...orderItems];
    updatedItems[index].quantity = quantity;
    updatedItems[index].item_total = updatedItems[index].unit_price * quantity;
    setOrderItems(updatedItems);
  };

  const recalculatePrices = (tier: any) => {
    if (orderItems.length === 0) return;

    const updatedItems = orderItems.map((item) => {
      const product = products.find((p) => p.id === item.product_id);
      if (!product) return item;

      const basePrice = product.unit_price;
      const markup = tier ? tier.markup_percent / 100 : 0;
      const unitPrice = basePrice + basePrice * markup;

      return {
        ...item,
        unit_price: unitPrice,
        item_total: unitPrice * item.quantity,
      };
    });

    setOrderItems(updatedItems);
  };

  const handleTierChange = (tierId: string) => {
    const tier = pricingTiers.find((t) => t.id === tierId) || null;
    setSelectedTier(tier);
    setFormData((prev) => ({ ...prev, pricing_tier_id: tierId }));
    recalculatePrices(tier);
  };

  const calculateTotal = () => {
    return orderItems.reduce((sum, item) => sum + item.item_total, 0);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setSelectedFiles(Array.from(e.target.files));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!deliveryDate) {
      toast.error("Please select a delivery date");
      return;
    }

    if (orderItems.length === 0) {
      toast.error("Please add at least one order item");
      return;
    }

    if (orderItems.some((item) => !item.product_id)) {
      toast.error("Please select a product for all order items");
      return;
    }

    setIsSubmitting(true);

    try {
      // Determine initial status based on design requirement
      const initialStatus = requiresDesign ? "In Design" : "Pending Payment";

      // Insert order
      const { data: order, error: orderError } = await supabase
        .from("orders")
        .insert({
          client_name: formData.client_name,
          email: formData.email,
          phone: formData.phone,
          delivery_date: format(deliveryDate, "yyyy-MM-dd"),
          delivery_method: formData.delivery_method,
          pricing_tier_id: formData.pricing_tier_id || null,
          notes: formData.notes,
          total_price: calculateTotal(),
          status: initialStatus,
          company_id: companyId,
        })
        .select()
        .single();

      if (orderError) throw orderError;

      // Insert order items
      const itemsToInsert = orderItems.map((item) => ({
        order_id: order.id,
        product_id: item.product_id,
        quantity: item.quantity,
        unit_price: item.unit_price,
        item_total: item.item_total,
        company_id: companyId,
      }));

      const { error: itemsError } = await supabase
        .from("order_items")
        .insert(itemsToInsert);

      if (itemsError) throw itemsError;

      // Upload files if any
      if (selectedFiles.length > 0) {
        for (const file of selectedFiles) {
          const fileExt = file.name.split('.').pop();
          const fileName = `${companyId}/${order.id}/${Date.now()}_${file.name}`;
          
          const { error: uploadError } = await supabase.storage
            .from('order-files')
            .upload(fileName, file);

          if (uploadError) {
            console.error('File upload error:', uploadError);
            continue;
          }

          // Insert attachment record
          const { error: attachmentError } = await supabase
            .from('order_attachments')
            .insert({
              order_id: order.id,
              file_name: file.name,
              file_url: fileName,
              file_type: 'client_reference',
              file_size: file.size,
              uploader_id: user?.id,
              company_id: companyId,
            });

          if (attachmentError) {
            console.error('Attachment record error:', attachmentError);
          }
        }
      }

      toast.success("Order created successfully!");
      navigate("/orders");
    } catch (error) {
      console.error("Error creating order:", error);
      toast.error("Failed to create order. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-3xl font-bold text-foreground">New Order</h1>
        <p className="text-muted-foreground">Create a new print order</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Order Details Card */}
        <Card>
          <CardHeader>
            <CardTitle>Order Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Client Name and Email */}
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="client_name">Client Name *</Label>
                <Input
                  id="client_name"
                  name="client_name"
                  value={formData.client_name}
                  onChange={handleChange}
                  placeholder="Enter client name"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email *</Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  value={formData.email}
                  onChange={handleChange}
                  placeholder="client@example.com"
                  required
                />
              </div>
            </div>

            {/* Phone and Delivery Date */}
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="phone">Phone</Label>
                <Input
                  id="phone"
                  name="phone"
                  type="tel"
                  value={formData.phone}
                  onChange={handleChange}
                  placeholder="+971 XX XXX XXXX"
                />
              </div>
              <div className="space-y-2">
                <Label>Delivery Date *</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !deliveryDate && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {deliveryDate ? (
                        format(deliveryDate, "PPP")
                      ) : (
                        <span>Pick a date</span>
                      )}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={deliveryDate}
                      onSelect={setDeliveryDate}
                      initialFocus
                      className="pointer-events-auto"
                      disabled={(date) => date < new Date()}
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </div>

            {/* Delivery Method and Pricing Tier */}
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="delivery_method">Delivery Method</Label>
                <Select
                  value={formData.delivery_method}
                  onValueChange={(value) =>
                    setFormData((prev) => ({ ...prev, delivery_method: value }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select delivery method" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Courier">Courier</SelectItem>
                    <SelectItem value="Pickup">Pickup</SelectItem>
                    <SelectItem value="Other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="pricing_tier">Pricing Tier</Label>
                <Select
                  value={formData.pricing_tier_id}
                  onValueChange={handleTierChange}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select pricing tier" />
                  </SelectTrigger>
                  <SelectContent>
                    {(pricingTiers || []).map((tier) => (
                      <SelectItem key={tier.id} value={tier.id}>
                        {tier.label || tier.name} (+{tier.markup_percent}%)
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Notes */}
            <div className="space-y-2">
              <Label htmlFor="notes">Additional Notes</Label>
              <Textarea
                id="notes"
                name="notes"
                value={formData.notes}
                onChange={handleChange}
                placeholder="Any special instructions or notes"
                rows={3}
              />
            </div>

            {/* Requires Design Toggle */}
            <div className="flex items-center justify-between p-4 border rounded-lg bg-muted/30">
              <div className="space-y-0.5">
                <Label htmlFor="requires-design" className="text-base">
                  Requires Design Service?
                </Label>
                <p className="text-sm text-muted-foreground">
                  {requiresDesign
                    ? "Order will go to Designer first"
                    : "Order will skip design and go to payment check"}
                </p>
              </div>
              <Switch
                id="requires-design"
                checked={requiresDesign}
                onCheckedChange={setRequiresDesign}
              />
            </div>

            {/* File Upload */}
            <div className="space-y-2">
              <Label htmlFor="files">
                {requiresDesign
                  ? "Reference Assets (Logos, Images)"
                  : "Ready-to-Print Files"}
              </Label>
              <div className="flex items-center gap-2">
                <Input
                  id="files"
                  type="file"
                  multiple
                  onChange={handleFileChange}
                  className="flex-1"
                />
                <Upload className="h-4 w-4 text-muted-foreground" />
              </div>
              {selectedFiles.length > 0 && (
                <p className="text-sm text-muted-foreground">
                  {selectedFiles.length} file(s) selected
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Order Items Card */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Order Items</CardTitle>
            <Button type="button" onClick={addOrderItem} size="sm">
              <Plus className="mr-2 h-4 w-4" />
              Add Item
            </Button>
          </CardHeader>
          <CardContent className="space-y-4">
            {orderItems.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">
                No items added. Click "Add Item" to start.
              </p>
            ) : (
              orderItems.map((item, index) => (
                <div
                  key={index}
                  className="grid gap-4 p-4 border rounded-lg bg-muted/30"
                >
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
                    {/* Product Selection */}
                    <div className="space-y-2 lg:col-span-2">
                      <Label>Product *</Label>
                      <Popover
                        open={openProductPopover === index}
                        onOpenChange={(open) =>
                          setOpenProductPopover(open ? index : null)
                        }
                      >
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            role="combobox"
                            className="w-full justify-between"
                          >
                            {item.product_name || "Select product"}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-[400px] p-0" align="start">
                          <Command>
                            <CommandInput placeholder="Search products..." />
                            <CommandList>
                              <CommandEmpty>No products found.</CommandEmpty>
                              <CommandGroup>
                                {products.map((product) => (
                                  <CommandItem
                                    key={product.id}
                                    value={`${product.name_ar} ${product.name_en} ${product.product_code}`}
                                    onSelect={() => updateOrderItem(index, product)}
                                  >
                                    <div className="flex flex-col">
                                      <span className="font-medium">
                                        {product.name_ar}
                                      </span>
                                      <span className="text-sm text-muted-foreground">
                                        {product.name_en} - {product.product_code}
                                      </span>
                                    </div>
                                  </CommandItem>
                                ))}
                              </CommandGroup>
                            </CommandList>
                          </Command>
                        </PopoverContent>
                      </Popover>
                      {item.product_code && (
                        <p className="text-xs text-muted-foreground">
                          Code: {item.product_code}
                        </p>
                      )}
                    </div>

                    {/* Quantity */}
                    <div className="space-y-2">
                      <Label>Quantity *</Label>
                      <Input
                        type="number"
                        min="1"
                        value={item.quantity}
                        onChange={(e) =>
                          updateQuantity(index, parseInt(e.target.value) || 1)
                        }
                      />
                    </div>

                    {/* Unit Price */}
                    <div className="space-y-2">
                      <Label>Unit Price</Label>
                      <Input
                        type="text"
                        value={`AED ${item.unit_price.toFixed(2)}`}
                        readOnly
                        className="bg-muted"
                      />
                    </div>

                    {/* Item Total */}
                    <div className="space-y-2">
                      <Label>Item Total</Label>
                      <div className="flex gap-2">
                        <Input
                          type="text"
                          value={`AED ${item.item_total.toFixed(2)}`}
                          readOnly
                          className="bg-muted"
                        />
                        <Button
                          type="button"
                          variant="destructive"
                          size="icon"
                          onClick={() => removeOrderItem(index)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}

            {/* Total Price */}
            {orderItems.length > 0 && (
              <div className="flex justify-end pt-4 border-t">
                <div className="text-right space-y-1">
                  <p className="text-sm text-muted-foreground">Total Order Price</p>
                  <p className="text-2xl font-bold text-foreground">
                    AED {calculateTotal().toFixed(2)}
                  </p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Action Buttons */}
        <div className="flex gap-4 justify-end">
          <Button
            type="button"
            variant="outline"
            onClick={() => navigate("/orders")}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Creating Order..." : "Create Order"}
          </Button>
        </div>
      </form>
    </div>
  );
};

export default NewOrder;
