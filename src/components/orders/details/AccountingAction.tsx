import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { useConfirmPayment } from "@/hooks/useOrderMutations";
import { formatCurrency } from "@/utils/formatCurrency";

interface AccountingActionProps {
    orderId: string;
    totalPrice: number;
    onSuccess: () => void;
    currency?: string;
}

export function AccountingAction({ orderId, totalPrice, onSuccess, currency = 'AED' }: AccountingActionProps) {
    const [paymentMethod, setPaymentMethod] = useState<string>("");
    const [depositAmount, setDepositAmount] = useState<string>("");
    const confirmPaymentMutation = useConfirmPayment();

    const handleConfirmPayment = () => {
        if (!paymentMethod) {
            toast.error("Please select a payment method");
            return;
        }

        // Validation for advanced (deposit)
        if (paymentMethod === "advanced") {
            const amount = parseFloat(depositAmount);
            if (!depositAmount || isNaN(amount)) {
                toast.error("Please enter a valid deposit amount");
                return;
            }
            if (amount <= 0) {
                toast.error("Deposit amount must be greater than 0");
                return;
            }
            if (amount > totalPrice) {
                toast.error("Deposit amount cannot exceed the total price");
                return;
            }
        }

        // Calculate payment status and paid amount based on method
        let paymentStatus: string;
        let paidAmount: number;

        if (paymentMethod === "cash") {
            paymentStatus = "paid";
            paidAmount = totalPrice;
        } else if (paymentMethod === "advanced") {
            paymentStatus = "partial";
            paidAmount = parseFloat(depositAmount);
        } else { // cod
            paymentStatus = "pending";
            paidAmount = 0;
        }

        confirmPaymentMutation.mutate({
            orderId,
            paymentMethod,
            paymentStatus,
            paidAmount,
            onSuccess: () => {
                setPaymentMethod("");
                setDepositAmount("");
                onSuccess();
            },
        });
    };

    return (
        <Card className="border-emerald-500/50 bg-emerald-50 dark:bg-emerald-950/20">
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                    Payment Verification
                </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
                {/* Payment Selection */}
                <div className="space-y-3">
                    <Label className="text-base font-semibold">Select Payment Method</Label>
                    <RadioGroup
                        value={paymentMethod}
                        onValueChange={setPaymentMethod}
                        className="space-y-3"
                    >
                        <div className="p-4 rounded-lg border bg-card">
                            <div className="flex items-center space-x-3 hover:bg-muted/50 transition-colors cursor-pointer p-2 -m-2 rounded">
                                <RadioGroupItem value="advanced" id="advanced" />
                                <Label htmlFor="advanced" className="cursor-pointer flex-1">
                                    <div className="font-semibold">Advanced</div>
                                    <div className="text-sm text-muted-foreground">Deposit Paid</div>
                                </Label>
                            </div>
                            {paymentMethod === "advanced" && (
                                <div className="mt-4 space-y-2">
                                    <Label htmlFor="depositAmount" className="text-sm">
                                        Deposit Amount
                                    </Label>
                                    <Input
                                        id="depositAmount"
                                        type="number"
                                        min="0"
                                        max={totalPrice}
                                        step="0.01"
                                        placeholder={`Max: ${formatCurrency(totalPrice, currency)}`}
                                        value={depositAmount}
                                        onChange={(e) => setDepositAmount(e.target.value)}
                                        className="w-full"
                                    />
                                </div>
                            )}
                        </div>
                        <div className="flex items-center space-x-3 p-4 rounded-lg border bg-card hover:bg-muted/50 transition-colors cursor-pointer">
                            <RadioGroupItem value="cash" id="cash" />
                            <Label htmlFor="cash" className="cursor-pointer flex-1">
                                <div className="font-semibold">Cash</div>
                                <div className="text-sm text-muted-foreground">Full Amount Paid</div>
                            </Label>
                        </div>
                        <div className="flex items-center space-x-3 p-4 rounded-lg border bg-card hover:bg-muted/50 transition-colors cursor-pointer">
                            <RadioGroupItem value="cod" id="cod" />
                            <Label htmlFor="cod" className="cursor-pointer flex-1">
                                <div className="font-semibold">COD</div>
                                <div className="text-sm text-muted-foreground">Cash on Delivery</div>
                            </Label>
                        </div>
                    </RadioGroup>
                </div>

                {/* Action Button */}
                <Button
                    onClick={handleConfirmPayment}
                    disabled={!paymentMethod || confirmPaymentMutation.isPending}
                    className="w-full bg-emerald-600 hover:bg-emerald-700"
                    size="lg"
                >
                    <CheckCircle2 className="h-5 w-5 mr-2" />
                    {confirmPaymentMutation.isPending
                        ? "Processing..."
                        : "Confirm Payment & Send to Production"}
                </Button>
            </CardContent>
        </Card>
    );
}
