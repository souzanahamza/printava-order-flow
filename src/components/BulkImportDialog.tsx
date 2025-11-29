import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import * as XLSX from "xlsx";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useUserRole } from "@/hooks/useUserRole";
import { toast } from "sonner";
import { Upload, Download, AlertCircle, FileSpreadsheet } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";

interface BulkImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// تعريف شكل البيانات
interface ProductRow {
  sku: string;
  product_code?: string;
  name_ar: string;
  name_en: string;
  category: string;
  unit_price: string | number;
  image_url?: string;
  description?: string;
  stock_quantity?: string | number;
}

// دالة لتنظيف الأرقام
const parseCleanFloat = (val: string | number | undefined): number => {
  if (val === undefined || val === null) return 0;
  if (typeof val === 'number') return val;
  const clean = String(val).replace(/[$,\s]/g, "");
  const parsed = parseFloat(clean);
  return isNaN(parsed) ? 0 : parsed;
};

export const BulkImportDialog = ({
  open,
  onOpenChange,
}: BulkImportDialogProps) => {
  const queryClient = useQueryClient();
  const { companyId } = useUserRole();
  const [file, setFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [errors, setErrors] = useState<string[]>([]);

  // ============================================================
  // 2. الدوال المساعدة (Helper Functions)
  // ============================================================

  const downloadTemplate = () => {
    const data = [
      {
        sku: "SKU001",
        product_code: "PC001",
        name_ar: "منتج تجريبي",
        name_en: "Sample Product",
        category: "Category A",
        unit_price: 99.99,
        stock_quantity: 100,
        description: "وصف المنتج هنا",
        image_url: "https://example.com/image.jpg"
      },
      {
        sku: "SKU002",
        product_code: "PC002",
        name_ar: "منتج آخر",
        name_en: "Another Product",
        category: "Category B",
        unit_price: 150.00,
        stock_quantity: 50,
        description: "وصف آخر",
        image_url: ""
      }
    ];

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Products Template");
    XLSX.writeFile(wb, "printava_products_template.xlsx");
  };

  const validateRow = (row: ProductRow, index: number): string | null => {
    if (!row.sku?.toString().trim()) return `Row ${index + 2}: SKU is required`;
    if (!row.name_ar?.toString().trim()) return `Row ${index + 2}: Arabic name is required`;
    if (!row.name_en?.toString().trim()) return `Row ${index + 2}: English name is required`;
    
    const price = parseCleanFloat(row.unit_price);
    if (price <= 0) return `Row ${index + 2}: Valid unit price is required`;
    
    return null;
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      const validExtensions = ['.xlsx', '.xls'];
      const hasValidExt = validExtensions.some(ext => selectedFile.name.toLowerCase().endsWith(ext));

      if (!hasValidExt) {
        toast.error("Please select an Excel file (.xlsx or .xls)");
        return;
      }
      setFile(selectedFile);
      setErrors([]);
    }
  };

  const processData = async (rawData: any[]) => {
    const validationErrors: string[] = [];
    const validProducts: any[] = [];

    rawData.forEach((row, index) => {
      // تعيين البيانات بغض النظر عن حالة الأحرف (Uppercase/Lowercase)
      const cleanRow: ProductRow = {
        sku: row.sku || row.SKU,
        product_code: row.product_code || row.PRODUCT_CODE,
        name_ar: row.name_ar || row.NAME_AR,
        name_en: row.name_en || row.NAME_EN,
        category: row.category || row.CATEGORY || 'General',
        unit_price: row.unit_price || row.UNIT_PRICE,
        image_url: row.image_url || row.IMAGE_URL,
        description: row.description || row.DESCRIPTION,
        stock_quantity: row.stock_quantity || row.STOCK_QUANTITY
      };

      const error = validateRow(cleanRow, index);
      if (error) {
        validationErrors.push(error);
      } else {
        validProducts.push({
          sku: cleanRow.sku.toString().trim(),
          product_code: cleanRow.product_code?.toString().trim() || null,
          name_ar: cleanRow.name_ar.toString().trim(),
          name_en: cleanRow.name_en.toString().trim(),
          category: cleanRow.category.toString().trim(),
          unit_price: parseCleanFloat(cleanRow.unit_price),
          image_url: cleanRow.image_url?.toString().trim() || null,
          description: cleanRow.description?.toString().trim() || null,
          stock_quantity: parseCleanFloat(cleanRow.stock_quantity),
          company_id: companyId,
        });
      }
    });

    if (validationErrors.length > 0) {
      setErrors(validationErrors);
      setIsProcessing(false);
      toast.error(`Found ${validationErrors.length} validation errors`);
      return;
    }

    if (validProducts.length === 0) {
      toast.error("No valid products found");
      setIsProcessing(false);
      return;
    }

    // التحقق من التكرار
    const skus = validProducts.map(p => p.sku);
    const { data: existingProducts } = await supabase
      .from("products")
      .select("sku")
      .eq("company_id", companyId)
      .in("sku", skus);

    const existingSKUs = new Set(existingProducts?.map(p => p.sku) || []);
    const newProducts = validProducts.filter(p => !existingSKUs.has(p.sku));
    const skippedCount = validProducts.length - newProducts.length;

    if (newProducts.length === 0) {
      toast.info("All products already exist");
      setIsProcessing(false);
      return;
    }

    // الإدخال (Batches)
    const batchSize = 50;
    let successCount = 0;
    let failCount = 0;
    let lastErrorMessage = "";

    for (let i = 0; i < newProducts.length; i += batchSize) {
      const batch = newProducts.slice(i, i + batchSize);
      try {
        const { error } = await supabase.from("products").insert(batch);
        if (error) {
          failCount += batch.length;
          lastErrorMessage = error.message;
        } else {
          successCount += batch.length;
        }
      } catch (error: any) {
        failCount += batch.length;
        lastErrorMessage = error.message;
      }
      setProgress(Math.round(((i + batch.length) / newProducts.length) * 100));
    }

    setIsProcessing(false);
    queryClient.invalidateQueries({ queryKey: ["products"] });

    if (successCount > 0) {
      toast.success(`Imported ${successCount} products successfully`);
      onOpenChange(false);
      setFile(null);
      setProgress(0);
    }
    
    if (skippedCount > 0) toast.warning(`Skipped ${skippedCount} duplicates`);
    if (failCount > 0) toast.error(`Failed: ${lastErrorMessage}`);
  };

  const handleImport = async () => {
    if (!file) {
      toast.error("Please select a file");
      return;
    }
    if (!companyId) {
      toast.error("Company ID error. Re-login required.");
      return;
    }

    setIsProcessing(true);
    setProgress(10);
    setErrors([]);

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: 'binary' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet);
        processData(jsonData);
      } catch (err) {
        console.error(err);
        toast.error("Failed to parse Excel file");
        setIsProcessing(false);
      }
    };
    reader.readAsBinaryString(file);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Bulk Import Products</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Template</Label>
            <p className="text-sm text-muted-foreground">
              Download the Excel template to ensure correct format.
            </p>
            <Button
              type="button"
              variant="outline"
              onClick={downloadTemplate}
              className="w-full gap-2"
            >
              <FileSpreadsheet className="h-4 w-4 text-green-600" />
              Download Excel Template (.xlsx)
            </Button>
          </div>

          <div className="space-y-2">
            <Label htmlFor="file">Upload File</Label>
            <Input
              id="file"
              type="file"
              accept=".xlsx, .xls"
              onChange={handleFileChange}
              disabled={isProcessing}
            />
            {file && (
              <p className="text-sm text-muted-foreground">
                Selected: {file.name}
              </p>
            )}
          </div>

          {isProcessing && (
            <div className="space-y-2">
              <Label>Processing...</Label>
              <Progress value={progress} />
            </div>
          )}

          {errors.length > 0 && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                <ul className="list-disc list-inside max-h-40 overflow-y-auto">
                  {errors.slice(0, 10).map((e, i) => <li key={i} className="text-sm">{e}</li>)}
                </ul>
              </AlertDescription>
            </Alert>
          )}

          <div className="flex justify-end gap-2 pt-4">
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isProcessing}>
              Cancel
            </Button>
            <Button onClick={handleImport} disabled={!file || isProcessing}>
              <Upload className="h-4 w-4 mr-2" />
              Import Products
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
