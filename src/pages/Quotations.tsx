import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useUserRole } from "@/hooks/useUserRole";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StatusBadge } from "@/components/StatusBadge";
import { PriceDisplay } from "@/components/ui/price-display";
import { Skeleton } from "@/components/ui/skeleton";
import { Search, Eye, Plus } from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { format } from "date-fns";
import { QuotationDetails } from "@/components/quotations/QuotationDetails";

type QuotationWithRelations = {
  id: string;
  client_name: string;
  email: string | null;
  phone: string | null;
  valid_until: string | null;
  total_price: number | null;
  total_price_foreign?: number | null;
  total_price_company?: number | null;
  currencies?: {
    code: string;
    symbol: string | null;
  } | null;
};

export default function Quotations() {
  const navigate = useNavigate();
  const { companyId } = useUserRole();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedQuotationId, setSelectedQuotationId] = useState<string | null>(null);

  const { data: companyProfile } = useQuery({
    queryKey: ["company-profile", companyId],
    queryFn: async () => {
      if (!companyId) return null;
      const { data, error } = await supabase
        .from("companies")
        .select("currency_id, base_currency:currencies(code)")
        .eq("id", companyId)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!companyId,
  });

  const baseCurrency = companyProfile?.base_currency?.code;

  const { data: quotations, isLoading } = useQuery({
    queryKey: ["quotations", companyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("quotations")
        .select(
          `
          *,
          currencies:currency_id ( code, symbol )
        `
        )
        .eq("company_id", companyId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as QuotationWithRelations[];
    },
    enabled: !!companyId,
  });

  const filteredQuotations =
    quotations?.filter((q) => {
      if (!searchQuery) return true;
      const query = searchQuery.toLowerCase();
      return (
        q.id.toLowerCase().includes(query) ||
        q.client_name.toLowerCase().includes(query) ||
        (q.email && q.email.toLowerCase().includes(query))
      );
    }) || [];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Quotations</h1>
          <p className="text-muted-foreground">
            Manage price offers before converting them into confirmed orders.
          </p>
        </div>
        <Button onClick={() => navigate("/quotations/new")}>
          <Plus className="mr-2 h-4 w-4" />
          Create Quotation
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Quotations</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by reference, client, or email..."
              className="pl-9"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : filteredQuotations.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">
              No quotations found. Start by creating a new quotation.
            </p>
          ) : (
            <div className="border rounded-lg overflow-hidden">
              <div className="grid grid-cols-[1.2fr_2fr_1.5fr_1.5fr_1.2fr] gap-4 px-4 py-3 bg-muted text-xs font-medium text-muted-foreground uppercase">
                <div>Reference</div>
                <div>Client</div>
                <div>Valid Until</div>
                <div>Total</div>
                <div className="text-right">Actions</div>
              </div>
              <div className="divide-y">
                {filteredQuotations.map((q) => {
                  const foreignCurrency = q.currencies?.code;
                  const amount = q.total_price_foreign ?? q.total_price ?? 0;
                  const baseAmount = q.total_price_company ?? q.total_price ?? 0;

                  return (
                    <div
                      key={q.id}
                      className="grid grid-cols-[1.2fr_2fr_1.5fr_1.5fr_1.2fr] gap-4 px-4 py-3 items-center text-sm"
                    >
                      <div className="font-mono text-xs">
                        {q.id.slice(0, 8).toUpperCase()}
                      </div>
                      <div className="truncate">
                        <div className="font-medium">{q.client_name}</div>
                        {q.email && (
                          <div className="text-xs text-muted-foreground truncate">
                            {q.email}
                          </div>
                        )}
                      </div>
                      <div className="text-sm">
                        {q.valid_until
                          ? format(new Date(q.valid_until), "PPP")
                          : "—"}
                      </div>
                      <div className="text-sm">
                        <PriceDisplay
                          amount={amount}
                          baseCurrency={baseCurrency}
                          foreignCurrency={foreignCurrency}
                          baseAmount={baseAmount}
                          variant="compact"
                        />
                      </div>
                      <div className="flex justify-end">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setSelectedQuotationId(q.id)}
                        >
                          <Eye className="mr-2 h-4 w-4" />
                          View
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog
        open={!!selectedQuotationId}
        onOpenChange={(open) => {
          if (!open) setSelectedQuotationId(null);
        }}
      >
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto p-0">
          {selectedQuotationId && (
            <QuotationDetails
              quotationId={selectedQuotationId}
              onClose={() => setSelectedQuotationId(null)}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

