import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Plus, Package, Upload, Edit } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { ProductFormDialog } from "@/components/ProductFormDialog";
import { BulkImportDialog } from "@/components/BulkImportDialog";
import { useUserRole } from "@/hooks/useUserRole";
import type { Tables } from "@/integrations/supabase/types";
import { formatCurrency } from "@/utils/formatCurrency";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type Product = Tables<"products">;

const Products = () => {
  const { role, companyId } = useUserRole();
  const canEditProducts = role === 'admin' || role === 'sales' || role === 'accountant';
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isBulkImportOpen, setIsBulkImportOpen] = useState(false);

  // Fetch company profile for currency
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

  const currency = companyProfile?.base_currency?.code;

  const { data: products, isLoading } = useQuery({
    queryKey: ["products"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("*")
        .order("name_en");

      if (error) throw error;
      return (data || []) as (Product & { group_code?: string | null; unit_type?: string | null })[];
    },
  });

  const handleAddProduct = () => {
    setSelectedProduct(null);
    setIsDialogOpen(true);
  };

  const handleEditProduct = (product: Product) => {
    setSelectedProduct(product);
    setIsDialogOpen(true);
  };


  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Products</h1>
          <p className="text-muted-foreground mt-1">
            Manage your product catalog
          </p>
        </div>
        {canEditProducts && (
          <Button onClick={() => setIsBulkImportOpen(true)} variant="outline">
            <Upload className="h-4 w-4 mr-2" />
            Bulk Import
          </Button>
        )}
      </div>

      {isLoading ? (
        <Card>
          <CardContent className="p-6">
            <div className="space-y-4">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          </CardContent>
        </Card>
      ) : !products || products.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Package className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground text-lg mb-2">No products found</p>
            <p className="text-muted-foreground text-sm mb-6">
              Get started by adding your first product
            </p>
            <Button onClick={handleAddProduct}>
              <Plus className="h-4 w-4 mr-2" />
              Add Product
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[60px]">Image</TableHead>
                    <TableHead className="text-right">Group Code</TableHead>
                    <TableHead className="text-right">Group Name</TableHead>
                    <TableHead className="text-right">Item Code</TableHead>
                    <TableHead className="text-right">Item Name</TableHead>
                    <TableHead className="text-right">Unit</TableHead>
                    <TableHead className="text-right font-bold text-base">Price</TableHead>
                    {canEditProducts && <TableHead className="w-[80px] text-center">Actions</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {products.map((product) => {
                    return (
                      <TableRow
                        key={product.id}
                        className={canEditProducts ? "cursor-pointer hover:bg-muted/50" : ""}
                        onClick={canEditProducts ? () => handleEditProduct(product) : undefined}
                      >
                        <TableCell className="w-[60px]">
                          {product.image_url ? (
                            <img
                              src={product.image_url}
                              alt={product.name_en || product.name_ar}
                              className="h-12 w-12 object-cover rounded border"
                            />
                          ) : (
                            <div className="h-12 w-12 bg-muted rounded border flex items-center justify-center">
                              <Package className="h-5 w-5 text-muted-foreground" />
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          {(product as any).group_code || "-"}
                        </TableCell>
                        <TableCell className="text-right">
                          {product.category}
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {product.product_code || "-"}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex flex-col items-end">
                            <span className="font-medium">{product.name_ar}</span>
                            {product.name_en && (
                              <span className="text-xs text-muted-foreground">{product.name_en}</span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          {((product as any).unit_type || "pcs").toUpperCase()}
                        </TableCell>
                        <TableCell className="text-right font-bold text-base text-foreground">
                          {formatCurrency(Number(product.unit_price || 0), currency)}
                        </TableCell>
                        {canEditProducts && (
                          <TableCell className="text-center" onClick={(e) => e.stopPropagation()}>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleEditProduct(product)}
                              className="h-8 w-8 p-0"
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        )}
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Floating Action Button - Only for authorized users */}
      {canEditProducts && (
        <Button
          onClick={handleAddProduct}
          className="fixed bottom-8 right-8 h-14 w-14 rounded-full shadow-lg"
          size="icon"
        >
          <Plus className="h-6 w-6" />
        </Button>
      )}

      {canEditProducts && (
        <>
          <ProductFormDialog
            product={selectedProduct}
            open={isDialogOpen}
            onOpenChange={setIsDialogOpen}
          />

          <BulkImportDialog
            open={isBulkImportOpen}
            onOpenChange={setIsBulkImportOpen}
          />
        </>
      )}
    </div>
  );
};

export default Products;
