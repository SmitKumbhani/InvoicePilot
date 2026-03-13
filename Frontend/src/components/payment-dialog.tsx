"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useApi } from "@/lib/api";
import type { Invoice } from "@/lib/types";
import { formatCurrency } from "@/lib/utils";
import { useState, useEffect } from "react";
import { useLoader } from "@/hooks/use-loader";

type PaymentDialogProps = {
  invoice: Invoice | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function PaymentDialog({ invoice, open, onOpenChange }: PaymentDialogProps) {
  const [amount, setAmount] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();
  const { updateInvoicePayment } = useApi();
  const { showLoader, hideLoader } = useLoader();

  useEffect(() => {
    if (!open) {
      setAmount("");
    }
  }, [open]);

  if (!invoice) return null;

  const amountDue = invoice.total - invoice.amountPaid;

  const handleFullPayment = () => {
    setAmount(amountDue.toString());
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const paymentAmount = parseFloat(amount);
    if (isNaN(paymentAmount) || paymentAmount <= 0 || paymentAmount > amountDue) {
      toast({
        variant: "destructive",
        title: "Invalid Amount",
        description: `Please enter a valid amount between 0.01 and ${formatCurrency(amountDue)}.`,
      });
      return;
    }

    setIsSubmitting(true);
    showLoader();
    try {
      await updateInvoicePayment(invoice.id, paymentAmount);
      toast({
        title: "Payment Recorded",
        description: `Successfully recorded a payment of ${formatCurrency(paymentAmount)}.`,
      });
      onOpenChange(false);
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to record payment.",
      });
    } finally {
      hideLoader();
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Record Payment for {invoice.invoiceNumber}</DialogTitle>
          <DialogDescription>
            Enter the amount paid for this invoice.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4">
            <div className="flex justify-between items-center">
                <div className="text-sm">
                    <p className="text-muted-foreground">Total Amount</p>
                    <p className="font-medium">{formatCurrency(invoice.total)}</p>
                </div>
                <div className="text-sm">
                    <p className="text-muted-foreground">Amount Paid</p>
                    <p className="font-medium">{formatCurrency(invoice.amountPaid)}</p>
                </div>
                <div className="text-sm text-right">
                    <p className="text-muted-foreground">Amount Due</p>
                    <p className="font-semibold text-lg">{formatCurrency(amountDue)}</p>
                </div>
            </div>

            {invoice.status !== 'paid' && (
                 <div className="grid grid-cols-4 items-center gap-4">
                 <Label htmlFor="amount" className="text-right">
                   Payment
                 </Label>
                 <Input
                   id="amount"
                   type="number"
                   value={amount}
                   onChange={(e) => setAmount(e.target.value)}
                   placeholder={amountDue.toFixed(2)}
                   className="col-span-3"
                   step="0.01"
                   max={amountDue}
                 />
               </div>
            )}
          </div>
          {invoice.status !== 'paid' && (
             <DialogFooter>
                <Button type="button" variant="outline" onClick={handleFullPayment} disabled={isSubmitting}>
                    Pay Full Amount
                </Button>
                <Button type="submit" disabled={isSubmitting}>
                    {isSubmitting ? "Saving..." : "Record Payment"}
                </Button>
            </DialogFooter>
          )}
        </form>
      </DialogContent>
    </Dialog>
  );
}
