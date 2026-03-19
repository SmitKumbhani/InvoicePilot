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
  onPaymentRecorded?: (invoice: Invoice) => void;
};

export function PaymentDialog({ invoice, open, onOpenChange, onPaymentRecorded }: PaymentDialogProps) {
  const [amount, setAmount] = useState("");
  const [correctedAmount, setCorrectedAmount] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();
  const { updateInvoicePayment, setInvoicePaidAmount } = useApi();
  const { showLoader, hideLoader } = useLoader();

  useEffect(() => {
    if (!invoice) return;
    if (!open) {
      setAmount("");
      setCorrectedAmount("");
      return;
    }
    setCorrectedAmount(invoice.amountPaid.toString());
  }, [open, invoice]);

  if (!invoice) return null;

  const amountDue = Math.max(invoice.total - invoice.amountPaid, 0);
  const canRecordPayment = invoice.status !== "paid" && amountDue > 0;

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
      const updatedInvoice = await updateInvoicePayment(invoice.id, paymentAmount);
      onPaymentRecorded?.(updatedInvoice);
      toast({
        title: "Payment Recorded",
        description: `Successfully recorded a payment of ${formatCurrency(paymentAmount)}.`,
      });
      onOpenChange(false);
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to record payment.",
      });
    } finally {
      hideLoader();
      setIsSubmitting(false);
    }
  };

  const handleCorrectAmount = async () => {
    const nextPaidAmount = parseFloat(correctedAmount);
    if (isNaN(nextPaidAmount) || nextPaidAmount < 0 || nextPaidAmount > invoice.total) {
      toast({
        variant: "destructive",
        title: "Invalid Amount",
        description: `Enter a value between 0 and ${formatCurrency(invoice.total)}.`,
      });
      return;
    }

    setIsSubmitting(true);
    showLoader();
    try {
      const updatedInvoice = await setInvoicePaidAmount(invoice.id, nextPaidAmount);
      onPaymentRecorded?.(updatedInvoice);
      toast({
        title: "Paid Amount Updated",
        description: `Invoice paid amount is now ${formatCurrency(nextPaidAmount)}.`,
      });
      onOpenChange(false);
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to update paid amount.",
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
          <DialogTitle>Update Payment for {invoice.invoiceNumber}</DialogTitle>
          <DialogDescription>
            Record an additional payment or correct the total paid amount.
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

            {canRecordPayment && (
                 <div className="grid grid-cols-4 items-center gap-4">
                 <Label htmlFor="amount" className="text-right">
                   Add Payment
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
            {!canRecordPayment && (
              <p className="text-sm text-muted-foreground">
                No outstanding due amount for this invoice.
              </p>
            )}
          </div>
          {canRecordPayment && (
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
        <div className="border-t pt-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="corrected-amount" className="text-right">
              Set Paid
            </Label>
            <Input
              id="corrected-amount"
              type="number"
              value={correctedAmount}
              onChange={(e) => setCorrectedAmount(e.target.value)}
              className="col-span-3"
              step="0.01"
              min={0}
              max={invoice.total}
            />
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            Use this if a previous payment was entered incorrectly.
          </p>
          <DialogFooter className="mt-4">
            <Button type="button" variant="secondary" onClick={handleCorrectAmount} disabled={isSubmitting}>
              {isSubmitting ? "Saving..." : "Update Paid Amount"}
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}
