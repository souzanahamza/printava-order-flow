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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Calendar } from "@/components/ui/calendar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";
import { useOrderFileUpload } from "@/hooks/useOrderFileUpload";
import { usePricingTiers } from "@/hooks/usePricingTiers";
import { useCompanyCurrency, useExchangeRates, useCurrencies } from "@/hooks/useCurrencies";
import { CalendarIcon, Plus, Trash2, Upload, UserPlus } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/utils/formatCurrency";
import { useQuery } from "@tanstack/react-query";
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

interface Client {
  id: string;
  full_name: string;
  business_name: string | null;
  email: string | null;
  phone: string | null;
  default_pricing_tier_id: string | null;
  default_currency_id: string | null;
}

const NewOrder = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { companyId } = useUserRole();
  const { data: pricingTiers } = usePricingTiers();
  const { data: companyCurrency } = useCompanyCurrency();
  const { data: currencies } = useCurrencies();
  const { data: exchangeRates } = useExchangeRates();

  // Currency state
  const [selectedCurrencyId, setSelectedCurrencyId] = useState<string | null>(null);
  const [currentExchangeRate, setCurrentExchangeRate] = useState<number>(1);
  const [isManualRate, setIsManualRate] = useState(false);

  // Get base currency info from the joined relation
  const baseCurrencyId = companyCurrency?.currency_id;
  const baseCurrencyCode = companyCurrency?.base_currency?.code;


  // Get selected currency info
  const selectedCurrency = currencies?.find(c => c.id === selectedCurrencyId);
  const selectedCurrencyCode = selectedCurrency?.code || baseCurrencyCode;

  // Build available currencies (base + those with active exchange rates)
  const availableCurrencies = currencies?.filter(c =>
    c.id === baseCurrencyId || exchangeRates?.some(r => r.currency_id === c.id)
  ) || [];

  const [deliveryDate, setDeliveryDate] = useState<Date>();
  const [products, setProducts] = useState<Product[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [selectedTier, setSelectedTier] = useState<any>(null);
  const [orderItems, setOrderItems] = useState<OrderItem[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [openProductPopover, setOpenProductPopover] = useState<number | null>(null);
  const [openClientPopover, setOpenClientPopover] = useState(false);
  const [requiresDesign, setRequiresDesign] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [isNewClientDialogOpen, setIsNewClientDialogOpen] = useState(false);
  const [newClientForm, setNewClientForm] = useState({
    full_name: "",
    business_name: "",
    email: "",
    phone: "",
  });

  const [formData, setFormData] = useState({
    client_id: "",
    client_name: "",
    email: "",
    phone: "",
    delivery_method: "",
    pricing_tier_id: "",
    notes: "",
  });

  // Initialize selected currency to base currency when loaded
  useEffect(() => {
    if (baseCurrencyId && !selectedCurrencyId) {
      setSelectedCurrencyId(baseCurrencyId);
      setCurrentExchangeRate(1);
    }
  }, [baseCurrencyId, selectedCurrencyId]);

  const clientNameForUpload = formData.client_name || selectedClient?.full_name || "Client";

  const orderFileUpload = useOrderFileUpload({
    orderId: "",
    clientName: clientNameForUpload,
    companyId: companyId || "",
  });

  // Fetch products and clients
  useEffect(() => {
    const fetchProducts = async () => {
      const { data } = await supabase
        .from("products")
        .select("*")
        .order("name_en");

      if (data) setProducts(data);
    };

    const fetchClients = async () => {
      const { data } = await supabase
        .from("clients")
        .select("*")
        .order("full_name");

      if (data) setClients(data);
    };

    fetchProducts();
    fetchClients();
  }, []);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    setFormData((prev) => ({
      ...prev,
      [e.target.name]: e.target.value,
    }));
  };

  const handleClientSelect = (client: Client) => {
    setSelectedClient(client);
    setFormData((prev) => ({
      ...prev,
      client_id: client.id,
      client_name: client.full_name,
      email: client.email || "",
      phone: client.phone || "",
      pricing_tier_id: client.default_pricing_tier_id || prev.pricing_tier_id,
    }));

    // Auto-select pricing tier if client has default
    if (client.default_pricing_tier_id) {
      const tier = pricingTiers?.find((t) => t.id === client.default_pricing_tier_id) || null;
      setSelectedTier(tier);
      recalculatePrices(tier);
    }

    // Auto-select currency if client has default
    if (client.default_currency_id) {
      handleCurrencyChange(client.default_currency_id);
    }

    setOpenClientPopover(false);
  };

  // Handle currency selection
  const handleCurrencyChange = (currencyId: string) => {
    setSelectedCurrencyId(currencyId);

    let newRate = 1;
    
    // If base currency, rate is 1
    if (currencyId === baseCurrencyId) {
      setCurrentExchangeRate(1);
      setIsManualRate(false);
    } else {
      // Find the latest exchange rate for this currency
      const rate = exchangeRates?.find(r => r.currency_id === currencyId);
      if (rate) {
        newRate = rate.rate_to_company_currency;
        setCurrentExchangeRate(newRate);
        setIsManualRate(false);
      } else {
        setCurrentExchangeRate(1);
        setIsManualRate(true);
      }
    }
    
    // Recalculate prices with new exchange rate
    recalculatePricesWithRate(newRate);
  };
  
  // Helper to recalculate prices with a specific exchange rate
  const recalculatePricesWithRate = (exchangeRate: number) => {
    if (orderItems.length === 0) return;

    const updatedItems = orderItems.map((item) => {
      const product = products.find((p) => p.id === item.product_id);
      if (!product) return item;

      const basePrice = product.unit_price;
      const markup = selectedTier ? selectedTier.markup_percent / 100 : 0;
      const basePriceWithMarkup = basePrice + basePrice * markup;
      const unitPrice = basePriceWithMarkup / exchangeRate;

      return {
        ...item,
        unit_price: unitPrice,
        item_total: unitPrice * item.quantity,
      };
    });

    setOrderItems(updatedItems);
  };

  const handleNewClientSubmit = async () => {
    if (!newClientForm.full_name) {
      toast.error("Client name is required");
      return;
    }

    try {
      const { data, error } = await supabase
        .from("clients")
        .insert([{
          full_name: newClientForm.full_name,
          business_name: newClientForm.business_name || null,
          email: newClientForm.email || null,
          phone: newClientForm.phone || null,
          company_id: companyId,
        }])
        .select()
        .single();

      if (error) throw error;

      toast.success("Client created successfully");
      setClients([...clients, data]);
      handleClientSelect(data);
      setIsNewClientDialogOpen(false);
      setNewClientForm({ full_name: "", business_name: "", email: "", phone: "" });
    } catch (error) {
      console.error("Error creating client:", error);
      toast.error("Failed to create client");
    }
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
    const basePrice = product.unit_price; // Price in base currency (e.g., AED)
    const markup = selectedTier ? selectedTier.markup_percent / 100 : 0;
    const basePriceWithMarkup = basePrice + basePrice * markup;
    
    // Convert to transaction currency (divide by exchange rate)
    // If base currency selected, rate is 1, so no conversion
    const unitPrice = basePriceWithMarkup / currentExchangeRate;
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

  const recalculatePrices = (tier: any, exchangeRate: number = currentExchangeRate) => {
    if (orderItems.length === 0) return;

    const updatedItems = orderItems.map((item) => {
      const product = products.find((p) => p.id === item.product_id);
      if (!product) return item;

      const basePrice = product.unit_price; // Price in base currency
      const markup = tier ? tier.markup_percent / 100 : 0;
      const basePriceWithMarkup = basePrice + basePrice * markup;
      
      // Convert to transaction currency
      const unitPrice = basePriceWithMarkup / exchangeRate;

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
      // Append new files to existing selection
      setSelectedFiles((prev) => [...prev, ...Array.from(e.target.files!)]);
    }
  };

  const removeFile = (index: number) => {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!companyId) {
      toast.error("No company selected for your profile");
      return;
    }

    if (!user?.id) {
      toast.error("You must be signed in to create an order");
      return;
    }

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
      const initialStatus = requiresDesign ? "Ready for Design" : "Pending Payment";

      // Calculate multi-currency totals
      const totalForeign = calculateTotal(); // Total in selected currency
      const totalCompany = totalForeign * currentExchangeRate; // Converted to company base currency

      // Insert order with multi-currency fields
      const { data: order, error: orderError } = await supabase
        .from("orders")
        .insert({
          client_id: formData.client_id || null,
          client_name: formData.client_name,
          email: formData.email,
          phone: formData.phone,
          delivery_date: format(deliveryDate, "yyyy-MM-dd"),
          delivery_method: formData.delivery_method,
          pricing_tier_id: formData.pricing_tier_id || null,
          notes: formData.notes,
          total_price: totalForeign, // Legacy field - keep for backwards compatibility
          total_price_foreign: totalForeign,
          total_price_company: totalCompany,
          currency_id: selectedCurrencyId,
          exchange_rate: currentExchangeRate,
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

      // Upload files if any using the smart file upload hook
      if (selectedFiles.length > 0) {
        const fileType = requiresDesign ? "client_reference" : "print_file";
        for (const file of selectedFiles) {
          try {
            await orderFileUpload.uploadFileAsync({
              file,
              fileType,
              uploaderId: user.id,
              orderIdOverride: order.id,
              clientNameOverride: order.client_name || clientNameForUpload,
            });
          } catch (uploadError) {
            console.error("File upload error:", uploadError);
            toast.error("Some files failed to upload");
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
            {/* Client Selection with Search */}
            <div className="space-y-2">
              <Label>Select Client *</Label>
              <div className="flex gap-2">
                <Popover open={openClientPopover} onOpenChange={setOpenClientPopover}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      className="flex-1 justify-between"
                    >
                      {selectedClient ? selectedClient.full_name : "Search and select a client..."}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[400px] p-0" align="start">
                    <Command>
                      <CommandInput placeholder="Search clients..." />
                      <CommandList>
                        <CommandEmpty>No clients found.</CommandEmpty>
                        <CommandGroup>
                          {clients.map((client) => (
                            <CommandItem
                              key={client.id}
                              value={`${client.full_name} ${client.email || ""} ${client.phone || ""}`}
                              onSelect={() => handleClientSelect(client)}
                            >
                              <div className="flex flex-col">
                                <span className="font-medium">{client.full_name}</span>
                                {client.business_name && (
                                  <span className="text-sm text-muted-foreground">
                                    {client.business_name}
                                  </span>
                                )}
                                <span className="text-xs text-muted-foreground">
                                  {client.email || client.phone || "No contact info"}
                                </span>
                              </div>
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>

                <Dialog open={isNewClientDialogOpen} onOpenChange={setIsNewClientDialogOpen}>
                  <DialogTrigger asChild>
                    <Button type="button" variant="outline" size="icon">
                      <UserPlus className="h-4 w-4" />
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Add New Client</DialogTitle>
                      <DialogDescription>
                        Quickly add a new client to continue with the order
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="new_client_name">Full Name *</Label>
                        <Input
                          id="new_client_name"
                          value={newClientForm.full_name}
                          onChange={(e) => setNewClientForm((prev) => ({ ...prev, full_name: e.target.value }))}
                          placeholder="Enter client name"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="new_client_business">Business Name</Label>
                        <Input
                          id="new_client_business"
                          value={newClientForm.business_name}
                          onChange={(e) => setNewClientForm((prev) => ({ ...prev, business_name: e.target.value }))}
                          placeholder="Optional"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="new_client_email">Email</Label>
                        <Input
                          id="new_client_email"
                          type="email"
                          value={newClientForm.email}
                          onChange={(e) => setNewClientForm((prev) => ({ ...prev, email: e.target.value }))}
                          placeholder="client@example.com"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="new_client_phone">Phone</Label>
                        <Input
                          id="new_client_phone"
                          type="tel"
                          value={newClientForm.phone}
                          onChange={(e) => setNewClientForm((prev) => ({ ...prev, phone: e.target.value }))}
                          placeholder="+971 XX XXX XXXX"
                        />
                      </div>
                    </div>
                    <DialogFooter>
                      <Button type="button" variant="outline" onClick={() => setIsNewClientDialogOpen(false)}>
                        Cancel
                      </Button>
                      <Button type="button" onClick={handleNewClientSubmit}>
                        Add Client
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>
            </div>

            {/* Email and Phone (auto-filled from client) */}
            <div className="grid gap-4 sm:grid-cols-2">
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
            </div>

            {/* Delivery Date */}
            <div className="grid gap-4 sm:grid-cols-2">
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

            {/* Currency and Delivery Method */}
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Transaction Currency</Label>
                <Select
                  value={selectedCurrencyId || ""}
                  onValueChange={handleCurrencyChange}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select currency" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableCurrencies.map((curr) => (
                      <SelectItem key={curr.id} value={curr.id}>
                        {curr.code} - {curr.name}
                        {curr.id === baseCurrencyId && " (Base)"}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
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
            </div>

            {/* Exchange Rate (shown when non-base currency) */}
            {selectedCurrencyId && selectedCurrencyId !== baseCurrencyId && (
              <div className="p-4 border rounded-lg bg-muted/30 space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="text-sm">Exchange Rate</Label>
                  <span className="text-xs text-muted-foreground">
                    1 {selectedCurrencyCode} = {currentExchangeRate.toFixed(4)} {baseCurrencyCode}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    step="0.0001"
                    min="0.0001"
                    value={currentExchangeRate}
                    onChange={(e) => {
                      const newRate = parseFloat(e.target.value) || 1;
                      setCurrentExchangeRate(newRate);
                      setIsManualRate(true);
                      recalculatePricesWithRate(newRate);
                    }}
                    className="w-32"
                  />
                  <span className="text-sm text-muted-foreground flex-1">
                    {isManualRate ? "(Manual override)" : "(Auto-fetched)"}
                  </span>
                </div>
              </div>
            )}

            {/* Pricing Tier */}
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
            <div className="space-y-3">
              <Label>
                {requiresDesign
                  ? "Reference Assets (Logos, Images)"
                  : "Ready-to-Print Files"}
              </Label>
              <div
                className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-6 text-center hover:border-primary/50 transition-colors cursor-pointer"
                onClick={() => document.getElementById("file-input")?.click()}
              >
                <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                <p className="text-sm text-muted-foreground">
                  Click to select files or drag and drop
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  You can select multiple files
                </p>
                <Input
                  id="file-input"
                  type="file"
                  multiple
                  onChange={handleFileChange}
                  className="hidden"
                />
              </div>

              {/* Selected Files List */}
              {selectedFiles.length > 0 && (
                <div className="space-y-2">
                  <p className="text-sm font-medium text-foreground">
                    {selectedFiles.length} file(s) selected
                  </p>
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {selectedFiles.map((file, index) => (
                      <div
                        key={`${file.name}-${index}`}
                        className="flex items-center justify-between p-2 bg-muted/50 rounded-md border"
                      >
                        <div className="flex-1 min-w-0 mr-2">
                          <p className="text-sm font-medium truncate">{file.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {formatFileSize(file.size)}
                          </p>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive hover:text-destructive"
                          onClick={() => removeFile(index)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
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
                        value={formatCurrency(item.unit_price, selectedCurrencyCode)}
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
                          value={formatCurrency(item.item_total, selectedCurrencyCode)}
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
                    {formatCurrency(calculateTotal(), selectedCurrencyCode)}
                  </p>
                  {selectedCurrencyId !== baseCurrencyId && (
                    <p className="text-sm text-muted-foreground">
                      ≈ {formatCurrency(calculateTotal() * currentExchangeRate, baseCurrencyCode)} (converted)
                    </p>
                  )}
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
