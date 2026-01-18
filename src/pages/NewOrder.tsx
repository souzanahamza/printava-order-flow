import { useState, useEffect } from "react";
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
import { useOrderFileUpload, generateSmartFileName, type FileType } from "@/hooks/useOrderFileUpload";
import { usePricingTiers } from "@/hooks/usePricingTiers";
import { useCompanyCurrency, useExchangeRates, useCurrencies } from "@/hooks/useCurrencies";
import { CalendarIcon, Plus, Trash2, Upload, UserPlus, CheckCircle2, XCircle, Loader2 } from "lucide-react";
import { Progress } from "@/components/ui/progress";
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
import { OrderAttachment } from "@/components/orders/types";
import { Badge } from "@/components/ui/badge";

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

interface UploadedFile {
  tempId: string;
  fileName: string;
  fileUrl: string;
  fileSize: number;
  status: 'uploading' | 'success' | 'error';
  error?: string;
}

const NewOrder = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const fromQuotationId = searchParams.get("fromQuotation");
  const fromOrderId = searchParams.get("fromOrder");
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
  const [requiresDesign, setRequiresDesign] = useState(false);
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

  // Prefill from quotation if query param is present
  useEffect(() => {
    const prefillFromQuotation = async () => {
      if (!fromQuotationId || hasPrefilledFromQuotation || !companyId) return;

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
              product:products(
                name_en,
                name_ar,
                product_code
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

        // Prefill items
        if (quotation.quotation_items && quotation.quotation_items.length > 0) {
          const mappedItems: OrderItem[] = quotation.quotation_items.map((item: any) => ({
            product_id: item.product_id,
            product_name: item.product
              ? `${item.product.name_ar} (${item.product.name_en})`
              : "",
            product_code: item.product?.product_code || "",
            quantity: item.quantity,
            unit_price: item.unit_price,
            item_total: item.item_total,
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
  }, [fromQuotationId, companyId, hasPrefilledFromQuotation, clients]);

  // Prefill from order if query param is present
  useEffect(() => {
    const prefillFromOrder = async () => {
      if (!fromOrderId || hasPrefilledFromOrder || !companyId) return;

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
              product:products(
                name_en,
                name_ar,
                product_code
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
              ? `${item.product.name_ar} (${item.product.name_en})`
              : "",
            product_code: item.product?.product_code || "",
            quantity: item.quantity,
            unit_price: item.unit_price,
            item_total: item.item_total,
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
  }, [fromOrderId, companyId, hasPrefilledFromOrder, clients]);

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

  // Upload file immediately when selected
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    if (!companyId || !user?.id) {
      toast.error("Please ensure you're logged in before uploading files");
      return;
    }

    const files = Array.from(e.target.files);
    
    // Upload each file immediately
    for (const file of files) {
      const tempId = `temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      // Add file with uploading status
      setUploadedFiles(prev => [...prev, {
        tempId,
        fileName: file.name,
        fileUrl: '',
        fileSize: file.size,
        status: 'uploading'
      }]);

      try {
        // Upload to temp folder in storage
        const fileExt = file.name.split('.').pop()?.toLowerCase() || 'file';
        const sanitizedClientName = (clientNameForUpload || 'Order')
          .replace(/[^a-zA-Z0-9\s]/g, '')
          .replace(/\s+/g, '_')
          .substring(0, 30) || 'Order';
        const storagePath = `${companyId}/pending/${tempId}_${sanitizedClientName}.${fileExt}`;

        const { error: uploadError } = await supabase.storage
          .from('order-files')
          .upload(storagePath, file);

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
          .from('order-files')
          .getPublicUrl(storagePath);

        // Update file status to success
        setUploadedFiles(prev => prev.map(f => 
          f.tempId === tempId 
            ? { ...f, fileUrl: publicUrl, status: 'success' as const }
            : f
        ));
        
        toast.success(`${file.name} uploaded`);
      } catch (error) {
        console.error('File upload error:', error);
        // Update file status to error
        setUploadedFiles(prev => prev.map(f => 
          f.tempId === tempId 
            ? { ...f, status: 'error' as const, error: (error as Error).message }
            : f
        ));
        toast.error(`Failed to upload ${file.name}`);
      }
    }
    
    // Reset input
    e.target.value = '';
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

      // Link already-uploaded files to the order with smart file names
      const successfulUploads = uploadedFiles.filter(f => f.status === 'success' && f.fileUrl);
      const attachmentsToInsert = [];

      // Process new files
      if (successfulUploads.length > 0) {
        const fileType: FileType = requiresDesign ? "client_reference" : "print_file";
        
        const newFiles = successfulUploads.map(file => {
          // Generate smart file name using order ID and client name
          const smartFileName = generateSmartFileName(
            order.id,
            order.client_name,
            fileType,
            file.fileName
          );
          
          return {
            order_id: order.id,
            company_id: companyId,
            file_url: file.fileUrl,
            file_name: smartFileName,
            file_type: fileType,
            file_size: file.fileSize,
            uploader_id: user.id,
          };
        });

        attachmentsToInsert.push(...newFiles);
      }

      // Copy files from previous order
      if (filesToCopy.length > 0) {
        const copiedFiles = filesToCopy.map(file => {
          // Map file_type to valid FileType for generateSmartFileName
          // Only 'design_mockup', 'print_file', and 'client_reference' are supported
          let fileTypeForNaming: FileType = 'client_reference';
          if (file.file_type === 'design_mockup' || file.file_type === 'print_file') {
            fileTypeForNaming = file.file_type as FileType;
          } else if (file.file_type === 'archived_mockup') {
            fileTypeForNaming = 'design_mockup';
          }

          // Generate new smart filename with NEW order ID
          const newFileName = generateSmartFileName(
            order.id,
            order.client_name,
            fileTypeForNaming,
            file.file_name // Use old filename to extract extension
          );

          return {
            order_id: order.id,
            company_id: companyId,
            file_url: file.file_url, // Keep same URL (same storage file)
            file_name: newFileName, // Use new smart filename with new order ID
            file_type: file.file_type, // Keep original file_type
            file_size: file.file_size,
            uploader_id: user.id,
          };
        });

        attachmentsToInsert.push(...copiedFiles);
      }

      // Insert all attachments at once
      if (attachmentsToInsert.length > 0) {
        const { error: attachmentsError } = await supabase
          .from("order_attachments")
          .insert(attachmentsToInsert);

        if (attachmentsError) {
          console.error("Error linking files:", attachmentsError);
          toast.error("Some files could not be linked to the order");
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

      {fromQuotationId && hasPrefilledFromQuotation && (
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

      {fromOrderId && hasPrefilledFromOrder && (
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
                          disabled={isSubmitting}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

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
                              disabled={isSubmitting}
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
                        step="0.000001"
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
