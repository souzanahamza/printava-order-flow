import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Plus, Package, Upload } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { ProductFormDialog } from "@/components/ProductFormDialog";
import { BulkImportDialog } from "@/components/BulkImportDialog";
import { useUserRole } from "@/hooks/useUserRole";
import type { Tables } from "@/integrations/supabase/types";
import { formatCurrency } from "@/utils/formatCurrency";

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
        .select("currency")
        .eq("id", companyId)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!companyId,
  });

  const currency = companyProfile?.currency || 'AED';

  const { data: products, isLoading } = useQuery({
    queryKey: ["products"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("*")
        .order("name_en");
      
      if (error) throw error;
      return data as Product[];
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

  const truncateText = (text: string | null, maxLength: number) => {
    if (!text) return "";
    return text.length > maxLength ? text.slice(0, maxLength) + "..." : text;
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
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[...Array(6)].map((_, i) => (
            <Card key={i}>
              <CardContent className="p-6">
                <Skeleton className="h-48 w-full mb-4" />
                <Skeleton className="h-6 w-3/4 mb-2" />
                <Skeleton className="h-4 w-1/2 mb-4" />
                <Skeleton className="h-4 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
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
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {products.map((product) => (
            <Card
              key={product.id}
              className={canEditProducts ? "hover:shadow-lg transition-shadow cursor-pointer" : ""}
              onClick={canEditProducts ? () => handleEditProduct(product) : undefined}
            >
              <CardContent className="p-6">
                {product.image_url ? (
                  <img
                    src={product.image_url}
                    alt={product.name_en}
                    className="w-full h-48 object-cover rounded-md mb-4"
                  />
                ) : (
                  <div className="w-full h-48 bg-muted rounded-md mb-4 flex items-center justify-center">
                    <Package className="h-12 w-12 text-muted-foreground" />
                  </div>
                )}
                
                <div className="space-y-2">
                  <div>
                    <h3 className="font-semibold text-lg text-foreground">
                      {product.name_en}
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      {product.name_ar}
                    </p>
                  </div>

                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">SKU:</span>
                    <span className="font-medium text-foreground">{product.sku}</span>
                  </div>

                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Category:</span>
                    <span className="font-medium text-foreground">{product.category}</span>
                  </div>

                  {canEditProducts && (
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Price:</span>
                      <span className="font-semibold text-primary">
                        {formatCurrency(Number(product.unit_price), currency)}
                      </span>
                    </div>
                  )}

                  {product.description && (
                    <p className="text-sm text-muted-foreground mt-3">
                      {truncateText(product.description, 100)}
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
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
