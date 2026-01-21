import { useState, useEffect } from "react";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Plus, Package, Upload, Edit, ChevronLeft, ChevronRight, Search, X, Loader2 } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { ProductFormDialog } from "@/components/ProductFormDialog";
import { BulkImportDialog } from "@/components/BulkImportDialog";
import { useUserRole } from "@/hooks/useUserRole";
import { useDebounce } from "@/hooks/useDebounce";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type Product = Tables<"products">;

const Products = () => {
  const { role, companyId } = useUserRole();
  const canEditProducts = role === 'admin' || role === 'sales' || role === 'accountant';
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isBulkImportOpen, setIsBulkImportOpen] = useState(false);
  
  // Pagination state
  const [page, setPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(20);
  const [searchTerm, setSearchTerm] = useState("");
  
  // Debounce search term for performance (500ms delay)
  const debouncedSearchTerm = useDebounce(searchTerm, 500);

  // Reset to page 1 when debounced search term changes
  useEffect(() => {
    setPage(1);
  }, [debouncedSearchTerm]);

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

  // Calculate range for pagination
  const start = (page - 1) * itemsPerPage;
  const end = start + itemsPerPage - 1;

  const { data: productsData, isLoading, isFetching } = useQuery({
    queryKey: ["products", page, itemsPerPage, debouncedSearchTerm],
    queryFn: async () => {
      let query = supabase
        .from("products")
        .select("*", { count: "exact" })
        .order("name_en");

      // Apply search filter if debouncedSearchTerm exists
      // Search across all relevant columns: name_en, name_ar, product_code, category, group_code, sku
      if (debouncedSearchTerm.trim()) {
        const term = debouncedSearchTerm.trim();
        query = query.or(
          `name_en.ilike.%${term}%,name_ar.ilike.%${term}%,product_code.ilike.%${term}%,category.ilike.%${term}%,group_code.ilike.%${term}%,sku.ilike.%${term}%`
        );
      }

      // Apply pagination range
      query = query.range(start, end);

      const { data, error, count } = await query;

      if (error) throw error;
      return {
        products: (data || []) as (Product & { group_code?: string | null; unit_type?: string | null })[],
        totalCount: count || 0,
      };
    },
    placeholderData: keepPreviousData,
  });

  const products = productsData?.products || [];
  const totalCount = productsData?.totalCount || 0;
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
      <div className="flex flex-col gap-4 sm:flex-row sm:justify-between sm:items-center">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Products</h1>
          <p className="text-muted-foreground mt-1">
            Manage your product catalog
          </p>
        </div>
        <div className="flex items-center gap-3">
          {/* Search Input */}
          <div className="relative w-full sm:w-[300px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by name, code, group..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 pr-9"
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
          {canEditProducts && (
            <Button onClick={() => setIsBulkImportOpen(true)} variant="outline">
              <Upload className="h-4 w-4 mr-2" />
              Bulk Import
            </Button>
          )}
        </div>
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
            <p className="text-muted-foreground text-lg mb-2">
              {debouncedSearchTerm ? "No products match your search" : "No products found"}
            </p>
            <p className="text-muted-foreground text-sm mb-6">
              {debouncedSearchTerm 
                ? `Try adjusting your search term "${debouncedSearchTerm}"`
                : "Get started by adding your first product"
              }
            </p>
            {debouncedSearchTerm ? (
              <Button variant="outline" onClick={() => setSearchTerm("")}>
                <X className="h-4 w-4 mr-2" />
                Clear Search
              </Button>
            ) : (
              <Button onClick={handleAddProduct}>
                <Plus className="h-4 w-4 mr-2" />
                Add Product
              </Button>
            )}
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
                  {isFetching && !isLoading ? (
                    // Show loading overlay when fetching (e.g., search/pagination)
                    <TableRow>
                      <TableCell colSpan={canEditProducts ? 8 : 7} className="h-48">
                        <div className="flex flex-col items-center justify-center gap-2">
                          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                          <span className="text-sm text-muted-foreground">Searching products...</span>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : (
                    products.map((product) => {
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
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
          
          {/* Pagination Controls */}
          <CardFooter className="flex flex-col sm:flex-row items-center justify-between gap-4 py-4 px-6 border-t">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span>Showing {start + 1}-{Math.min(end + 1, totalCount)} of {totalCount} products</span>
              {isFetching && !isLoading && (
                <span className="text-xs text-muted-foreground">(Loading...)</span>
              )}
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
                    <SelectItem value="100">100</SelectItem>
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
