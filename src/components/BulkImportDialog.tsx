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
  // اسم المجموعة (Group Name)
  category?: string;
  // رمز المجموعة (Group Code)
  group_code?: string;
  // كود المنتج
  product_code?: string;
  // SKU (يمكن أن يُترك فارغاً وسيُولَّد تلقائياً)
  sku?: string;
  // الاسم الإنجليزي (الحقل الإجباري الوحيد)
  name_en: string;
  // الاسم العربي (اختياري)
  name_ar?: string;
  // السعر
  unit_price?: string | number;
  // الكمية في المخزون
  stock_quantity?: string | number;
  // الوصف
  description?: string;
  // رابط الصورة
  image_url?: string;
}

// دالة لتنظيف الأرقام مع تقريب قياسي إلى منزلتين عشريتين
const parseCleanFloat = (val: string | number | undefined): number => {
  if (val === undefined || val === null) return 0;

  const num =
    typeof val === "number"
      ? val
      : parseFloat(String(val).replace(/[$,\s]/g, ""));

  if (isNaN(num)) return 0;

  // تقريب قياسي إلى منزلتين عشريتين (مثال: 0.819 -> 0.82)
  return Math.round(num * 100) / 100;
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
        // Group Name
        group: "Group A",
        // Group Code
        group_code: "GRP001",
        // Product Code
        product_code: "PC001",
        // SKU (اختياري)
        sku: "SKU001",
        // English Name (Required)
        name_en: "Sample Product",
        // Arabic Name (Optional)
        name_ar: "منتج تجريبي",
        // Price
        unit_price: 99.99,
        // Stock Quantity
        stock_quantity: 100,
        // Description
        description: "وصف المنتج هنا",
        // Image URL
        image_url: "https://example.com/image.jpg",
      },
      {
        group: "Group B",
        group_code: "GRP002",
        product_code: "PC002",
        sku: "SKU002",
        name_en: "Another Product",
        name_ar: "منتج آخر",
        unit_price: 150.00,
        stock_quantity: 50,
        description: "وصف آخر",
        image_url: "",
      }
    ];

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Products Template");
    XLSX.writeFile(wb, "printava_products_template.xlsx");
  };

  const validateRow = (row: ProductRow, index: number): string | null => {
    if (!row.name_en?.toString().trim()) return `Row ${index + 2}: English name is required`;
    
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
    const productSources: any[] = []; // للاحتفاظ بالصف الأصلي لمعرفة أي الحقول أدخلها المستخدم

    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/86053404-94d6-4153-97ad-12061c9babe8', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId: 'debug-session',
        runId: 'pre-fix',
        hypothesisId: 'H1',
        location: 'src/components/BulkImportDialog.tsx:processData:start',
        message: 'processData start',
        data: { rawLength: rawData.length, companyId },
        timestamp: Date.now(),
      }),
    }).catch(() => {});
    // #endregion

    rawData.forEach((row, index) => {
      // تعيين البيانات بغض النظر عن حالة الأحرف (Uppercase/Lowercase)
      const cleanRow: ProductRow = {
        // Group Name -> نربطها بـ category في قاعدة البيانات
        category: row.group || row.GROUP || row.category || row.CATEGORY || 'General',
        // Group Code
        group_code: row.group_code || row.GROUP_CODE,
        // Product Code
        product_code: row.product_code || row.PRODUCT_CODE,
        // SKU
        sku: row.sku || row.SKU,
        // English Name (required)
        name_en: row.name_en || row.NAME_EN,
        // Arabic Name
        name_ar: row.name_ar || row.NAME_AR,
        // Price
        unit_price: row.unit_price || row.UNIT_PRICE || 0,
        // Stock Quantity
        stock_quantity: row.stock_quantity || row.STOCK_QUANTITY,
        // Description
        description: row.description || row.DESCRIPTION,
        // Image URL
        image_url: row.image_url || row.IMAGE_URL,
      };

      const error = validateRow(cleanRow, index);
      if (error) {
        validationErrors.push(error);
      } else {
        // إنشاء SKU تلقائياً إذا لم يتم توفيره
        const skuValue = cleanRow.sku?.toString().trim();
        const generatedSku =
          skuValue ||
          `AUTO-${Date.now()}-${Math.random()
            .toString(36)
            .substring(2, 9)
            .toUpperCase()}`;

        const productForDb = {
          // Group & Group Code
          category: cleanRow.category?.toString().trim() || "General",
          group_code: cleanRow.group_code?.toString().trim() || null,
          // Product identifiers
          product_code: cleanRow.product_code?.toString().trim() || null,
          sku: generatedSku,
          // Names
          name_en: cleanRow.name_en.toString().trim(),
          name_ar: cleanRow.name_ar?.toString().trim() || null,
          // Pricing & stock
          unit_price: parseCleanFloat(cleanRow.unit_price),
          stock_quantity: parseCleanFloat(cleanRow.stock_quantity),
          // Extra info
          description: cleanRow.description?.toString().trim() || null,
          image_url: cleanRow.image_url?.toString().trim() || null,
          // Company
          company_id: companyId,
        };

        validProducts.push(productForDb);
        productSources.push(row);
      }
    });

    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/86053404-94d6-4153-97ad-12061c9babe8', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId: 'debug-session',
        runId: 'pre-fix',
        hypothesisId: 'H2',
        location: 'src/components/BulkImportDialog.tsx:processData:afterBuild',
        message: 'After building validProducts',
        data: { validationErrors: validationErrors.length, validProducts: validProducts.length },
        timestamp: Date.now(),
      }),
    }).catch(() => {});
    // #endregion

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

    // ============================================================
    // التحقق من التكرار بناءً على product_code + خيار تحديث الحقول
    // ============================================================

    // المنتجات التي لديها product_code
    const productsWithCode = validProducts
      .map((p, idx) => ({ product: p, source: productSources[idx] }))
      .filter((x) => x.product.product_code);

    const productCodes = productsWithCode
      .map((x) => x.product.product_code as string)
      .filter((code) => !!code);

    let existingByCode = new Map<string, string>(); // product_code -> id

    if (productCodes.length > 0) {
      const { data: existingProducts, error: existingError } = await supabase
        .from("products")
        .select("id, product_code")
        .eq("company_id", companyId)
        .in("product_code", productCodes);

      if (existingError) {
        toast.error("Failed to check existing products");
        setIsProcessing(false);
        return;
      }

      existingByCode = new Map(
        (existingProducts || [])
          .filter((p) => p.product_code)
          .map((p) => [p.product_code as string, p.id as string])
      );
    }

    // تقسيم المنتجات إلى جديدة ومكررة حسب product_code
    const duplicateProducts = productsWithCode.filter((x) =>
      existingByCode.has(x.product.product_code as string)
    );

    const newProducts = validProducts.filter(
      (p) => !p.product_code || !existingByCode.has(p.product_code as string)
    );

    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/86053404-94d6-4153-97ad-12061c9babe8', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId: 'debug-session',
        runId: 'pre-fix',
        hypothesisId: 'H3',
        location: 'src/components/BulkImportDialog.tsx:processData:dedupe',
        message: 'After computing duplicates/new',
        data: {
          productCodes: productCodes.length,
          existingByCodeSize: existingByCode.size,
          duplicateProducts: duplicateProducts.length,
          newProducts: newProducts.length,
        },
        timestamp: Date.now(),
      }),
    }).catch(() => {});
    // #endregion

    if (newProducts.length === 0 && duplicateProducts.length === 0) {
      toast.info("No products to import");
      setIsProcessing(false);
      return;
    }

    // سؤال المستخدم إن كان يريد تحديث المنتجات المكررة
    let shouldUpdateDuplicates = false;
    if (duplicateProducts.length > 0) {
      shouldUpdateDuplicates = window.confirm(
        `${duplicateProducts.length} products already exist with the same product code. Do you want to update their details (only for fields provided in the file)?`
      );
    }

    // ============================================================
    // 1) إدخال المنتجات الجديدة (insert)
    // ============================================================
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
      const totalOps =
        newProducts.length +
        (shouldUpdateDuplicates ? duplicateProducts.length : 0);
      setProgress(
        Math.round(
          ((i + batch.length) / Math.max(totalOps, 1)) * 100
        )
      );
    }

    // ============================================================
    // 2) تحديث المنتجات المكررة (update فقط للحقول الموجودة في الملف)
    // ============================================================
    if (shouldUpdateDuplicates && duplicateProducts.length > 0) {
      for (let i = 0; i < duplicateProducts.length; i += batchSize) {
        const batch = duplicateProducts.slice(i, i + batchSize);

        for (let j = 0; j < batch.length; j++) {
          const { product, source } = batch[j];
          const productCode = product.product_code as string;
          const productId = existingByCode.get(productCode);
          if (!productId) continue;

          const updateData: any = {};

          // نحدّد الحقول التي أدخلها المستخدم فعلاً في ملف الإكسل
          const hasGroup =
            source.group !== undefined ||
            source.GROUP !== undefined ||
            source.category !== undefined ||
            source.CATEGORY !== undefined;
          const hasGroupCode =
            source.group_code !== undefined ||
            source.GROUP_CODE !== undefined;
          const hasProductCode =
            source.product_code !== undefined ||
            source.PRODUCT_CODE !== undefined;
          const hasSku =
            source.sku !== undefined || source.SKU !== undefined;
          const hasNameEn =
            source.name_en !== undefined || source.NAME_EN !== undefined;
          const hasNameAr =
            source.name_ar !== undefined || source.NAME_AR !== undefined;
          const hasUnitPrice =
            source.unit_price !== undefined ||
            source.UNIT_PRICE !== undefined;
          const hasStockQty =
            source.stock_quantity !== undefined ||
            source.STOCK_QUANTITY !== undefined;
          const hasDescription =
            source.description !== undefined ||
            source.DESCRIPTION !== undefined;
          const hasImageUrl =
            source.image_url !== undefined || source.IMAGE_URL !== undefined;

          // #region agent log
          if (i === 0 && j === 0) {
            fetch('http://127.0.0.1:7242/ingest/86053404-94d6-4153-97ad-12061c9babe8', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                sessionId: 'debug-session',
                runId: 'pre-fix',
                hypothesisId: 'H4',
                location: 'src/components/BulkImportDialog.tsx:processData:updateFirstDuplicate',
                message: 'First duplicate flags',
                data: {
                  hasGroup,
                  hasGroupCode,
                  hasProductCode,
                  hasSku,
                  hasNameEn,
                  hasNameAr,
                  hasUnitPrice,
                  hasStockQty,
                  hasDescription,
                  hasImageUrl,
                },
                timestamp: Date.now(),
              }),
            }).catch(() => {});
          }
          // #endregion

          if (hasGroup) updateData.category = product.category;
          if (hasGroupCode) updateData.group_code = product.group_code;
          if (hasProductCode) updateData.product_code = product.product_code;
          if (hasSku) updateData.sku = product.sku;
          if (hasNameEn) updateData.name_en = product.name_en;
          if (hasNameAr) updateData.name_ar = product.name_ar;
          if (hasUnitPrice) updateData.unit_price = product.unit_price;
          if (hasStockQty) updateData.stock_quantity = product.stock_quantity;
          if (hasDescription) updateData.description = product.description;
          if (hasImageUrl) updateData.image_url = product.image_url;

          // لو ما في ولا حقل تم إدخاله، ما في داعي نعمل update
          if (Object.keys(updateData).length === 0) continue;

          try {
            const { error } = await supabase
              .from("products")
              .update(updateData)
              .eq("id", productId)
              .eq("company_id", companyId);

            if (error) {
              failCount += 1;
              lastErrorMessage = error.message;
            } else {
              successCount += 1;
            }
          } catch (error: any) {
            failCount += 1;
            lastErrorMessage = error.message;
          }
        }
      }
    }

    setIsProcessing(false);
    queryClient.invalidateQueries({ queryKey: ["products"] });

    if (successCount > 0) {
      const insertedCount = newProducts.length;
      const updatedCount =
        shouldUpdateDuplicates && duplicateProducts.length > 0
          ? duplicateProducts.length
          : 0;

      toast.success(
        `Successfully processed ${successCount} products` +
          (insertedCount > 0 ? ` (${insertedCount} inserted)` : "") +
          (updatedCount > 0 ? ` (${updatedCount} updated)` : "")
      );
      onOpenChange(false);
      setFile(null);
      setProgress(0);
    }

    if (!shouldUpdateDuplicates && duplicateProducts.length > 0) {
      toast.warning(
        `Skipped ${duplicateProducts.length} existing products with the same product code`
      );
    }

    if (failCount > 0) toast.error(`Failed operations: ${lastErrorMessage}`);

    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/86053404-94d6-4153-97ad-12061c9babe8', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId: 'debug-session',
        runId: 'pre-fix',
        hypothesisId: 'H5',
        location: 'src/components/BulkImportDialog.tsx:processData:end',
        message: 'processData end summary',
        data: {
          successCount,
          failCount,
          newProducts: newProducts.length,
          duplicateProducts: duplicateProducts.length,
          shouldUpdateDuplicates,
        },
        timestamp: Date.now(),
      }),
    }).catch(() => {});
    // #endregion
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
