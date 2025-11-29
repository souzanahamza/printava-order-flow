import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { useConfirmPayment } from "@/hooks/useOrderMutations";

interface AccountingActionProps {
    orderId: string;
    onSuccess: () => void;
}

export function AccountingAction({ orderId, onSuccess }: AccountingActionProps) {
    const [paymentMethod, setPaymentMethod] = useState<string>("");
    const confirmPaymentMutation = useConfirmPayment();

    const handleConfirmPayment = () => {
        if (!paymentMethod) {
            toast.error("Please select a payment method");
            return;
        }
        confirmPaymentMutation.mutate({
            orderId,
            paymentMethod,
            onSuccess: () => {
                setPaymentMethod("");
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
                        <div className="flex items-center space-x-3 p-4 rounded-lg border bg-card hover:bg-muted/50 transition-colors cursor-pointer">
                            <RadioGroupItem value="advanced" id="advanced" />
                            <Label htmlFor="advanced" className="cursor-pointer flex-1">
                                <div className="font-semibold">Advanced</div>
                                <div className="text-sm text-muted-foreground">Deposit Paid</div>
                            </Label>
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
