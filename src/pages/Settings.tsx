import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { supabase } from '@/integrations/supabase/client';
import { useUserRole } from '@/hooks/useUserRole';
import { useCurrencies } from '@/hooks/useCurrencies';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Upload, Loader2 } from 'lucide-react';
import { Navigate } from 'react-router-dom';
import { ExchangeRatesManager } from '@/components/settings/ExchangeRatesManager';

const companySchema = z.object({
  name: z.string().min(1, 'Company name is required').max(200),
  tax_number: z.string().max(50).optional().or(z.literal('')),
  phone: z.string().max(20).optional().or(z.literal('')),
  email: z.string().email('Invalid email').max(100).optional().or(z.literal('')),
  website: z.string().url('Invalid URL').max(200).optional().or(z.literal('')),
  address: z.string().max(500).optional().or(z.literal('')),
  invoice_notes: z.string().max(1000).optional().or(z.literal('')),
  invoice_terms: z.string().max(1000).optional().or(z.literal('')),
  tax_rate: z.coerce.number().min(0, 'Tax rate must be at least 0').max(100, 'Tax rate cannot exceed 100'),
  currency_id: z.string().min(1, 'Currency is required'),
});

type CompanyFormData = z.infer<typeof companySchema>;

export default function Settings() {
  const { role, companyId, loading: roleLoading } = useUserRole();
  const { toast } = useToast();
  const { data: currencies, isLoading: currenciesLoading } = useCurrencies();
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [loadingData, setLoadingData] = useState(true);
  const [selectedCurrencyId, setSelectedCurrencyId] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    reset,
    setValue,
    watch,
  } = useForm<CompanyFormData>({
    resolver: zodResolver(companySchema),
  });

  const watchedCurrencyId = watch('currency_id');

  useEffect(() => {
    if (companyId) {
      fetchCompanyData();
    }
  }, [companyId]);

  const fetchCompanyData = async () => {
    try {
      const { data, error } = await supabase
        .from('companies')
        .select('*')
        .eq('id', companyId)
        .single();

      if (error) throw error;

      if (data) {
        // Cast to any to access currency_id which isn't in generated types yet
        const companyData = data as any;
        // Default to USD if no currency set
        const USD_CURRENCY_ID = '86b77ba9-73ce-42d4-916e-41e2ab500cfa';
        let currencyId = companyData.currency_id || USD_CURRENCY_ID;

        reset({
          name: data.name || '',
          tax_number: data.tax_number || '',
          phone: data.phone || '',
          email: data.email || '',
          website: data.website || '',
          address: data.address || '',
          invoice_notes: data.invoice_notes || '',
          invoice_terms: data.invoice_terms || '',
          tax_rate: data.tax_rate || 5,
          currency_id: currencyId,
        });

        setSelectedCurrencyId(currencyId);

        if (data.logo_url) {
          setLogoPreview(data.logo_url);
        }
      }
    } catch (error) {
      console.error('Error fetching company data:', error);
      toast({
        title: 'Error',
        description: 'Failed to load company data',
        variant: 'destructive',
      });
    } finally {
      setLoadingData(false);
    }
  };

  // Currency is already set in fetchCompanyData with USD default

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        toast({
          title: 'Error',
          description: 'Logo must be less than 5MB',
          variant: 'destructive',
        });
        return;
      }

      setLogoFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setLogoPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const uploadLogo = async (): Promise<string | null> => {
    if (!logoFile || !companyId) return null;

    try {
      const fileExt = logoFile.name.split('.').pop();
      const fileName = `${companyId}/${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('company-logos')
        .upload(fileName, logoFile, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('company-logos')
        .getPublicUrl(fileName);

      return publicUrl;
    } catch (error) {
      console.error('Error uploading logo:', error);
      throw error;
    }
  };

  const onSubmit = async (data: CompanyFormData) => {
    try {
      setUploading(true);

      let logoUrl = logoPreview;

      if (logoFile) {
        logoUrl = await uploadLogo();
      }



      const updateData = {
        name: data.name,
        tax_number: data.tax_number || null,
        phone: data.phone || null,
        email: data.email || null,
        website: data.website || null,
        address: data.address || null,
        logo_url: logoUrl || null,
        invoice_notes: data.invoice_notes || null,
        invoice_terms: data.invoice_terms || null,
        tax_rate: data.tax_rate,
        currency_id: data.currency_id,
      };

      const { error } = await supabase
        .from('companies')
        .update(updateData)
        .eq('id', companyId);

      if (error) throw error;

      setSelectedCurrencyId(data.currency_id);

      toast({
        title: 'Success',
        description: 'Company details updated successfully',
      });

      setLogoFile(null);
    } catch (error) {
      console.error('Error updating company:', error);
      toast({
        title: 'Error',
        description: 'Failed to update company details',
        variant: 'destructive',
      });
    } finally {
      setUploading(false);
    }
  };

  if (roleLoading || loadingData || currenciesLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (role !== 'admin') {
    return <Navigate to="/" replace />;
  }

  const selectedCurrency = currencies?.find(c => c.id === watchedCurrencyId);

  return (
    <div className="space-y-4 sm:space-y-6 p-4 sm:p-0">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Company Settings</h1>
        <p className="text-muted-foreground mt-2">
          Manage your company profile, branding, and invoice details
        </p>
      </div>

      <Tabs defaultValue="general" className="space-y-6">
        <TabsList>
          <TabsTrigger value="general">General</TabsTrigger>
          <TabsTrigger value="exchange-rates">Exchange Rates</TabsTrigger>
        </TabsList>

        <TabsContent value="general">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            {/* Branding Section */}
            <Card>
              <CardHeader>
                <CardTitle>Company Branding</CardTitle>
                <CardDescription>
                  Upload your company logo to appear on invoices and throughout the app
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-6">
                  <div className="flex-shrink-0">
                    {logoPreview ? (
                      <img
                        src={logoPreview}
                        alt="Company Logo"
                        className="h-24 w-24 object-contain rounded-lg border border-border"
                      />
                    ) : (
                      <div className="h-24 w-24 rounded-lg border-2 border-dashed border-border flex items-center justify-center text-muted-foreground">
                        No Logo
                      </div>
                    )}
                  </div>
                  <div className="flex-1">
                    <Label htmlFor="logo" className="cursor-pointer">
                      <div className="flex items-center gap-2 text-sm">
                        <Button type="button" variant="outline" size="sm" asChild>
                          <span>
                            <Upload className="h-4 w-4 mr-2" />
                            Upload Logo
                          </span>
                        </Button>
                        <span className="text-muted-foreground">
                          PNG, JPG up to 5MB
                        </span>
                      </div>
                    </Label>
                    <Input
                      id="logo"
                      type="file"
                      accept="image/*"
                      onChange={handleLogoChange}
                      className="hidden"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Company Details Section */}
            <Card>
              <CardHeader>
                <CardTitle>Company Details</CardTitle>
                <CardDescription>
                  This information will appear on invoices and official documents
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">
                      Company Name <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="name"
                      {...register('name')}
                      placeholder="Enter company name"
                    />
                    {errors.name && (
                      <p className="text-sm text-destructive">{errors.name.message}</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="tax_number">Tax/TRN Number</Label>
                    <Input
                      id="tax_number"
                      {...register('tax_number')}
                      placeholder="Enter tax registration number"
                    />
                    {errors.tax_number && (
                      <p className="text-sm text-destructive">{errors.tax_number.message}</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="tax_rate">Tax/VAT Rate (%)</Label>
                    <Input
                      id="tax_rate"
                      type="number"
                      step="0.01"
                      {...register('tax_rate')}
                      placeholder="e.g. 5 or 15"
                    />
                    {errors.tax_rate && (
                      <p className="text-sm text-destructive">{errors.tax_rate.message}</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="currency_id">
                      Base Currency <span className="text-destructive">*</span>
                    </Label>
                    <Select
                      value={watchedCurrencyId}
                      onValueChange={(value) => setValue('currency_id', value)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select currency" />
                      </SelectTrigger>
                      <SelectContent>
                        {currencies?.map((currency) => (
                          <SelectItem key={currency.id} value={currency.id}>
                            {currency.code} - {currency.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {errors.currency_id && (
                      <p className="text-sm text-destructive">{errors.currency_id.message}</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="phone">Phone</Label>
                    <Input
                      id="phone"
                      {...register('phone')}
                      placeholder="+971 50 123 4567"
                    />
                    {errors.phone && (
                      <p className="text-sm text-destructive">{errors.phone.message}</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      {...register('email')}
                      placeholder="company@example.com"
                    />
                    {errors.email && (
                      <p className="text-sm text-destructive">{errors.email.message}</p>
                    )}
                  </div>

                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="website">Website</Label>
                    <Input
                      id="website"
                      {...register('website')}
                      placeholder="https://www.example.com"
                    />
                    {errors.website && (
                      <p className="text-sm text-destructive">{errors.website.message}</p>
                    )}
                  </div>

                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="address">Address</Label>
                    <Textarea
                      id="address"
                      {...register('address')}
                      placeholder="Enter full company address"
                      rows={3}
                    />
                    {errors.address && (
                      <p className="text-sm text-destructive">{errors.address.message}</p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Invoice Customization Section */}
            <Card>
              <CardHeader>
                <CardTitle>Invoice Customization</CardTitle>
                <CardDescription>
                  Customize default notes and terms that appear on all invoices
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="invoice_notes">Default Invoice Notes</Label>
                  <Textarea
                    id="invoice_notes"
                    {...register('invoice_notes')}
                    placeholder="Thank you for your business."
                    rows={3}
                  />
                  {errors.invoice_notes && (
                    <p className="text-sm text-destructive">{errors.invoice_notes.message}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="invoice_terms">Terms and Conditions</Label>
                  <Textarea
                    id="invoice_terms"
                    {...register('invoice_terms')}
                    placeholder="1. Goods once sold cannot be returned.&#10;2. Payment to be made by Cheque/Cash.&#10;3. All disputes are subject to UAE jurisdiction."
                    rows={5}
                  />
                  {errors.invoice_terms && (
                    <p className="text-sm text-destructive">{errors.invoice_terms.message}</p>
                  )}
                </div>
              </CardContent>
            </Card>

            <div className="flex justify-end">
              <Button type="submit" disabled={isSubmitting || uploading}>
                {(isSubmitting || uploading) && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                Save Changes
              </Button>
            </div>
          </form>
        </TabsContent>

        <TabsContent value="exchange-rates">
          <ExchangeRatesManager
            baseCurrencyId={selectedCurrencyId}
            baseCurrencyCode={selectedCurrency?.code}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
