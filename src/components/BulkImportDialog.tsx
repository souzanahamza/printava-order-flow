import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import Papa from "papaparse";
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
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { Upload, Download, AlertCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";

interface BulkImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface CSVRow {
  sku: string;
  product_code?: string;
  name_ar: string;
  name_en: string;
  category: string;
  unit_price: string;
  image_url?: string;
  description?: string;
  stock_quantity?: string;
}

export const BulkImportDialog = ({
  open,
  onOpenChange,
}: BulkImportDialogProps) => {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [file, setFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [errors, setErrors] = useState<string[]>([]);

  const downloadTemplate = () => {
    const template = `sku,product_code,name_ar,name_en,category,unit_price,image_url,description,stock_quantity
SKU001,PC001,منتج تجريبي,Sample Product,Category A,99.99,https://example.com/image.jpg,Sample description,100
SKU002,PC002,منتج آخر,Another Product,Category B,149.99,https://example.com/image2.jpg,Another description,50`;

    const blob = new Blob([template], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "products_template.csv";
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const validateRow = (row: CSVRow, index: number): string | null => {
    if (!row.sku?.trim()) {
      return `Row ${index + 2}: SKU is required`;
    }
    if (!row.name_ar?.trim()) {
      return `Row ${index + 2}: Arabic name is required`;
    }
    if (!row.name_en?.trim()) {
      return `Row ${index + 2}: English name is required`;
    }
    if (!row.category?.trim()) {
      return `Row ${index + 2}: Category is required`;
    }
    if (!row.unit_price?.trim() || isNaN(parseFloat(row.unit_price))) {
      return `Row ${index + 2}: Valid unit price is required`;
    }
    return null;
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      if (selectedFile.type !== "text/csv" && !selectedFile.name.endsWith(".csv")) {
        toast.error("Please select a CSV file");
        return;
      }
      setFile(selectedFile);
      setErrors([]);
    }
  };

  const handleImport = async () => {
    if (!file) {
      toast.error("Please select a file");
      return;
    }

    setIsProcessing(true);
    setProgress(0);
    setErrors([]);

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        const rows = results.data as CSVRow[];
        const validationErrors: string[] = [];
        const validProducts: any[] = [];

        // Validate all rows
        rows.forEach((row, index) => {
          const error = validateRow(row, index);
          if (error) {
            validationErrors.push(error);
          } else {
            validProducts.push({
              sku: row.sku.trim(),
              product_code: row.product_code?.trim() || null,
              name_ar: row.name_ar.trim(),
              name_en: row.name_en.trim(),
              category: row.category.trim(),
              unit_price: parseFloat(row.unit_price),
              image_url: row.image_url?.trim() || null,
              description: row.description?.trim() || null,
              stock_quantity: row.stock_quantity?.trim()
                ? parseFloat(row.stock_quantity)
                : null,
              company_id: user?.id,
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
          toast.error("No valid products found in CSV");
          setIsProcessing(false);
          return;
        }

        // Insert products in batches
        const batchSize = 100;
        let successCount = 0;
        let failCount = 0;

        for (let i = 0; i < validProducts.length; i += batchSize) {
          const batch = validProducts.slice(i, i + batchSize);
          
          try {
            const { error } = await supabase.from("products").insert(batch);

            if (error) {
              failCount += batch.length;
              console.error("Batch insert error:", error);
            } else {
              successCount += batch.length;
            }
          } catch (error) {
            failCount += batch.length;
            console.error("Batch insert error:", error);
          }

          setProgress(Math.round(((i + batch.length) / validProducts.length) * 100));
        }

        setIsProcessing(false);
        queryClient.invalidateQueries({ queryKey: ["products"] });

        if (successCount > 0) {
          toast.success(`Successfully imported ${successCount} products`);
        }
        if (failCount > 0) {
          toast.error(`Failed to import ${failCount} products`);
        }

        if (successCount > 0) {
          onOpenChange(false);
          setFile(null);
          setProgress(0);
        }
      },
      error: (error) => {
        console.error("CSV parse error:", error);
        toast.error("Failed to parse CSV file");
        setIsProcessing(false);
      },
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Bulk Import Products</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>CSV Template</Label>
            <p className="text-sm text-muted-foreground">
              Download the template CSV file to see the required format
            </p>
            <Button
              type="button"
              variant="outline"
              onClick={downloadTemplate}
              className="w-full"
            >
              <Download className="h-4 w-4 mr-2" />
              Download Template
            </Button>
          </div>

          <div className="space-y-2">
            <Label htmlFor="csv-file">Upload CSV File</Label>
            <Input
              id="csv-file"
              type="file"
              accept=".csv"
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
              <Label>Import Progress</Label>
              <Progress value={progress} />
              <p className="text-sm text-muted-foreground text-center">
                {progress}% Complete
              </p>
            </div>
          )}

          {errors.length > 0 && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                <p className="font-semibold mb-2">Validation Errors:</p>
                <ul className="list-disc list-inside space-y-1 max-h-40 overflow-y-auto">
                  {errors.slice(0, 10).map((error, index) => (
                    <li key={index} className="text-sm">
                      {error}
                    </li>
                  ))}
                  {errors.length > 10 && (
                    <li className="text-sm font-semibold">
                      ... and {errors.length - 10} more errors
                    </li>
                  )}
                </ul>
              </AlertDescription>
            </Alert>
          )}

          <div className="flex justify-end gap-2 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isProcessing}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleImport}
              disabled={!file || isProcessing}
            >
              <Upload className="h-4 w-4 mr-2" />
              {isProcessing ? "Importing..." : "Import Products"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
