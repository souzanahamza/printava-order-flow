import { useState, useEffect } from "react";
import { useQuery, useQueryClient, keepPreviousData } from "@tanstack/react-query";
import { useUserRole } from "@/hooks/useUserRole";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { toast } from "sonner";
import { Plus, Pencil, Search, History, ChevronLeft, ChevronRight, X, Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { usePricingTiers } from "@/hooks/usePricingTiers";
import { useCurrencies } from "@/hooks/useCurrencies";
import { OrdersList } from "@/components/OrdersList";
import { Skeleton } from "@/components/ui/skeleton";
import { useDebounce } from "@/hooks/useDebounce";

interface Client {
  id: string;
  full_name: string;
  business_name: string | null;
  email: string | null;
  phone: string | null;
  secondary_phone: string | null;
  tax_number: string | null;
  address: string | null;
  city: string | null;
  notes: string | null;
  default_pricing_tier_id: string | null;
  client_type: 'business' | 'individual' | null;
  salutation: string | null;
  first_name: string | null;
  last_name: string | null;
  billing_address_line1: string | null;
  billing_city: string | null;
  billing_state: string | null;
  billing_zip: string | null;
  billing_country: string | null;
  shipping_address_line1: string | null;
  shipping_city: string | null;
  shipping_state: string | null;
  shipping_zip: string | null;
  shipping_country: string | null;
  payment_terms: string | null;
  currency_id: string | null;
}

const Clients = () => {
  const { companyId, role } = useUserRole();
  const { data: pricingTiers } = usePricingTiers();
  const { data: currencies } = useCurrencies();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [viewingClientOrders, setViewingClientOrders] = useState<Client | null>(null);
  const [copyBilling, setCopyBilling] = useState(false);
  const [openPaymentTerms, setOpenPaymentTerms] = useState(false);
  const [paymentTermsSearch, setPaymentTermsSearch] = useState("");
  const paymentTermsOptions = ["Due on Receipt", "Net 15", "Net 30", "Net 45", "Cash"];
  const [formData, setFormData] = useState({
    salutation: "",
    first_name: "",
    last_name: "",
    client_type: "business" as "business" | "individual",
    business_name: "",
    email: "",
    phone: "",
    secondary_phone: "",
    billing_address_line1: "",
    billing_city: "",
    billing_state: "",
    billing_zip: "",
    billing_country: "UAE",
    shipping_address_line1: "",
    shipping_city: "",
    shipping_state: "",
    shipping_zip: "",
    shipping_country: "UAE",
    tax_number: "",
    currency_id: "",
    payment_terms: "Due on Receipt",
    default_pricing_tier_id: "",
    notes: "",
  });

  // Pagination state
  const [page, setPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(20);

  // Debounce search term for performance (500ms delay)
  const debouncedSearchTerm = useDebounce(searchTerm, 500);

  // Reset page to 1 when search term changes
  useEffect(() => {
    setPage(1);
  }, [debouncedSearchTerm]);

  // Check if user has access
  const hasAccess = !!role && ['admin', 'sales', 'accountant'].includes(role);

  // Calculate pagination range
  const from = (page - 1) * itemsPerPage;
  const to = from + itemsPerPage - 1;

  // Fetch clients with server-side pagination
  const {
    data: clientsData,
    isLoading: loading,
    isFetching
  } = useQuery({
    queryKey: ["clients", debouncedSearchTerm, page, itemsPerPage],
    queryFn: async () => {
      const rangeFrom = (page - 1) * itemsPerPage;
      const rangeTo = rangeFrom + itemsPerPage - 1;
      
      let query = supabase
        .from("clients")
        .select("*", { count: "exact" })
        .order("full_name");

      // Apply search filter if search term exists
      if (debouncedSearchTerm.trim()) {
        const term = debouncedSearchTerm.trim();
        query = query.or(
          `full_name.ilike.%${term}%,business_name.ilike.%${term}%,email.ilike.%${term}%,phone.ilike.%${term}%,city.ilike.%${term}%`
        );
      }

      // Apply pagination range
      query = query.range(rangeFrom, rangeTo);

      const { data, error, count } = await query;

      if (error) throw error;
      return {
        clients: (data || []) as unknown as Client[],
        totalCount: count || 0,
      };
    },
    placeholderData: keepPreviousData,
    enabled: hasAccess,
  });

  const clients = clientsData?.clients || [];
  const totalCount = clientsData?.totalCount || 0;
  const totalPages = Math.ceil(totalCount / itemsPerPage);

  const handlePageChange = (newPage: number) => {
    if (newPage >= 1 && newPage <= totalPages) {
      setPage(newPage);
    }
  };

  const handleItemsPerPageChange = (value: string) => {
    setItemsPerPage(Number(value));
    setPage(1); // Reset to first page when changing items per page
  };

  const refreshClients = () => {
    queryClient.invalidateQueries({ queryKey: ["clients"] });
  };

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => {
      const newData = { ...prev, [name]: value };
      
      // If copyBilling is true and we're editing a billing field, update shipping field
      if (copyBilling && name.startsWith("billing_")) {
        const shippingField = name.replace("billing_", "shipping_");
        // @ts-ignore
        newData[shippingField] = value;
      }
      
      return newData;
    });
  };
  
  const handleSelectChange = (name: string, value: string) => {
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleCopyBillingChange = (checked: boolean) => {
    setCopyBilling(checked);
    if (checked) {
      setFormData((prev) => ({
        ...prev,
        shipping_address_line1: prev.billing_address_line1,
        shipping_city: prev.billing_city,
        shipping_state: prev.billing_state,
        shipping_zip: prev.billing_zip,
        shipping_country: prev.billing_country,
      }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!companyId) {
      toast.error("Company ID not found");
      return;
    }

    try {
      // Construct full_name
      const full_name = `${formData.first_name} ${formData.last_name}`.trim();
      
      const clientData = {
        company_id: companyId,
        full_name: full_name || formData.business_name || "Unknown Client",
        
        client_type: formData.client_type,
        salutation: formData.salutation || null,
        first_name: formData.first_name || null,
        last_name: formData.last_name || null,
        business_name: formData.client_type === 'business' ? (formData.business_name || null) : null,
        
        email: formData.email || null,
        phone: formData.phone || null,
        secondary_phone: formData.secondary_phone || null,
        
        // Address mapping
        billing_address_line1: formData.billing_address_line1 || null,
        billing_city: formData.billing_city || null,
        billing_state: formData.billing_state || null,
        billing_zip: formData.billing_zip || null,
        billing_country: formData.billing_country || null,
        
        shipping_address_line1: formData.shipping_address_line1 || null,
        shipping_city: formData.shipping_city || null,
        shipping_state: formData.shipping_state || null,
        shipping_zip: formData.shipping_zip || null,
        shipping_country: formData.shipping_country || null,

        // Legacy mapping
        address: formData.billing_address_line1 || null,
        city: formData.billing_city || null,
        
        tax_number: formData.tax_number || null,
        currency_id: formData.currency_id || null,
        payment_terms: formData.payment_terms || null,
        default_pricing_tier_id: formData.default_pricing_tier_id || null,
        notes: formData.notes || null,
      };

      if (editingClient) {
        const { error } = await supabase
          .from("clients")
          .update(clientData)
          .eq("id", editingClient.id);

        if (error) throw error;
        toast.success("Client updated successfully");
      } else {
        const { error } = await supabase
          .from("clients")
          .insert([clientData]);

        if (error) throw error;
        toast.success("Client created successfully");
      }

      setIsDialogOpen(false);
      resetForm();
      refreshClients();
    } catch (error) {
      console.error("Error saving client:", error);
      toast.error("Failed to save client");
    }
  };

  const resetForm = () => {
    setFormData({
      salutation: "",
      first_name: "",
      last_name: "",
      client_type: "business",
      business_name: "",
      email: "",
      phone: "",
      secondary_phone: "",
      billing_address_line1: "",
      billing_city: "",
      billing_state: "",
      billing_zip: "",
      billing_country: "UAE",
      shipping_address_line1: "",
      shipping_city: "",
      shipping_state: "",
      shipping_zip: "",
      shipping_country: "UAE",
      tax_number: "",
      currency_id: "",
      payment_terms: "Due on Receipt",
      default_pricing_tier_id: "",
      notes: "",
    });
    setCopyBilling(false);
    setEditingClient(null);
    setPaymentTermsSearch("");
  };

  const handleEdit = (client: Client) => {
    setEditingClient(client);
    
    // Logic for splitting name if first/last not present
    let firstName = client.first_name || "";
    let lastName = client.last_name || "";
    
    if (!firstName && !lastName && client.full_name) {
      const parts = client.full_name.split(" ");
      if (parts.length > 0) {
        firstName = parts[0];
        lastName = parts.slice(1).join(" ");
      }
    }
    
    setFormData({
      salutation: client.salutation || "",
      first_name: firstName,
      last_name: lastName,
      client_type: (client.client_type as "business" | "individual") || "business",
      business_name: client.business_name || "",
      email: client.email || "",
      phone: client.phone || "",
      secondary_phone: client.secondary_phone || "",
      billing_address_line1: client.billing_address_line1 || client.address || "",
      billing_city: client.billing_city || client.city || "",
      billing_state: client.billing_state || "",
      billing_zip: client.billing_zip || "",
      billing_country: client.billing_country || "UAE",
      shipping_address_line1: client.shipping_address_line1 || "",
      shipping_city: client.shipping_city || "",
      shipping_state: client.shipping_state || "",
      shipping_zip: client.shipping_zip || "",
      shipping_country: client.shipping_country || "UAE",
      tax_number: client.tax_number || "",
      currency_id: client.currency_id || "",
      payment_terms: client.payment_terms || "Due on Receipt",
      default_pricing_tier_id: client.default_pricing_tier_id || "",
      notes: client.notes || "",
    });
    setCopyBilling(false);
    setPaymentTermsSearch("");
    setIsDialogOpen(true);
  };

  // Show loading while checking access
  if (role === undefined || role === null) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!hasAccess) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <p className="text-muted-foreground">You don't have access to this page</p>
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6 p-4 sm:p-0">
      {/* Header Section - Responsive */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground">Clients</h1>
          <p className="text-sm sm:text-base text-muted-foreground">Manage your client database</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={(open) => {
          setIsDialogOpen(open);
          if (!open) resetForm();
        }}>
          <DialogTrigger asChild>
            <Button className="w-full sm:w-auto">
              <Plus className="mr-2 h-4 w-4" />
              Add Client
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingClient ? "Edit Client" : "Add New Client"}</DialogTitle>
              <DialogDescription>
                {editingClient ? "Update client information" : "Enter client details below"}
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-6">
              
              {/* Header Section: Client Type & Name */}
              <div className="space-y-4 border-b pb-4">
                <div className="space-y-2">
                  <Label>Client Type</Label>
                  <RadioGroup 
                    value={formData.client_type} 
                    onValueChange={(val: "business" | "individual") => handleSelectChange("client_type", val)}
                    className="flex flex-row space-x-4"
                  >
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="business" id="type-business" />
                      <Label htmlFor="type-business">Business</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="individual" id="type-individual" />
                      <Label htmlFor="type-individual">Individual</Label>
                    </div>
                  </RadioGroup>
                </div>

                <div className="grid gap-4 sm:grid-cols-12">
                  <div className="sm:col-span-2">
                    <Label htmlFor="salutation">Salutation</Label>
                    <Select
                      value={formData.salutation}
                      onValueChange={(val) => handleSelectChange("salutation", val)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Mr/Ms" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Mr.">Mr.</SelectItem>
                        <SelectItem value="Mrs.">Mrs.</SelectItem>
                        <SelectItem value="Ms.">Ms.</SelectItem>
                        <SelectItem value="Dr.">Dr.</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="sm:col-span-5">
                    <Label htmlFor="first_name">First Name *</Label>
                    <Input
                      id="first_name"
                      name="first_name"
                      value={formData.first_name}
                      onChange={handleChange}
                      required
                    />
                  </div>
                  <div className="sm:col-span-5">
                    <Label htmlFor="last_name">Last Name *</Label>
                    <Input
                      id="last_name"
                      name="last_name"
                      value={formData.last_name}
                      onChange={handleChange}
                      required
                    />
                  </div>
                </div>
              </div>

              {/* Tabs Section */}
              <Tabs defaultValue="general" className="w-full">
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="general">General Info</TabsTrigger>
                  <TabsTrigger value="address">Address</TabsTrigger>
                  <TabsTrigger value="financial">Financial</TabsTrigger>
                </TabsList>
                
                {/* Tab 1: General Info */}
                <TabsContent value="general" className="space-y-4 py-4">
                  {formData.client_type === 'business' && (
                    <div className="space-y-2">
                      <Label htmlFor="business_name">Business Name</Label>
                      <Input
                        id="business_name"
                        name="business_name"
                        value={formData.business_name}
                        onChange={handleChange}
                      />
                    </div>
                  )}
                  
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="email">Email</Label>
                      <Input
                        id="email"
                        name="email"
                        type="email"
                        value={formData.email}
                        onChange={handleChange}
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
                      />
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="secondary_phone">Secondary Phone</Label>
                    <Input
                      id="secondary_phone"
                      name="secondary_phone"
                      type="tel"
                      value={formData.secondary_phone}
                      onChange={handleChange}
                    />
                  </div>
                </TabsContent>
                
                {/* Tab 2: Address Details */}
                <TabsContent value="address" className="space-y-4 py-4">
                  <div className="grid gap-6 md:grid-cols-2">
                    {/* Left Column: Billing Address */}
                    <div className="space-y-4">
                      <h3 className="font-semibold text-sm text-muted-foreground border-b pb-2">Billing Address</h3>
                      
                      <div className="space-y-2">
                        <Label htmlFor="billing_address_line1">Address Line 1</Label>
                        <Input
                          id="billing_address_line1"
                          name="billing_address_line1"
                          value={formData.billing_address_line1}
                          onChange={handleChange}
                        />
                      </div>
                      
                      <div className="grid gap-4 sm:grid-cols-2">
                        <div className="space-y-2">
                          <Label htmlFor="billing_city">City</Label>
                          <Input
                            id="billing_city"
                            name="billing_city"
                            value={formData.billing_city}
                            onChange={handleChange}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="billing_state">State</Label>
                          <Input
                            id="billing_state"
                            name="billing_state"
                            value={formData.billing_state}
                            onChange={handleChange}
                          />
                        </div>
                      </div>
                      
                      <div className="grid gap-4 sm:grid-cols-2">
                        <div className="space-y-2">
                          <Label htmlFor="billing_zip">Zip Code</Label>
                          <Input
                            id="billing_zip"
                            name="billing_zip"
                            value={formData.billing_zip}
                            onChange={handleChange}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="billing_country">Country</Label>
                          <Input
                            id="billing_country"
                            name="billing_country"
                            value={formData.billing_country}
                            onChange={handleChange}
                          />
                        </div>
                      </div>
                    </div>

                    {/* Right Column: Shipping Address */}
                    <div className="space-y-4">
                      <div className="flex items-center justify-between border-b pb-2">
                        <h3 className="font-semibold text-sm text-muted-foreground">Shipping Address</h3>
                        <div className="flex items-center space-x-2">
                          <Checkbox 
                            id="copy_billing" 
                            checked={copyBilling}
                            onCheckedChange={handleCopyBillingChange}
                          />
                          <Label 
                            htmlFor="copy_billing" 
                            className="text-xs font-normal cursor-pointer"
                          >
                            Same as Billing
                          </Label>
                        </div>
                      </div>
                      
                      <div className="space-y-2">
                        <Label htmlFor="shipping_address_line1">Address Line 1</Label>
                        <Input
                          id="shipping_address_line1"
                          name="shipping_address_line1"
                          value={formData.shipping_address_line1}
                          onChange={handleChange}
                          disabled={copyBilling}
                        />
                      </div>
                      
                      <div className="grid gap-4 sm:grid-cols-2">
                        <div className="space-y-2">
                          <Label htmlFor="shipping_city">City</Label>
                          <Input
                            id="shipping_city"
                            name="shipping_city"
                            value={formData.shipping_city}
                            onChange={handleChange}
                            disabled={copyBilling}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="shipping_state">State</Label>
                          <Input
                            id="shipping_state"
                            name="shipping_state"
                            value={formData.shipping_state}
                            onChange={handleChange}
                            disabled={copyBilling}
                          />
                        </div>
                      </div>
                      
                      <div className="grid gap-4 sm:grid-cols-2">
                        <div className="space-y-2">
                          <Label htmlFor="shipping_zip">Zip Code</Label>
                          <Input
                            id="shipping_zip"
                            name="shipping_zip"
                            value={formData.shipping_zip}
                            onChange={handleChange}
                            disabled={copyBilling}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="shipping_country">Country</Label>
                          <Input
                            id="shipping_country"
                            name="shipping_country"
                            value={formData.shipping_country}
                            onChange={handleChange}
                            disabled={copyBilling}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </TabsContent>
                
                {/* Tab 3: Financial & Settings */}
                <TabsContent value="financial" className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="tax_number">Tax ID / TRN</Label>
                    <Input
                      id="tax_number"
                      name="tax_number"
                      value={formData.tax_number}
                      onChange={handleChange}
                    />
                  </div>
                  
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="currency_id">Currency</Label>
                      <Select
                        value={formData.currency_id}
                        onValueChange={(val) => handleSelectChange("currency_id", val)}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select Currency" />
                        </SelectTrigger>
                        <SelectContent>
                          {(currencies || []).map((curr) => (
                            <SelectItem key={curr.id} value={curr.id}>
                              {curr.code} - {curr.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    
                    <div className="space-y-2 flex flex-col">
                      <Label htmlFor="payment_terms" className="mb-1">Payment Terms</Label>
                      <Popover open={openPaymentTerms} onOpenChange={setOpenPaymentTerms}>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            role="combobox"
                            aria-expanded={openPaymentTerms}
                            className="w-full justify-between font-normal"
                          >
                            {formData.payment_terms || "Select terms"}
                            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-full p-0" align="start">
                          <Command>
                            <CommandInput 
                              placeholder="Search or enter custom terms..." 
                              value={paymentTermsSearch}
                              onValueChange={setPaymentTermsSearch}
                            />
                            <CommandList>
                              <CommandEmpty>No terms found.</CommandEmpty>
                              <CommandGroup>
                                {paymentTermsOptions.map((term) => (
                                  <CommandItem
                                    key={term}
                                    value={term}
                                    onSelect={() => {
                                      handleSelectChange("payment_terms", term);
                                      setOpenPaymentTerms(false);
                                    }}
                                  >
                                    <Check
                                      className={cn(
                                        "mr-2 h-4 w-4",
                                        formData.payment_terms === term ? "opacity-100" : "opacity-0"
                                      )}
                                    />
                                    {term}
                                  </CommandItem>
                                ))}
                                {paymentTermsSearch && !paymentTermsOptions.some(opt => opt.toLowerCase() === paymentTermsSearch.toLowerCase()) && (
                                  <CommandItem
                                    value={paymentTermsSearch}
                                    onSelect={() => {
                                      handleSelectChange("payment_terms", paymentTermsSearch);
                                      setOpenPaymentTerms(false);
                                    }}
                                  >
                                    <Plus className="mr-2 h-4 w-4" />
                                    Create "{paymentTermsSearch}"
                                  </CommandItem>
                                )}
                              </CommandGroup>
                            </CommandList>
                          </Command>
                        </PopoverContent>
                      </Popover>
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="default_pricing_tier_id">Default Pricing Tier</Label>
                    <Select
                      value={formData.default_pricing_tier_id}
                      onValueChange={(value) =>
                        handleSelectChange("default_pricing_tier_id", value)
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="None (Optional)" />
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
                  
                  <div className="space-y-2">
                    <Label htmlFor="notes">Notes</Label>
                    <Textarea
                      id="notes"
                      name="notes"
                      value={formData.notes}
                      onChange={handleChange}
                      rows={3}
                    />
                  </div>
                </TabsContent>
              </Tabs>

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit">
                  {editingClient ? "Update Client" : "Add Client"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Search and Content Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search clients..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 pr-10"
              />
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => setSearchTerm("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <>
              {/* Mobile Card View Loading */}
              <div className="md:hidden space-y-4">
                {[...Array(3)].map((_, i) => (
                  <Card key={i} className="bg-background/60 backdrop-blur border-2">
                    <CardContent className="pt-6">
                      <div className="space-y-3">
                        <div className="flex items-start justify-between">
                          <div className="flex-1 space-y-2">
                            <Skeleton className="h-6 w-3/4" />
                            <Skeleton className="h-4 w-1/2" />
                          </div>
                          <div className="flex gap-1 ml-2">
                            <Skeleton className="h-8 w-8 rounded-md" />
                            <Skeleton className="h-8 w-8 rounded-md" />
                          </div>
                        </div>
                        <div className="space-y-2">
                          <Skeleton className="h-4 w-full" />
                          <Skeleton className="h-4 w-5/6" />
                          <Skeleton className="h-4 w-4/6" />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>

              {/* Desktop Table View Loading */}
              <div className="hidden md:block overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Business Name</TableHead>
                      <TableHead>Phone</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>City</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {[...Array(5)].map((_, i) => (
                      <TableRow key={i}>
                        <TableCell>
                          <Skeleton className="h-5 w-32" />
                        </TableCell>
                        <TableCell>
                          <Skeleton className="h-5 w-28" />
                        </TableCell>
                        <TableCell>
                          <Skeleton className="h-5 w-24" />
                        </TableCell>
                        <TableCell>
                          <Skeleton className="h-5 w-36" />
                        </TableCell>
                        <TableCell>
                          <Skeleton className="h-5 w-20" />
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex gap-2 justify-end">
                            <Skeleton className="h-9 w-9 rounded-md" />
                            <Skeleton className="h-9 w-9 rounded-md" />
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </>
          ) : clients.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-muted-foreground">
                {debouncedSearchTerm ? "No clients found matching your search" : "No clients yet. Add your first client!"}
              </p>
              {debouncedSearchTerm && (
                <Button 
                  variant="outline" 
                  className="mt-4"
                  onClick={() => setSearchTerm("")}
                >
                  <X className="h-4 w-4 mr-2" />
                  Clear Search
                </Button>
              )}
            </div>
          ) : (
            <>
              {/* Loading indicator for fetching */}
              {isFetching && !loading && (
                <div className="text-center py-2 text-sm text-muted-foreground">
                  Loading...
                </div>
              )}
              
              {/* Mobile Card View */}
              <div className="md:hidden space-y-4">
                {clients.map((client) => (
                  <Card key={client.id} className="border-2">
                    <CardContent className="pt-6">
                      <div className="space-y-3">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <h3 className="font-semibold text-lg">{client.full_name}</h3>
                            {client.business_name && (
                              <p className="text-sm text-muted-foreground">{client.business_name}</p>
                            )}
                          </div>
                          <div className="flex gap-1 ml-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setViewingClientOrders(client)}
                              className="h-8 w-8 p-0"
                            >
                              <History className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleEdit(client)}
                              className="h-8 w-8 p-0"
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>

                        <div className="space-y-2 text-sm">
                          {client.phone && (
                            <div className="flex items-center gap-2">
                              <span className="text-muted-foreground min-w-[60px]">Phone:</span>
                              <span className="font-medium">{client.phone}</span>
                            </div>
                          )}
                          {client.email && (
                            <div className="flex items-center gap-2">
                              <span className="text-muted-foreground min-w-[60px]">Email:</span>
                              <span className="font-medium truncate">{client.email}</span>
                            </div>
                          )}
                          {client.city && (
                            <div className="flex items-center gap-2">
                              <span className="text-muted-foreground min-w-[60px]">City:</span>
                              <span className="font-medium">{client.city}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>

              {/* Desktop Table View */}
              <div className="hidden md:block overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Business Name</TableHead>
                      <TableHead>Phone</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>City</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {clients.map((client) => (
                      <TableRow key={client.id}>
                        <TableCell className="font-medium">{client.full_name}</TableCell>
                        <TableCell>{client.business_name || "-"}</TableCell>
                        <TableCell>{client.phone || "-"}</TableCell>
                        <TableCell>{client.email || "-"}</TableCell>
                        <TableCell>{client.city || "-"}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex gap-2 justify-end">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setViewingClientOrders(client)}
                            >
                              <History className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleEdit(client)}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </>
          )}
        </CardContent>
        
        {/* Pagination Controls - only show when there are clients */}
        {clients.length > 0 && (
          <CardFooter className="flex flex-col sm:flex-row items-center justify-between gap-4 py-4 px-6 border-t">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span>Showing {from + 1}-{Math.min(to + 1, totalCount)} of {totalCount} clients</span>
            </div>
            
            <div className="flex items-center gap-4">
              {/* Rows per page selector */}
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">Rows per page:</span>
                <Select value={String(itemsPerPage)} onValueChange={handleItemsPerPageChange}>
                  <SelectTrigger className="w-[70px] h-8">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="10">10</SelectItem>
                    <SelectItem value="20">20</SelectItem>
                    <SelectItem value="50">50</SelectItem>
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
        )}
      </Card>

      {/* Client Order History Dialog */}
      <Dialog open={!!viewingClientOrders} onOpenChange={(open) => !open && setViewingClientOrders(null)}>
        <DialogContent className="max-w-[95vw] sm:max-w-6xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Order History - {viewingClientOrders?.full_name}</DialogTitle>
            <DialogDescription>
              View all orders for this client
            </DialogDescription>
          </DialogHeader>
          {viewingClientOrders && (
            <OrdersList clientId={viewingClientOrders.id} hideFilters />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Clients;