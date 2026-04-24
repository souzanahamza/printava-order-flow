import { useState, useEffect, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
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
import { generateSmartFileName, type FileType } from "@/hooks/useOrderFileUpload";
import { usePricingTiers } from "@/hooks/usePricingTiers";
import { useCompanyCurrency, useExchangeRates, useCurrencies } from "@/hooks/useCurrencies";
import {
  CalendarIcon,
  Plus,
  Trash2,
  Upload,
  UserPlus,
  CheckCircle2,
  XCircle,
  Loader2,
  Paperclip,
  Info,
} from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/utils/formatCurrency";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { OrderAttachment } from "@/features/orders/types";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

interface Product {
  id: string;
  name_ar: string;
  name_en: string;
  product_code: string;
  sku: string | null;
  unit_price: number;
}

interface OrderItem {
  id?: string;
  product_id: string;
  product_name: string;
  product_code: string;
  sku?: string;
  quantity: number;
  unit_price: number;
  item_total: number;
  description?: string;
  isManualPrice?: boolean;
  /** Per line item: drives DB `order_items.needs_design` and auto-created `order_tasks`. */
  needs_design: boolean;
  /** Files to upload on submit, linked to this line’s `order_item_id`. */
  selectedFiles: File[];
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

interface UploadedFile {
  tempId: string;
  fileName: string;
  fileUrl: string;
  fileSize: number;
  status: 'uploading' | 'success' | 'error';
  error?: string;
}

export interface EditOrderHydrationData {
  id: string;
  status: string;
  client_id: string | null;
  client_name: string;
  email: string | null;
  phone: string | null;
  delivery_date: string | null;
  delivery_method: string | null;
  pricing_tier_id: string | null;
  notes: string | null;
  currency_id: string | null;
  exchange_rate: number | null;
  order_items: Array<{
    id: string;
    product_id: string;
    quantity: number;
    unit_price: number;
    item_total: number;
    description: string | null;
    needs_design: boolean | null;
    product?: {
      name_en: string;
      name_ar: string;
      product_code: string | null;
      sku: string | null;
    } | null;
  }>;
  order_attachments: OrderAttachment[];
}

interface OrderFormProps {
  mode: "create" | "edit";
  initialData?: EditOrderHydrationData;
}

export function OrderForm({ mode, initialData }: OrderFormProps) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const fromQuotationId = mode === "create" ? searchParams.get("fromQuotation") : null;
  const fromOrderId = mode === "create" ? searchParams.get("fromOrder") : null;
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
  const [deliveryTime, setDeliveryTime] = useState<string>("12:00"); // e.g., "14:30"
  const [products, setProducts] = useState<Product[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [selectedTier, setSelectedTier] = useState<any>(null);
  const [orderItems, setOrderItems] = useState<OrderItem[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [openProductPopover, setOpenProductPopover] = useState<number | null>(null);
  const [openClientPopover, setOpenClientPopover] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [filesToCopy, setFilesToCopy] = useState<OrderAttachment[]>([]);
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
  const [hasPrefilledFromQuotation, setHasPrefilledFromQuotation] = useState(false);
  const [hasPrefilledFromOrder, setHasPrefilledFromOrder] = useState(false);
  const originalOrderItemsRef = useRef<OrderItem[]>([]);
  const canEditFiles = true;

  // Initialize selected currency to base currency when loaded
  useEffect(() => {
    if (baseCurrencyId && !selectedCurrencyId) {
      setSelectedCurrencyId(baseCurrencyId);
      setCurrentExchangeRate(1);
    }
  }, [baseCurrencyId, selectedCurrencyId]);

  const clientNameForUpload = formData.client_name || selectedClient?.full_name || "Client";

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

  useEffect(() => {
    if (mode !== "edit" || !initialData) return;

    const mappedItems: OrderItem[] = (initialData.order_items || []).map((item) => ({
      id: item.id,
      product_id: item.product_id,
      product_name: item.product ? `${item.product.name_en} (${item.product.name_ar})` : "",
      product_code: item.product?.product_code || "",
      sku: item.product?.sku || "",
      quantity: item.quantity,
      unit_price: item.unit_price,
      item_total: item.item_total,
      description: item.description || "",
      isManualPrice: true,
      needs_design: item.needs_design !== false,
      selectedFiles: [],
    }));

    setFormData((prev) => ({
      ...prev,
      client_id: initialData.client_id || "",
      client_name: initialData.client_name || "",
      email: initialData.email || "",
      phone: initialData.phone || "",
      delivery_method: initialData.delivery_method || "",
      pricing_tier_id: initialData.pricing_tier_id || "",
      notes: initialData.notes || "",
    }));

    if (initialData.delivery_date) {
      const date = new Date(initialData.delivery_date);
      setDeliveryDate(date);
      setDeliveryTime(`${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`);
    }
    if (initialData.currency_id) {
      setSelectedCurrencyId(initialData.currency_id);
    }
    if (initialData.exchange_rate) {
      setCurrentExchangeRate(initialData.exchange_rate);
      setIsManualRate(true);
    }

    setOrderItems(mappedItems);
    originalOrderItemsRef.current = mappedItems;
    setFilesToCopy(initialData.order_attachments || []);
  }, [mode, initialData]);

  useEffect(() => {
    if (mode !== "edit" || !initialData?.client_id || clients.length === 0) return;
    const hydratedClient = clients.find((client) => client.id === initialData.client_id);
    if (hydratedClient) {
      setSelectedClient(hydratedClient);
    }
  }, [mode, initialData?.client_id, clients]);

  // Prefill from quotation if query param is present
  useEffect(() => {
    const prefillFromQuotation = async () => {
      if (mode !== "create" || !fromQuotationId || hasPrefilledFromQuotation || !companyId) return;

      try {
        const { data: quotation, error } = await supabase
          .from("quotations")
          .select(
            `
            *,
            quotation_items(
              id,
              product_id,
              quantity,
              unit_price,
              item_total,
              description,
              product:products(
                name_en,
                name_ar,
                product_code,
                sku
              )
            )
          `
          )
          .eq("id", fromQuotationId)
          .single();

        if (error || !quotation) {
          console.error("Error fetching quotation for prefill:", error);
          toast.error("Failed to load quotation data");
          return;
        }

        // Prefill client details
        if (quotation.client_id) {
          const existingClient = clients.find((c) => c.id === quotation.client_id);
          let clientToUse = existingClient;

          if (!clientToUse) {
            const { data: clientData } = await supabase
              .from("clients")
              .select("*")
              .eq("id", quotation.client_id)
              .single();
            if (clientData) {
              clientToUse = clientData as Client;
              setClients((prev) => [...prev, clientData as Client]);
            }
          }

          if (clientToUse) {
            setSelectedClient(clientToUse);
          }
        }

        setFormData((prev) => ({
          ...prev,
          client_id: quotation.client_id || prev.client_id,
          client_name: quotation.client_name || prev.client_name,
          email: quotation.email || prev.email,
          phone: quotation.phone || prev.phone,
          pricing_tier_id: quotation.pricing_tier_id || prev.pricing_tier_id,
          notes: `${prev.notes ? prev.notes + "\n" : ""}Converted from Quotation #${quotation.id.slice(
            0,
            8
          )}`,
        }));

        // Prefill currency
        if (quotation.currency_id) {
          setSelectedCurrencyId(quotation.currency_id);
        }
        if (quotation.exchange_rate) {
          setCurrentExchangeRate(quotation.exchange_rate);
          setIsManualRate(true);
        }

        // Prefill delivery date
        if (quotation.delivery_date) {
          setDeliveryDate(new Date(quotation.delivery_date));
        }

        // Prefill items
        if (quotation.quotation_items && quotation.quotation_items.length > 0) {
          const mappedItems: OrderItem[] = quotation.quotation_items.map((item: any) => ({
            product_id: item.product_id,
            product_name: item.product
              ? `${item.product.name_en} (${item.product.name_ar})`
              : "",
            product_code: item.product?.product_code || "",
            sku: item.product?.sku || "",
            quantity: item.quantity,
            unit_price: item.unit_price,
            item_total: item.item_total,
            description: item.description || "",
            isManualPrice: false,
            needs_design: true,
            selectedFiles: [],
          }));
          setOrderItems(mappedItems);
        }

        setHasPrefilledFromQuotation(true);
      } catch (err) {
        console.error("Unexpected error pre-filling from quotation:", err);
        toast.error("Failed to pre-fill order from quotation");
      }
    };

    void prefillFromQuotation();
  }, [mode, fromQuotationId, companyId, hasPrefilledFromQuotation, clients]);

  // Prefill from order if query param is present
  useEffect(() => {
    const prefillFromOrder = async () => {
      if (mode !== "create" || !fromOrderId || hasPrefilledFromOrder || !companyId) return;

      try {
        const { data: order, error } = await supabase
          .from("orders")
          .select(
            `
            *,
            order_items(
              id,
              product_id,
              quantity,
              unit_price,
              item_total,
              description,
              needs_design,
              product:products(
                name_en,
                name_ar,
                product_code,
                sku
              )
            )
          `
          )
          .eq("id", fromOrderId)
          .single();

        if (error || !order) {
          console.error("Error fetching order for prefill:", error);
          toast.error("Failed to load order data");
          return;
        }

        // Prefill client details
        if (order.client_id) {
          const existingClient = clients.find((c) => c.id === order.client_id);
          let clientToUse = existingClient;

          if (!clientToUse) {
            const { data: clientData } = await supabase
              .from("clients")
              .select("*")
              .eq("id", order.client_id)
              .single();
            if (clientData) {
              clientToUse = clientData as Client;
              setClients((prev) => [...prev, clientData as Client]);
            }
          }

          if (clientToUse) {
            setSelectedClient(clientToUse);
          }
        }

        setFormData((prev) => ({
          ...prev,
          client_id: order.client_id || prev.client_id,
          client_name: order.client_name || prev.client_name,
          email: order.email || prev.email,
          phone: order.phone || prev.phone,
          pricing_tier_id: order.pricing_tier_id || prev.pricing_tier_id,
          delivery_method: order.delivery_method || prev.delivery_method,
          notes: `Reorder of Order ${order.order_number != null ? `#${String(order.order_number).padStart(4, '0')}` : `#${order.id.slice(0, 8)}`}`,
        }));

        // Prefill currency
        if (order.currency_id) {
          setSelectedCurrencyId(order.currency_id);
        }
        if (order.exchange_rate) {
          setCurrentExchangeRate(order.exchange_rate);
          setIsManualRate(true);
        }

        // Prefill items
        if (order.order_items && order.order_items.length > 0) {
          const mappedItems: OrderItem[] = order.order_items.map((item: any) => ({
            product_id: item.product_id,
            product_name: item.product
              ? `${item.product.name_en} (${item.product.name_ar})`
              : "",
            product_code: item.product?.product_code || "",
            sku: item.product?.sku || "",
            quantity: item.quantity,
            unit_price: item.unit_price,
            item_total: item.item_total,
            description: item.description || "",
            isManualPrice: false,
            needs_design: item.needs_design !== false,
            selectedFiles: [],
          }));
          setOrderItems(mappedItems);
        }

        // Fetch order attachments
        const { data: attachments, error: attachmentsError } = await supabase
          .from("order_attachments")
          .select("*")
          .eq("order_id", fromOrderId)
          .order("created_at", { ascending: false });

        if (attachmentsError) {
          console.error("Error fetching attachments:", attachmentsError);
        } else if (attachments) {
          setFilesToCopy(attachments as OrderAttachment[]);
        }

        // Reset delivery date and files
        setDeliveryDate(undefined);
        setUploadedFiles([]);

        setHasPrefilledFromOrder(true);
      } catch (err) {
        console.error("Unexpected error pre-filling from order:", err);
        toast.error("Failed to pre-fill order from previous order");
      }
    };

    void prefillFromOrder();
  }, [mode, fromOrderId, companyId, hasPrefilledFromOrder, clients]);

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

      if (item.isManualPrice) {
        return {
          ...item,
          item_total: item.unit_price * item.quantity,
        };
      }

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
    const defaultNeedsDesign =
      orderItems.length === 0 ? false : orderItems.every((i) => i.needs_design);
    setOrderItems([
      ...orderItems,
      {
        product_id: "",
        product_name: "",
        product_code: "",
        sku: "",
        quantity: 1,
        unit_price: 0,
        item_total: 0,
        description: "",
        isManualPrice: false,
        needs_design: defaultNeedsDesign,
        selectedFiles: [],
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
    const existing = updatedItems[index];
    updatedItems[index] = {
      product_id: product.id,
      product_name: `${product.name_en} (${product.name_ar})`,
      product_code: product.product_code,
      sku: product.sku || "",
      quantity,
      unit_price: unitPrice,
      item_total: unitPrice * quantity,
      description: existing?.description || "",
      isManualPrice: false,
      needs_design: existing?.needs_design ?? true,
      selectedFiles: existing?.selectedFiles ?? [],
    };
    setOrderItems(updatedItems);
    setOpenProductPopover(null);
  };

  const updateQuantity = (index: number, quantity: number) => {
    if (quantity < 1) return;

    const updatedItems = [...orderItems];
    const item = updatedItems[index];
    if (!item) return;
    item.quantity = quantity;
    item.item_total = item.unit_price * quantity;
    setOrderItems(updatedItems);
  };

  const updateUnitPrice = (index: number, value: string) => {
    const parsed = parseFloat(value);
    const unitPrice = isNaN(parsed) ? 0 : parsed;

    const updatedItems = [...orderItems];
    const item = updatedItems[index];
    if (!item) return;

    item.unit_price = unitPrice;
    item.item_total = unitPrice * item.quantity;
    item.isManualPrice = true;

    setOrderItems(updatedItems);
  };

  const recalculatePrices = (tier: any, exchangeRate: number = currentExchangeRate) => {
    if (orderItems.length === 0) return;

    const updatedItems = orderItems.map((item) => {
      const product = products.find((p) => p.id === item.product_id);
      if (!product) return item;

      if (item.isManualPrice) {
        return {
          ...item,
          item_total: item.unit_price * item.quantity,
        };
      }

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

  /** Stage general order assets in `pending/` until the order exists; linked on submit with `order_item_id: null`. */
  const uploadPendingGlobalFiles = async (files: File[]) => {
    if (files.length === 0) return;
    if (!companyId || !user?.id) {
      toast.error("Please ensure you're logged in before uploading files");
      return;
    }

    for (const file of files) {
      const tempId = `temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      setUploadedFiles((prev) => [
        ...prev,
        {
          tempId,
          fileName: file.name,
          fileUrl: "",
          fileSize: file.size,
          status: "uploading",
        },
      ]);

      try {
        const fileExt = file.name.split(".").pop()?.toLowerCase() || "file";
        const sanitizedClientName = (clientNameForUpload || "Order")
          .replace(/[^a-zA-Z0-9\s]/g, "")
          .replace(/\s+/g, "_")
          .substring(0, 30) || "Order";
        const storagePath = `${companyId}/pending/${tempId}_${sanitizedClientName}.${fileExt}`;

        const { error: uploadError } = await supabase.storage
          .from("order-files")
          .upload(storagePath, file);

        if (uploadError) throw uploadError;

        const {
          data: { publicUrl },
        } = supabase.storage.from("order-files").getPublicUrl(storagePath);

        setUploadedFiles((prev) =>
          prev.map((f) =>
            f.tempId === tempId ? { ...f, fileUrl: publicUrl, status: "success" as const } : f
          )
        );

        toast.success(`${file.name} uploaded`);
      } catch (error) {
        console.error("File upload error:", error);
        setUploadedFiles((prev) =>
          prev.map((f) =>
            f.tempId === tempId
              ? { ...f, status: "error" as const, error: (error as Error).message }
              : f
          )
        );
        toast.error(`Failed to upload ${file.name}`);
      }
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    await uploadPendingGlobalFiles(Array.from(e.target.files));
    e.target.value = "";
  };

  const handleGlobalDrop = async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (!e.dataTransfer.files?.length) return;
    await uploadPendingGlobalFiles(Array.from(e.dataTransfer.files));
  };

  const appendItemFiles = (itemIndex: number, files: File[]) => {
    if (files.length === 0) return;
    setOrderItems((prev) =>
      prev.map((row, i) =>
        i === itemIndex ? { ...row, selectedFiles: [...row.selectedFiles, ...files] } : row
      )
    );
  };

  const handleItemFileInputChange = (itemIndex: number, e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files?.length) return;
    appendItemFiles(itemIndex, Array.from(e.target.files));
    e.target.value = "";
  };

  const handleItemFileDrop = (itemIndex: number, e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (!e.dataTransfer.files?.length) return;
    appendItemFiles(itemIndex, Array.from(e.dataTransfer.files));
  };

  const removeItemFile = (itemIndex: number, fileIndex: number) => {
    setOrderItems((prev) =>
      prev.map((row, i) =>
        i === itemIndex
          ? { ...row, selectedFiles: row.selectedFiles.filter((_, fi) => fi !== fileIndex) }
          : row
      )
    );
  };

  const removeFile = (tempId: string) => {
    setUploadedFiles(prev => prev.filter(f => f.tempId !== tempId));
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
      if (mode === "edit" && initialData) {
        const totalForeign = calculateTotal();
        const totalCompany = totalForeign * currentExchangeRate;

        const { error: orderUpdateError } = await supabase
          .from("orders")
          .update({
            client_id: formData.client_id || null,
            client_name: formData.client_name,
            email: formData.email || null,
            phone: formData.phone || null,
            delivery_date: deliveryDate.toISOString(),
            delivery_method: formData.delivery_method || null,
            pricing_tier_id: formData.pricing_tier_id || null,
            notes: formData.notes || null,
            total_price: totalForeign,
            total_price_foreign: totalForeign,
            total_price_company: totalCompany,
            currency_id: selectedCurrencyId,
            exchange_rate: currentExchangeRate,
          })
          .eq("id", initialData.id)
          .eq("company_id", companyId);

        if (orderUpdateError) throw orderUpdateError;

        const originalById = new Map(
          originalOrderItemsRef.current.filter((item) => item.id).map((item) => [item.id as string, item])
        );
        const currentWithId = orderItems.filter((item) => item.id);
        const currentIds = new Set(currentWithId.map((item) => item.id as string));

        const updatePromises = currentWithId.map((item) =>
          supabase
            .from("order_items")
            .update({
              product_id: item.product_id,
              quantity: item.quantity,
              unit_price: item.unit_price,
              item_total: item.item_total,
              description: item.description || null,
              needs_design: item.needs_design,
            })
            .eq("id", item.id as string)
            .eq("order_id", initialData.id)
            .eq("company_id", companyId)
        );

        const insertRows = orderItems
          .filter((item) => !item.id)
          .map((item) => ({
            order_id: initialData.id,
            product_id: item.product_id,
            quantity: item.quantity,
            unit_price: item.unit_price,
            item_total: item.item_total,
            description: item.description || null,
            needs_design: item.needs_design,
            company_id: companyId,
          }));

        const deleteIds = Array.from(originalById.keys()).filter((id) => !currentIds.has(id));

        const [updateResults, insertResult, deleteResult] = await Promise.all([
          Promise.all(updatePromises),
          insertRows.length > 0 ? supabase.from("order_items").insert(insertRows) : Promise.resolve({ error: null }),
          deleteIds.length > 0
            ? supabase.from("order_items").delete().in("id", deleteIds).eq("order_id", initialData.id)
            : Promise.resolve({ error: null }),
        ]);

        const updateError = updateResults.find((result) => result.error)?.error;
        if (updateError) throw updateError;
        if (insertResult.error) throw insertResult.error;
        if (deleteResult.error) throw deleteResult.error;

        const { error: historyError } = await supabase.from("order_status_history").insert({
          order_id: initialData.id,
          company_id: companyId,
          previous_status: initialData.status,
          new_status: initialData.status,
          changed_by: user.id,
          action_details: "Order details edited by Admin",
        });
        if (historyError) throw historyError;

        toast.success("Order updated successfully!");
        navigate("/orders");
        return;
      }

      // Initial order status follows line items (not a separate global flag).
      // Per-line `needs_design` also drives `order_tasks` via `fn_order_items_create_tasks_after_insert`.
      const anyItemNeedsDesign = orderItems.some((item) => item.needs_design);
      const initialStatus = anyItemNeedsDesign ? "Ready for Design" : "Ready for Production";

      // Calculate multi-currency totals
      const totalForeign = calculateTotal(); // Total in selected currency
      const totalCompany = totalForeign * currentExchangeRate; // Converted to company base currency

      // Insert order with multi-currency fields
      const { data: order, error: orderError } = await supabase
        .from("orders")
        .insert({
          client_id: formData.client_id || null,
          client_name: formData.client_name,
          email: formData.email || null,
          phone: formData.phone || null,
          delivery_date: deliveryDate.toISOString(),
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

      // Step B: Insert order items one row at a time so local index always matches DB `id`
      const insertedOrderItemIds: string[] = [];
      for (const item of orderItems) {
        const { data: insertedRow, error: itemInsertError } = await supabase
          .from("order_items")
          .insert({
            order_id: order.id,
            product_id: item.product_id,
            quantity: item.quantity,
            unit_price: item.unit_price,
            item_total: item.item_total,
            description: item.description || null,
            company_id: companyId,
            needs_design: item.needs_design,
          })
          .select("id")
          .single();

        if (itemInsertError) throw itemInsertError;
        if (!insertedRow?.id) throw new Error("Missing order item id after insert");
        insertedOrderItemIds.push(insertedRow.id);
      }

      const attachmentClientName = order.client_name || formData.client_name || "Client";

      /** Step C (item files): upload into final folder and insert attachment with `order_item_id`. */
      const uploadNewFileAndAttach = async (
        file: File,
        fileType: FileType,
        orderItemId: string | null
      ) => {
        const smartFileName = generateSmartFileName(
          order.id,
          attachmentClientName,
          fileType,
          file.name
        );
        const filePath = `${companyId}/${order.id}/${smartFileName}`;
        const { error: uploadErr } = await supabase.storage.from("order-files").upload(filePath, file);
        if (uploadErr) throw uploadErr;
        const {
          data: { publicUrl },
        } = supabase.storage.from("order-files").getPublicUrl(filePath);
        const { error: attachErr } = await supabase.from("order_attachments").insert({
          order_id: order.id,
          company_id: companyId,
          file_url: publicUrl,
          file_name: smartFileName,
          file_type: fileType,
          file_size: file.size,
          uploader_id: user.id,
          order_item_id: orderItemId,
        });
        if (attachErr) throw attachErr;
      };

      // Step C — general order assets (already in `pending/` or copied URLs), always `order_item_id: null`
      const successfulUploads = uploadedFiles.filter((f) => f.status === "success" && f.fileUrl);
      const attachmentsToInsert: Array<{
        order_id: string;
        company_id: string;
        file_url: string;
        file_name: string;
        file_type: string;
        file_size: number | null;
        uploader_id: string;
        order_item_id: null;
      }> = [];

      if (successfulUploads.length > 0) {
        const globalFileType: FileType = anyItemNeedsDesign ? "client_reference" : "print_file";

        const newFiles = successfulUploads.map((file) => {
          const smartFileName = generateSmartFileName(
            order.id,
            attachmentClientName,
            globalFileType,
            file.fileName
          );

          return {
            order_id: order.id,
            company_id: companyId,
            file_url: file.fileUrl,
            file_name: smartFileName,
            file_type: globalFileType,
            file_size: file.fileSize,
            uploader_id: user.id,
            order_item_id: null as const,
          };
        });

        attachmentsToInsert.push(...newFiles);
      }

      if (filesToCopy.length > 0) {
        const copiedFiles = filesToCopy.map((file) => {
          let fileTypeForNaming: FileType = "client_reference";
          if (file.file_type === "design_mockup" || file.file_type === "print_file") {
            fileTypeForNaming = file.file_type as FileType;
          } else if (file.file_type === "archived_mockup") {
            fileTypeForNaming = "design_mockup";
          }

          const newFileName = generateSmartFileName(
            order.id,
            attachmentClientName,
            fileTypeForNaming,
            file.file_name
          );

          return {
            order_id: order.id,
            company_id: companyId,
            file_url: file.file_url,
            file_name: newFileName,
            file_type: file.file_type,
            file_size: file.file_size,
            uploader_id: user.id,
            order_item_id: null as const,
          };
        });

        attachmentsToInsert.push(...copiedFiles);
      }

      if (attachmentsToInsert.length > 0) {
        const { error: attachmentsError } = await supabase.from("order_attachments").insert(attachmentsToInsert);

        if (attachmentsError) {
          console.error("Error linking files:", attachmentsError);
          toast.error("Some general order files could not be linked to the order");
        }
      }

      // Step C — per-line files (upload + attach with correct `order_item_id`)
      try {
        for (let i = 0; i < orderItems.length; i++) {
          const row = orderItems[i];
          const orderItemId = insertedOrderItemIds[i];
          if (!row?.selectedFiles.length) continue;
          const perItemFileType: FileType = row.needs_design ? "client_reference" : "print_file";
          for (const file of row.selectedFiles) {
            await uploadNewFileAndAttach(file, perItemFileType, orderItemId);
          }
        }
      } catch (fileErr) {
        console.error("Error uploading item files:", fileErr);
        toast.error("Order was created but some item files failed to upload. You can add them from the order page.");
      }

      toast.success("Order created successfully!");
      navigate("/orders");
    } catch (error) {
      console.error("Error submitting order:", error);
      toast.error(
        mode === "edit"
          ? "Failed to update order. Please try again."
          : "Failed to create order. Please try again."
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-3xl font-bold text-foreground">
          {mode === "edit" ? "Edit Order" : "New Order"}
        </h1>
        <p className="text-muted-foreground">
          {mode === "edit" ? "Update order details and items" : "Create a new print order"}
        </p>
      </div>

      {mode === "create" && fromQuotationId && hasPrefilledFromQuotation && (
        <div className="rounded-md border border-primary/30 bg-primary/5 px-4 py-3 text-sm flex items-start justify-between gap-3">
          <div>
            <span className="mr-2">📝</span>
            <span>
              Creating order from Quotation #{fromQuotationId.slice(0, 8).toUpperCase()}
            </span>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => {
              // Dismiss banner only
              setHasPrefilledFromQuotation(false);
            }}
          >
            Dismiss
          </Button>
        </div>
      )}

      {mode === "create" && fromOrderId && hasPrefilledFromOrder && (
        <div className="rounded-md border border-primary/30 bg-primary/5 px-4 py-3 text-sm flex items-start justify-between gap-3">
          <div>
            <span className="mr-2">📝</span>
            <span>
              Details loaded from Order #{fromOrderId.slice(0, 8).toUpperCase()}
            </span>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => {
              // Dismiss banner only
              setHasPrefilledFromOrder(false);
            }}
          >
            Dismiss
          </Button>
        </div>
      )}

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
                        <Label htmlFor="new_client_email">Email (Optional)</Label>
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
                        format(deliveryDate, "PPP HH:mm")
                      ) : (
                        <span>Pick a date and time</span>
                      )}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={deliveryDate}
                      onSelect={(date) => {
                        if (date) {
                          const [hours, minutes] = deliveryTime.split(':').map(Number);
                          date.setHours(hours, minutes);
                          setDeliveryDate(date);
                        }
                      }}
                      initialFocus
                      className="pointer-events-auto"
                      disabled={(date) => date < new Date()}
                    />
                    <div className="p-3 border-t border-border flex items-center gap-2">
                      <Input
                        type="number"
                        min="0"
                        max="23"
                        value={deliveryTime.split(':')[0]}
                        onChange={(e) => {
                          const newHours = parseInt(e.target.value);
                          setDeliveryTime(`${String(newHours).padStart(2, '0')}:${deliveryTime.split(':')[1]}`);
                          if (deliveryDate) {
                            const newDate = new Date(deliveryDate);
                            newDate.setHours(newHours, parseInt(deliveryTime.split(':')[1]));
                            setDeliveryDate(newDate);
                          }
                        }}
                        className="w-16"
                      />
                      <span>:</span>
                      <Input
                        type="number"
                        min="0"
                        max="59"
                        value={deliveryTime.split(':')[1]}
                        onChange={(e) => {
                          const newMinutes = parseInt(e.target.value);
                          setDeliveryTime(`${deliveryTime.split(':')[0]}:${String(newMinutes).padStart(2, '0')}`);
                          if (deliveryDate) {
                            const newDate = new Date(deliveryDate);
                            newDate.setHours(parseInt(deliveryTime.split(':')[0]), newMinutes);
                            setDeliveryDate(newDate);
                          }
                        }}
                        className="w-16"
                      />
                    </div>
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

            {/* Bulk design toggle — sets needs_design on every line; submit uses each item’s needs_design */}
            <div className="flex items-center justify-between p-4 border rounded-lg bg-muted/30">
              <div className="space-y-0.5">
                <Label htmlFor="requires-design" className="text-base">
                  Requires design service? (all lines)
                </Label>
                <p className="text-sm text-muted-foreground">
                  {orderItems.length === 0
                    ? "Add line items, then use this switch or per-line “Needs design?” below."
                    : orderItems.some((i) => i.needs_design) && !orderItems.every((i) => i.needs_design)
                      ? "Mixed lines: if any line needs design, the order starts in the designer queue."
                      : orderItems.every((i) => i.needs_design)
                        ? "Every line needs design — order starts in the designer queue."
                        : "No line needs design — order starts in the production queue."}
                </p>
              </div>
              <Switch
                id="requires-design"
                checked={orderItems.length > 0 && orderItems.every((i) => i.needs_design)}
                disabled={orderItems.length === 0}
                onCheckedChange={(checked) => {
                  setOrderItems((prev) => prev.map((row) => ({ ...row, needs_design: checked })));
                }}
              />
            </div>

            {/* General order assets (not tied to a line item) */}
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <Label className="text-base">General Order Assets</Label>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      className="rounded-full text-muted-foreground outline-none ring-offset-background hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                      aria-label="About order files"
                    >
                      <Info className="h-4 w-4" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="right" className="max-w-xs text-left">
                    <p>
                      Upload brand books or shared logos here for the whole order. Files you attach under a
                      product row are linked to that line only and go to the worker assigned to that item.
                    </p>
                  </TooltipContent>
                </Tooltip>
              </div>
              <p className="text-xs text-muted-foreground">
                {orderItems.some((i) => i.needs_design)
                  ? "Use this area for references that apply to every line (e.g. logos). Add mockups per product below."
                  : "Use this area for files that apply to the whole job. Add print-ready artwork per product below."}
              </p>
              {!canEditFiles && (
                <p className="text-xs text-muted-foreground">
                  File attachments are view-only. You can edit order fields only.
                </p>
              )}
              
              {/* Files from Previous Order */}
              {filesToCopy.length > 0 && (
                <div className="space-y-2">
                  <p className="text-sm font-medium text-foreground">
                    Files from Previous Order ({filesToCopy.length})
                  </p>
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {filesToCopy.map((file) => (
                      <div
                        key={file.id}
                        className={cn(
                          "flex items-center justify-between p-2 rounded-md border transition-colors",
                          "bg-blue-500/10 border-blue-500/30"
                        )}
                      >
                        <div className="flex items-center gap-2 flex-1 min-w-0 mr-2">
                          <Badge variant="outline" className="text-xs border-blue-500/50 text-blue-700 dark:text-blue-400">
                            From Previous Order
                          </Badge>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{file.file_name}</p>
                            <p className="text-xs text-muted-foreground">
                              {file.file_size ? formatFileSize(file.file_size) : "Unknown size"}
                            </p>
                          </div>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 text-muted-foreground hover:text-destructive"
                          onClick={() => setFilesToCopy(prev => prev.filter(f => f.id !== file.id))}
                          disabled={isSubmitting || !canEditFiles}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div
                role="button"
                tabIndex={0}
                className={cn(
                  "border-2 border-dashed border-muted-foreground/25 rounded-lg p-6 text-center transition-colors",
                  canEditFiles
                    ? "hover:border-primary/50 cursor-pointer"
                    : "opacity-60 cursor-not-allowed"
                )}
                onClick={() => {
                  if (!canEditFiles) return;
                  document.getElementById("file-input")?.click();
                }}
                onKeyDown={(e) => {
                  if (!canEditFiles) return;
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    document.getElementById("file-input")?.click();
                  }
                }}
                onDragOver={(e) => {
                  if (!canEditFiles) return;
                  e.preventDefault();
                  e.stopPropagation();
                }}
                onDrop={(e) => {
                  if (!canEditFiles) return;
                  void handleGlobalDrop(e);
                }}
              >
                <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                <p className="text-sm text-muted-foreground">
                  Click to select files or drag and drop
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  You can select multiple files — uploads start immediately
                </p>
                <Input
                  id="file-input"
                  type="file"
                  multiple
                  onChange={handleFileChange}
                  className="hidden"
                  disabled={!canEditFiles}
                />
              </div>

              {/* Uploaded Files List */}
              {uploadedFiles.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-foreground">
                      {uploadedFiles.length} file(s) selected
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {uploadedFiles.filter(f => f.status === 'success').length} uploaded
                    </p>
                  </div>
                  
                  {/* Overall progress bar */}
                  {uploadedFiles.some(f => f.status === 'uploading') && (
                    <Progress 
                      value={(uploadedFiles.filter(f => f.status === 'success').length / uploadedFiles.length) * 100} 
                      className="h-2"
                    />
                  )}
                  
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {uploadedFiles.map((file) => (
                      <div
                        key={file.tempId}
                        className={cn(
                          "flex items-center justify-between p-2 rounded-md border transition-colors",
                          file.status === 'success' && "bg-green-500/10 border-green-500/30",
                          file.status === 'error' && "bg-destructive/10 border-destructive/30",
                          file.status === 'uploading' && "bg-primary/10 border-primary/30"
                        )}
                      >
                        <div className="flex-1 min-w-0 mr-2">
                          <p className="text-sm font-medium truncate">{file.fileName}</p>
                          <p className="text-xs text-muted-foreground">
                            {formatFileSize(file.fileSize)}
                          </p>
                        </div>
                        
                        {/* Status indicator or delete button */}
                        {file.status === 'uploading' ? (
                          <Loader2 className="h-5 w-5 animate-spin text-primary" />
                        ) : file.status === 'success' ? (
                          <div className="flex items-center gap-2">
                            <CheckCircle2 className="h-5 w-5 text-green-500" />
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6 text-muted-foreground hover:text-destructive"
                              onClick={() => removeFile(file.tempId)}
                              disabled={isSubmitting || !canEditFiles}
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2">
                            <XCircle className="h-5 w-5 text-destructive" />
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6 text-muted-foreground hover:text-destructive"
                              onClick={() => removeFile(file.tempId)}
                              disabled={!canEditFiles}
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        )}
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
          <CardHeader>
            <CardTitle>Order Items</CardTitle>
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
                            className="w-full justify-between h-auto min-h-10 whitespace-normal text-left"
                          >
                            {item.product_name || "Select product"}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-[600px] p-0" align="start">
                          <Command>
                            <CommandInput placeholder="Search products..." />
                            <CommandList>
                              <CommandEmpty>No products found.</CommandEmpty>
                              <CommandGroup>
                                {products.map((product) => (
                                  <CommandItem
                                    key={product.id}
                                    value={`${product.name_en} ${product.name_ar} ${product.product_code}`}
                                    onSelect={() => updateOrderItem(index, product)}
                                    className="h-auto items-start py-3"
                                  >
                                    <div className="flex flex-col w-full gap-1">
                                      <span className="font-medium whitespace-normal leading-snug">
                                        {product.name_en}
                                      </span>
                                      <span className="text-sm text-muted-foreground">
                                        {product.name_ar} - {product.product_code}
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
                          updateQuantity(index, parseInt(e.target.value) || 1)
                        }
                      />
                    </div>

                    {/* Unit Price */}
                    <div className="space-y-2">
                      <Label>Unit Price</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={item.unit_price}
                        onChange={(e) => updateUnitPrice(index, e.target.value)}
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
                  {/* Item Description */}
                  <div className="space-y-2">
                    <Label htmlFor={`order-item-description-${index}`}>
                      Item Description (Optional)
                    </Label>
                    <Textarea
                      id={`order-item-description-${index}`}
                      value={item.description || ""}
                      onChange={(e) => {
                        const updated = [...orderItems];
                        const current = updated[index];
                        if (!current) return;
                        updated[index] = {
                          ...current,
                          description: e.target.value,
                        };
                        setOrderItems(updated);
                      }}
                      placeholder="E.g. Matte finish, Size A4, double-sided printing"
                      rows={2}
                    />
                  </div>

                  {/* Per-line files (uploaded on submit, linked to this order_item) */}
                  <div className="space-y-2">
                    <Label className="text-xs font-medium text-muted-foreground">
                      Attach files for this item
                    </Label>
                    <div
                      role="button"
                      tabIndex={0}
                      className={cn(
                        "rounded-md border border-dashed border-muted-foreground/30 bg-background/60 px-2.5 py-2 text-left text-xs transition-colors",
                        canEditFiles
                          ? "hover:border-primary/40 hover:bg-muted/20"
                          : "opacity-60 cursor-not-allowed"
                      )}
                      onClick={() => {
                        if (!canEditFiles) return;
                        document.getElementById(`item-file-input-${index}`)?.click();
                      }}
                      onKeyDown={(e) => {
                        if (!canEditFiles) return;
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          document.getElementById(`item-file-input-${index}`)?.click();
                        }
                      }}
                      onDragOver={(e) => {
                        if (!canEditFiles) return;
                        e.preventDefault();
                        e.stopPropagation();
                      }}
                      onDrop={(e) => {
                        if (!canEditFiles) return;
                        handleItemFileDrop(index, e);
                      }}
                    >
                      <div className="flex items-center gap-2">
                        <Paperclip className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
                        <span className="text-muted-foreground">
                          Drop files or click — linked to this product when you create the order
                        </span>
                      </div>
                      <Input
                        id={`item-file-input-${index}`}
                        type="file"
                        multiple
                        className="hidden"
                        onChange={(e) => handleItemFileInputChange(index, e)}
                        disabled={!canEditFiles}
                      />
                      {item.selectedFiles.length > 0 && (
                        <ul className="mt-2 space-y-1 border-t border-border/60 pt-2">
                          {item.selectedFiles.map((f, fi) => (
                            <li
                              key={`${index}-${fi}-${f.name}-${f.size}`}
                              className="flex items-center justify-between gap-2 rounded bg-muted/40 px-2 py-1"
                            >
                              <span className="min-w-0 flex-1 truncate font-medium text-foreground">
                                {f.name}
                              </span>
                              <span className="shrink-0 text-[10px] text-muted-foreground">
                                {formatFileSize(f.size)}
                              </span>
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="h-7 shrink-0 px-2 text-xs"
                                onClick={(e) => {
                                  if (!canEditFiles) return;
                                  e.stopPropagation();
                                  removeItemFile(index, fi);
                                }}
                                disabled={isSubmitting || !canEditFiles}
                              >
                                Remove
                              </Button>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center justify-between rounded-md border bg-background/50 px-3 py-2">
                    <div className="space-y-0.5 pr-4">
                      <Label htmlFor={`order-item-needs-design-${index}`} className="text-sm font-medium">
                        Needs Design?
                      </Label>
                      <p className="text-xs text-muted-foreground">
                        Off = production-only task for this line; on = design task plus blocked production.
                      </p>
                    </div>
                    <Switch
                      id={`order-item-needs-design-${index}`}
                      checked={item.needs_design}
                      onCheckedChange={(checked) => {
                        const updated = [...orderItems];
                        const current = updated[index];
                        if (!current) return;
                        updated[index] = { ...current, needs_design: checked };
                        setOrderItems(updated);
                      }}
                    />
                  </div>
                </div>
              ))
            )}

            <div className="border-t border-border/60 pt-4">
              <Button
                type="button"
                onClick={addOrderItem}
                className="mx-auto flex w-full sm:w-auto"
              >
                <Plus className="mr-2 h-4 w-4" />
                Add Item
              </Button>
            </div>

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
            {isSubmitting
              ? mode === "edit"
                ? "Updating Order..."
                : "Creating Order..."
              : mode === "edit"
                ? "Save Changes"
                : "Create Order"}
          </Button>
        </div>
      </form>
    </div>
  );
}
