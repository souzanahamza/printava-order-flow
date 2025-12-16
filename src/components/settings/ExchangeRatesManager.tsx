import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useUserRole } from "@/hooks/useUserRole";
import { useCurrencies, Currency } from "@/hooks/useCurrencies";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Plus, Trash2, Loader2, ArrowRight } from "lucide-react";

interface ExchangeRateRow {
  id: string;
  currency_id: string;
  rate_to_company_currency: number;
  is_active: boolean;
  currency: Currency;
}

interface Props {
  baseCurrencyId: string | null;
  baseCurrencyCode: string;
}

export function ExchangeRatesManager({ baseCurrencyId, baseCurrencyCode }: Props) {
  const { companyId } = useUserRole();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: allCurrencies } = useCurrencies();
  
  const [newCurrencyId, setNewCurrencyId] = useState<string>("");
  const [newRate, setNewRate] = useState<string>("");
  const [editingRates, setEditingRates] = useState<Record<string, string>>({});

  // Fetch exchange rates
  const { data: exchangeRates, isLoading } = useQuery({
    queryKey: ["exchange-rates-manage", companyId],
    queryFn: async () => {
      if (!companyId) return [];
      const { data, error } = await (supabase as any)
        .from("exchange_rates")
        .select(`
          id,
          currency_id,
          rate_to_company_currency,
          is_active,
          currency:currencies(*)
        `)
        .eq("company_id", companyId)
        .eq("is_active", true);
      if (error) throw error;
      return (data || []) as ExchangeRateRow[];
    },
    enabled: !!companyId,
  });

  // Available currencies (not already added)
  const availableCurrencies = allCurrencies?.filter(
    (c) =>
      c.id !== baseCurrencyId &&
      !exchangeRates?.some((er) => er.currency_id === c.id)
  );

  // Add rate mutation
  const addRateMutation = useMutation({
    mutationFn: async ({ currencyId, rate }: { currencyId: string; rate: number }) => {
      const { error } = await (supabase as any)
        .from("exchange_rates")
        .insert({
          company_id: companyId,
          currency_id: currencyId,
          rate_to_company_currency: rate,
          is_active: true,
        });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["exchange-rates-manage"] });
      queryClient.invalidateQueries({ queryKey: ["exchange-rates"] });
      setNewCurrencyId("");
      setNewRate("");
      toast({ title: "Success", description: "Exchange rate added" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to add rate", variant: "destructive" });
    },
  });

  // Update rate mutation
  const updateRateMutation = useMutation({
    mutationFn: async ({ id, rate }: { id: string; rate: number }) => {
      const { error } = await (supabase as any)
        .from("exchange_rates")
        .update({ rate_to_company_currency: rate, valid_from: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["exchange-rates-manage"] });
      queryClient.invalidateQueries({ queryKey: ["exchange-rates"] });
      setEditingRates({});
      toast({ title: "Success", description: "Exchange rate updated" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to update rate", variant: "destructive" });
    },
  });

  // Delete rate mutation
  const deleteRateMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any)
        .from("exchange_rates")
        .update({ is_active: false })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["exchange-rates-manage"] });
      queryClient.invalidateQueries({ queryKey: ["exchange-rates"] });
      toast({ title: "Success", description: "Exchange rate removed" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to remove rate", variant: "destructive" });
    },
  });

  const handleAddRate = () => {
    if (!newCurrencyId || !newRate) return;
    const rate = parseFloat(newRate);
    if (isNaN(rate) || rate <= 0) {
      toast({ title: "Error", description: "Invalid rate value", variant: "destructive" });
      return;
    }
    addRateMutation.mutate({ currencyId: newCurrencyId, rate });
  };

  const handleUpdateRate = (id: string) => {
    const rateStr = editingRates[id];
    if (!rateStr) return;
    const rate = parseFloat(rateStr);
    if (isNaN(rate) || rate <= 0) {
      toast({ title: "Error", description: "Invalid rate value", variant: "destructive" });
      return;
    }
    updateRateMutation.mutate({ id, rate });
  };

  if (!baseCurrencyId) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Exchange Rates</CardTitle>
          <CardDescription>
            Please select a base currency first before managing exchange rates.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Exchange Rates</CardTitle>
        <CardDescription>
          Manage exchange rates for foreign currencies against your base currency ({baseCurrencyCode})
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Add New Rate */}
        <div className="flex flex-col sm:flex-row gap-4 p-4 border rounded-lg bg-muted/30">
          <div className="flex-1 space-y-2">
            <Label>Currency</Label>
            <Select value={newCurrencyId} onValueChange={setNewCurrencyId}>
              <SelectTrigger>
                <SelectValue placeholder="Select currency" />
              </SelectTrigger>
              <SelectContent>
                {availableCurrencies?.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.code} - {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-end gap-2">
            <div className="space-y-2">
              <Label>1 {allCurrencies?.find(c => c.id === newCurrencyId)?.code || "XXX"} =</Label>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  step="0.0001"
                  min="0"
                  placeholder="Rate"
                  value={newRate}
                  onChange={(e) => setNewRate(e.target.value)}
                  className="w-32"
                />
                <span className="text-sm text-muted-foreground">{baseCurrencyCode}</span>
              </div>
            </div>
            <Button
              onClick={handleAddRate}
              disabled={!newCurrencyId || !newRate || addRateMutation.isPending}
            >
              {addRateMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Plus className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>

        {/* Existing Rates */}
        {isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : exchangeRates?.length === 0 ? (
          <p className="text-center text-muted-foreground py-8">
            No exchange rates configured. Add one above to accept foreign currencies.
          </p>
        ) : (
          <div className="space-y-3">
            {exchangeRates?.map((er) => (
              <div
                key={er.id}
                className="flex items-center justify-between p-4 border rounded-lg"
              >
                <div className="flex items-center gap-3">
                  <span className="font-medium text-lg">{er.currency?.code}</span>
                  <span className="text-muted-foreground">{er.currency?.name}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm text-muted-foreground">1 {er.currency?.code}</span>
                  <ArrowRight className="h-4 w-4 text-muted-foreground" />
                  <Input
                    type="number"
                    step="0.0001"
                    min="0"
                    value={editingRates[er.id] ?? er.rate_to_company_currency}
                    onChange={(e) =>
                      setEditingRates((prev) => ({ ...prev, [er.id]: e.target.value }))
                    }
                    className="w-28"
                  />
                  <span className="text-sm text-muted-foreground">{baseCurrencyCode}</span>
                  {editingRates[er.id] !== undefined &&
                    editingRates[er.id] !== er.rate_to_company_currency.toString() && (
                      <Button
                        size="sm"
                        onClick={() => handleUpdateRate(er.id)}
                        disabled={updateRateMutation.isPending}
                      >
                        {updateRateMutation.isPending ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          "Save"
                        )}
                      </Button>
                    )}
                  <Button
                    size="icon"
                    variant="ghost"
                    className="text-destructive hover:text-destructive"
                    onClick={() => deleteRateMutation.mutate(er.id)}
                    disabled={deleteRateMutation.isPending}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
