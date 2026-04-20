import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useUserRole } from "@/hooks/useUserRole"; 
import { toast } from "sonner";
import type { Tables } from "@/integrations/supabase/types";
import { X, Upload as UploadIcon } from "lucide-react";

type Product = Tables<"products">;

interface ProductFormDialogProps {
  product: Product | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const ProductFormDialog = ({
  product,
  open,
  onOpenChange,
}: ProductFormDialogProps) => {
  const queryClient = useQueryClient();
  const { companyId } = useUserRole(); 
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  
  const [formData, setFormData] = useState({
    sku: "",
    product_code: "",
    name_ar: "",
    name_en: "",
    category: "",
    unit_price: "",
    unit_type: "pcs",
    group_code: "",
    image_url: "",
    description: "",
    stock_quantity: "",
  });

  useEffect(() => {
    if (product) {
      setFormData({
        sku: product.sku || "",
        product_code: product.product_code || "",
        name_ar: product.name_ar || "",
        name_en: product.name_en || "",
        category: product.category || "",
        unit_price: String(product.unit_price || ""),
        unit_type: (product.unit_type as string) || "pcs",
        group_code: (product.group_code as string) || "",
        image_url: product.image_url || "",
        description: product.description || "",
        stock_quantity: String(product.stock_quantity || ""),
      });
      setImagePreview(product.image_url || null);
      setImageFile(null);
    } else {
      setFormData({
        sku: "",
        product_code: "",
        name_ar: "",
        name_en: "",
        category: "",
        unit_price: "",
        unit_type: "pcs",
        group_code: "",
        image_url: "",
        description: "",
        stock_quantity: "",
      });
      setImagePreview(null);
      setImageFile(null);
    }
  }, [product, open]);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    setFormData((prev) => ({
      ...prev,
      [e.target.name]: e.target.value,
    }));
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast.error("Please select an image file");
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Image size must be less than 5MB");
      return;
    }

    setImageFile(file);
    
    // Create preview
    const reader = new FileReader();
    reader.onloadend = () => {
      setImagePreview(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveImage = () => {
    setImageFile(null);
    setImagePreview(null);
    setFormData((prev) => ({ ...prev, image_url: "" }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!companyId) {
      toast.error("Company ID not found. Please try logging in again.");
      return;
    }

    setIsSubmitting(true);
    let finalImageUrl = formData.image_url || null;

    try {
      // Upload image if a new file was selected
      if (imageFile) {
        setIsUploadingImage(true);
        
        // Generate unique filename: product_{sku}_{timestamp}.ext
        const fileExt = imageFile.name.split('.').pop()?.toLowerCase() || 'jpg';
        const sanitizedSku = formData.sku.replace(/[^a-zA-Z0-9]/g, '_');
        const timestamp = Date.now();
        const fileName = `product_${sanitizedSku}_${timestamp}.${fileExt}`;
        const filePath = `${companyId}/${fileName}`;

        // Upload to Supabase Storage
        const { error: uploadError } = await supabase.storage
          .from('product-images')
          .upload(filePath, imageFile, {
            cacheControl: '3600',
            upsert: false
          });

        if (uploadError) {
          // If file already exists, try with a different name
          if (uploadError.message.includes('already exists')) {
            const uniqueFileName = `product_${sanitizedSku}_${timestamp}_${Math.random().toString(36).substring(7)}.${fileExt}`;
            const uniqueFilePath = `${companyId}/${uniqueFileName}`;
            
            const { error: retryError } = await supabase.storage
              .from('product-images')
              .upload(uniqueFilePath, imageFile);
            
            if (retryError) throw retryError;
            
            const { data: { publicUrl } } = supabase.storage
              .from('product-images')
              .getPublicUrl(uniqueFilePath);
            
            finalImageUrl = publicUrl;
          } else {
            throw uploadError;
          }
        } else {
          // Get public URL
          const { data: { publicUrl } } = supabase.storage
            .from('product-images')
            .getPublicUrl(filePath);
          
          finalImageUrl = publicUrl;
        }

        setIsUploadingImage(false);
      }

      const productData = {
        sku: formData.sku,
        product_code: formData.product_code,
        name_ar: formData.name_ar,
        name_en: formData.name_en,
        category: formData.category,
        unit_price: parseFloat(formData.unit_price),
        unit_type: formData.unit_type || "pcs",
        group_code: formData.group_code || null,
        image_url: finalImageUrl,
        description: formData.description || null,
        stock_quantity: formData.stock_quantity
          ? parseFloat(formData.stock_quantity)
          : null,
      };

      if (product) {
        // Update existing product
        const { error } = await supabase
          .from("products")
          .update(productData)
          .eq("id", product.id);

        if (error) throw error;
        toast.success("Product updated successfully");
      } else {
        // Create new product
        const { error } = await supabase.from("products").insert({
          ...productData,
          company_id: companyId, 
        });

        if (error) throw error;
        toast.success("Product created successfully");
      }

      queryClient.invalidateQueries({ queryKey: ["products"] });
      onOpenChange(false);
    } catch (error: any) {
      console.error("Error saving product:", error);
      toast.error(`Failed to save product: ${error.message || "Unknown error"}`);
    } finally {
      setIsSubmitting(false);
      setIsUploadingImage(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {product ? "Edit Product" : "Add New Product"}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="sku">SKU *</Label>
              <Input
                id="sku"
                name="sku"
                value={formData.sku}
                onChange={handleChange}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="product_code">Product Code *</Label>
              <Input
                id="product_code"
                name="product_code"
                value={formData.product_code}
                onChange={handleChange}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="name_en">Name (English) *</Label>
              <Input
                id="name_en"
                name="name_en"
                value={formData.name_en}
                onChange={handleChange}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="name_ar">Name (Arabic) *</Label>
              <Input
                id="name_ar"
                name="name_ar"
                value={formData.name_ar}
                onChange={handleChange}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="group_code">Group Code</Label>
              <Input
                id="group_code"
                name="group_code"
                value={formData.group_code}
                onChange={handleChange}
                placeholder="G001"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="category">Group Name *</Label>
              <Input
                id="category"
                name="category"
                value={formData.category}
                onChange={handleChange}
                placeholder="اسم المجموعة"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="unit_type">Unit Type *</Label>
              <select
                id="unit_type"
                name="unit_type"
                value={formData.unit_type}
                onChange={handleChange}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                required
              >
                <option value="pcs">Pieces (pcs)</option>
                <option value="kg">Kilogram (kg)</option>
                <option value="m">Meter (m)</option>
                <option value="box">Box</option>
                <option value="roll">Roll</option>
                <option value="set">Set</option>
                <option value="pack">Pack</option>
              </select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="unit_price">Unit Price *</Label>
              <Input
                id="unit_price"
                name="unit_price"
                type="number"
                step="0.01"
                min="0"
                value={formData.unit_price}
                onChange={handleChange}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="stock_quantity">Stock Quantity</Label>
              <Input
                id="stock_quantity"
                name="stock_quantity"
                type="number"
                step="0.01"
                min="0"
                value={formData.stock_quantity}
                onChange={handleChange}
              />
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="image">Product Image</Label>
              <div className="space-y-2">
                {imagePreview && (
                  <div className="relative inline-block">
                    <img
                      src={imagePreview}
                      alt="Product preview"
                      className="h-32 w-32 object-cover rounded-md border"
                    />
                    <Button
                      type="button"
                      variant="destructive"
                      size="sm"
                      className="absolute -top-2 -right-2 h-6 w-6 rounded-full p-0"
                      onClick={handleRemoveImage}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <Input
                    id="image"
                    name="image"
                    type="file"
                    accept="image/*"
                    onChange={handleImageChange}
                    disabled={isUploadingImage || isSubmitting}
                    className="cursor-pointer"
                  />
                  {isUploadingImage && (
                    <span className="text-sm text-muted-foreground">Uploading...</span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  Upload an image file (max 5MB). Supported formats: JPG, PNG, GIF, WebP
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              name="description"
              value={formData.description}
              onChange={handleChange}
              rows={4}
            />
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting || isUploadingImage}>
              {isSubmitting || isUploadingImage
                ? product
                  ? "Updating..."
                  : "Creating..."
                : product
                ? "Update Product"
                : "Create Product"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};