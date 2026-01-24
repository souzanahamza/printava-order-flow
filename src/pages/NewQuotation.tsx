import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import { usePricingTiers } from "@/hooks/usePricingTiers";
import {
  useCompanyCurrency,
  useExchangeRates,
  useCurrencies,
} from "@/hooks/useCurrencies";
import { CalendarIcon, Plus, Trash2, UserPlus } from "lucide-react";
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
import { formatCurrency } from "@/utils/formatCurrency";

interface Product {
  id: string;
  name_ar: string;
  name_en: string;
  product_code: string;
  sku: string | null;
  unit_price: number;
}

interface QuotationItem {
  product_id: string;
  product_name: string;
  product_code: string;
  sku?: string;
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

const NewQuotation = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { companyId } = useUserRole();
  const { data: pricingTiers } = usePricingTiers();
  const { data: companyCurrency } = useCompanyCurrency();
  const { data: currencies } = useCurrencies();
  const { data: exchangeRates } = useExchangeRates();

  // Currency state
  const [selectedCurrencyId, setSelectedCurrencyId] = useState<string | null>(
    null
  );
  const [currentExchangeRate, setCurrentExchangeRate] = useState<number>(1);
  const [isManualRate, setIsManualRate] = useState(false);

  // Get base currency info from the joined relation
  const baseCurrencyId = companyCurrency?.currency_id;
  const baseCurrencyCode = companyCurrency?.base_currency?.code;

  // Get selected currency info
  const selectedCurrency = currencies?.find((c) => c.id === selectedCurrencyId);
  const selectedCurrencyCode = selectedCurrency?.code || baseCurrencyCode;

  // Build available currencies (base + those with active exchange rates)
  const availableCurrencies =
    currencies?.filter(
      (c) =>
        c.id === baseCurrencyId ||
        exchangeRates?.some((r) => r.currency_id === c.id)
    ) || [];

  const [validUntil, setValidUntil] = useState<Date | undefined>();
  const [products, setProducts] = useState<Product[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [selectedTier, setSelectedTier] = useState<any>(null);
  const [quotationItems, setQuotationItems] = useState<QuotationItem[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [openProductPopover, setOpenProductPopover] = useState<number | null>(
    null
  );
  const [openClientPopover, setOpenClientPopover] = useState(false);
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
      const tier =
        pricingTiers?.find((t) => t.id === client.default_pricing_tier_id) ||
        null;
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
      const rate = exchangeRates?.find((r) => r.currency_id === currencyId);
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
    if (quotationItems.length === 0) return;

    const updatedItems = quotationItems.map((item) => {
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

    setQuotationItems(updatedItems);
  };

  const handleNewClientSubmit = async () => {
    if (!newClientForm.full_name) {
      toast.error("Client name is required");
      return;
    }

    try {
      const { data, error } = await supabase
        .from("clients")
        .insert([
          {
            full_name: newClientForm.full_name,
            business_name: newClientForm.business_name || null,
            email: newClientForm.email || null,
            phone: newClientForm.phone || null,
            company_id: companyId,
          },
        ])
        .select()
        .single();

      if (error) throw error;

      toast.success("Client created successfully");
      setClients([...clients, data]);
      handleClientSelect(data);
      setIsNewClientDialogOpen(false);
      setNewClientForm({
        full_name: "",
        business_name: "",
        email: "",
        phone: "",
      });
    } catch (error) {
      console.error("Error creating client:", error);
      toast.error("Failed to create client");
    }
  };

  const addQuotationItem = () => {
    setQuotationItems([
      ...quotationItems,
      {
        product_id: "",
        product_name: "",
        product_code: "",
        sku: "",
        quantity: 1,
        unit_price: 0,
        item_total: 0,
      },
    ]);
  };

  const removeQuotationItem = (index: number) => {
    setQuotationItems(quotationItems.filter((_, i) => i !== index));
  };

  const updateQuotationItem = (index: number, product: Product) => {
    const basePrice = product.unit_price; // Price in base currency (e.g., AED)
    const markup = selectedTier ? selectedTier.markup_percent / 100 : 0;
    const basePriceWithMarkup = basePrice + basePrice * markup;

    // Convert to transaction currency (divide by exchange rate)
    const unitPrice = basePriceWithMarkup / currentExchangeRate;
    const quantity = quotationItems[index]?.quantity || 1;

    const updatedItems = [...quotationItems];
    updatedItems[index] = {
      product_id: product.id,
      product_name: `${product.name_en} (${product.name_ar})`,
      product_code: product.product_code,
      sku: product.sku || "",
      quantity,
      unit_price: unitPrice,
      item_total: unitPrice * quantity,
    };
    setQuotationItems(updatedItems);
    setOpenProductPopover(null);
  };

  const updateQuantity = (index: number, quantity: number) => {
    if (quantity < 1) return;

    const updatedItems = [...quotationItems];
    updatedItems[index].quantity = quantity;
    updatedItems[index].item_total =
      updatedItems[index].unit_price * quantity;
    setQuotationItems(updatedItems);
  };

  const recalculatePrices = (tier: any, exchangeRate: number = currentExchangeRate) => {
    if (quotationItems.length === 0) return;

    const updatedItems = quotationItems.map((item) => {
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

    setQuotationItems(updatedItems);
  };

  const handleTierChange = (tierId: string) => {
    const tier = pricingTiers?.find((t) => t.id === tierId) || null;
    setSelectedTier(tier);
    setFormData((prev) => ({ ...prev, pricing_tier_id: tierId }));
    recalculatePrices(tier);
  };

  const calculateTotal = () => {
    return quotationItems.reduce((sum, item) => sum + item.item_total, 0);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!companyId) {
      toast.error("No company selected for your profile");
      return;
    }

    if (!user?.id) {
      toast.error("You must be signed in to create a quotation");
      return;
    }

    if (!validUntil) {
      toast.error("Please select a validity date");
      return;
    }

    if (quotationItems.length === 0) {
      toast.error("Please add at least one item");
      return;
    }

    if (quotationItems.some((item) => !item.product_id)) {
      toast.error("Please select a product for all items");
      return;
    }

    setIsSubmitting(true);

    try {
      // Calculate multi-currency totals
      const totalForeign = calculateTotal(); // Total in selected currency
      const totalCompany = totalForeign * currentExchangeRate; // Converted to company base currency

      // Insert quotation with multi-currency fields
      const { data: quotation, error: quotationError } = await supabase
        .from("quotations")
        .insert({
          client_id: formData.client_id || null,
          client_name: formData.client_name,
          email: formData.email,
          phone: formData.phone,
          valid_until: validUntil.toISOString(),
          pricing_tier_id: formData.pricing_tier_id || null,
          notes: formData.notes,
          total_price: totalForeign,
          total_price_foreign: totalForeign,
          total_price_company: totalCompany,
          currency_id: selectedCurrencyId,
          exchange_rate: currentExchangeRate,
          status: "Draft",
          company_id: companyId,
        })
        .select()
        .single();

      if (quotationError) throw quotationError;

      // Insert quotation items
      const itemsToInsert = quotationItems.map((item) => ({
        quotation_id: quotation.id,
        product_id: item.product_id,
        quantity: item.quantity,
        unit_price: item.unit_price,
        item_total: item.item_total,
        company_id: companyId,
      }));

      const { error: itemsError } = await supabase
        .from("quotation_items")
        .insert(itemsToInsert);

      if (itemsError) throw itemsError;

      toast.success("Quotation created successfully!");
      navigate("/quotations");
    } catch (error) {
      console.error("Error creating quotation:", error);
      toast.error("Failed to create quotation. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-3xl font-bold text-foreground">New Quotation</h1>
        <p className="text-muted-foreground">
          Create a price offer that can later be converted into an order.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Quotation Details Card */}
        <Card>
          <CardHeader>
            <CardTitle>Quotation Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Client Selection with Search */}
            <div className="space-y-2">
              <Label>Select Client *</Label>
              <div className="flex gap-2">
                <Popover
                  open={openClientPopover}
                  onOpenChange={setOpenClientPopover}
                >
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      className="flex-1 justify-between"
                    >
                      {selectedClient
                        ? selectedClient.full_name
                        : "Search and select a client..."}
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
                              value={`${client.full_name} ${
                                client.email || ""
                              } ${client.phone || ""}`}
                              onSelect={() => handleClientSelect(client)}
                            >
                              <div className="flex flex-col">
                                <span className="font-medium">
                                  {client.full_name}
                                </span>
                                {client.business_name && (
                                  <span className="text-sm text-muted-foreground">
                                    {client.business_name}
                                  </span>
                                )}
                                <span className="text-xs text-muted-foreground">
                                  {client.email ||
                                    client.phone ||
                                    "No contact info"}
                                </span>
                              </div>
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>

                <Dialog
                  open={isNewClientDialogOpen}
                  onOpenChange={setIsNewClientDialogOpen}
                >
                  <DialogTrigger asChild>
                    <Button type="button" variant="outline" size="icon">
                      <UserPlus className="h-4 w-4" />
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Add New Client</DialogTitle>
                      <DialogDescription>
                        Quickly add a new client to continue with the quotation
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="new_client_name">Full Name *</Label>
                        <Input
                          id="new_client_name"
                          value={newClientForm.full_name}
                          onChange={(e) =>
                            setNewClientForm((prev) => ({
                              ...prev,
                              full_name: e.target.value,
                            }))
                          }
                          placeholder="Enter client name"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="new_client_business">
                          Business Name
                        </Label>
                        <Input
                          id="new_client_business"
                          value={newClientForm.business_name}
                          onChange={(e) =>
                            setNewClientForm((prev) => ({
                              ...prev,
                              business_name: e.target.value,
                            }))
                          }
                          placeholder="Optional"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="new_client_email">Email</Label>
                        <Input
                          id="new_client_email"
                          type="email"
                          value={newClientForm.email}
                          onChange={(e) =>
                            setNewClientForm((prev) => ({
                              ...prev,
                              email: e.target.value,
                            }))
                          }
                          placeholder="client@example.com"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="new_client_phone">Phone</Label>
                        <Input
                          id="new_client_phone"
                          type="tel"
                          value={newClientForm.phone}
                          onChange={(e) =>
                            setNewClientForm((prev) => ({
                              ...prev,
                              phone: e.target.value,
                            }))
                          }
                          placeholder="+971 XX XXX XXXX"
                        />
                      </div>
                    </div>
                    <DialogFooter>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setIsNewClientDialogOpen(false)}
                      >
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
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  value={formData.email}
                  onChange={handleChange}
                  placeholder="client@example.com"
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

            {/* Valid Until Date */}
            <div className="space-y-2">
              <Label>Valid Until *</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !validUntil && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {validUntil ? (
                      format(validUntil, "PPP")
                    ) : (
                      <span>Pick a date</span>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={validUntil}
                    onSelect={(date) => {
                      if (date) {
                        setValidUntil(date);
                      }
                    }}
                    initialFocus
                    className="pointer-events-auto"
                    disabled={(date) => date < new Date()}
                  />
                </PopoverContent>
              </Popover>
            </div>

            {/* Currency */}
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

            {/* Exchange Rate (shown when non-base currency) */}
            {selectedCurrencyId && selectedCurrencyId !== baseCurrencyId && (
              <div className="p-4 border rounded-lg bg-muted/30 space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="text-sm">Exchange Rate</Label>
                  <span className="text-xs text-muted-foreground">
                    1 {selectedCurrencyCode} = {currentExchangeRate.toFixed(4)}{" "}
                    {baseCurrencyCode}
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
          </CardContent>
        </Card>

        {/* Quotation Items Card */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Quotation Items</CardTitle>
            <Button type="button" onClick={addQuotationItem} size="sm">
              <Plus className="mr-2 h-4 w-4" />
              Add Item
            </Button>
          </CardHeader>
          <CardContent className="space-y-4">
            {quotationItems.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">
                No items added. Click &quot;Add Item&quot; to start.
              </p>
            ) : (
              quotationItems.map((item, index) => (
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
                            className="w-full justify-between h-auto min-h-10 whitespace-normal text-left"
                          >
                            {item.product_name || "Select product"}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent
                          className="w-[600px] p-0"
                          align="start"
                        >
                          <Command>
                            <CommandInput placeholder="Search products..." />
                            <CommandList>
                              <CommandEmpty>No products found.</CommandEmpty>
                              <CommandGroup>
                                {products.map((product) => (
                                  <CommandItem
                                    key={product.id}
                                    value={`${product.name_en} ${
                                      product.name_ar
                                    } ${product.product_code ?? ""}`}
                                    onSelect={() =>
                                      updateQuotationItem(index, product)
                                    }
                                    className="h-auto items-start py-3"
                                  >
                                    <div className="flex flex-col w-full gap-1">
                                      <span className="font-medium whitespace-normal leading-snug">
                                        {product.name_en}
                                      </span>
                                      <span className="text-sm text-muted-foreground">
                                        {product.name_ar} -{" "}
                                        {product.product_code}
                                      </span>
                                    </div>
                                  </CommandItem>
                                ))}
                              </CommandGroup>
                            </CommandList>
                          </Command>
                        </PopoverContent>
                      </Popover>
                      {(item.product_code || item.sku) && (
                        <p className="text-xs text-muted-foreground">
                          {item.product_code && `Code: ${item.product_code}`}
                          {item.product_code && item.sku && " • "}
                          {item.sku && `SKU: ${item.sku}`}
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
                          updateQuantity(
                            index,
                            parseInt(e.target.value, 10) || 1
                          )
                        }
                      />
                    </div>

                    {/* Unit Price */}
                    <div className="space-y-2">
                      <Label>Unit Price</Label>
                      <Input
                        type="text"
                        value={formatCurrency(
                          item.unit_price,
                          selectedCurrencyCode
                        )}
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
                          value={formatCurrency(
                            item.item_total,
                            selectedCurrencyCode
                          )}
                          readOnly
                          className="bg-muted"
                        />
                        <Button
                          type="button"
                          variant="destructive"
                          size="icon"
                          onClick={() => removeQuotationItem(index)}
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
            {quotationItems.length > 0 && (
              <div className="flex justify-end pt-4 border-t">
                <div className="text-right space-y-1">
                  <p className="text-sm text-muted-foreground">
                    Total Quotation Amount
                  </p>
                  <p className="text-2xl font-bold text-foreground">
                    {formatCurrency(calculateTotal(), selectedCurrencyCode)}
                  </p>
                  {selectedCurrencyId !== baseCurrencyId && (
                    <p className="text-sm text-muted-foreground">
                      ≈{" "}
                      {formatCurrency(
                        calculateTotal() * currentExchangeRate,
                        baseCurrencyCode
                      )}{" "}
                      (converted)
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
            onClick={() => navigate("/quotations")}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Creating Quotation..." : "Create Quotation"}
          </Button>
        </div>
      </form>
    </div>
  );
};

export default NewQuotation;
