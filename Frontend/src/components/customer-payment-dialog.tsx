"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useApi } from "@/lib/api";
import type {
  Customer,
  CustomerPayment,
  CustomerPaymentSummary,
} from "@/lib/types";
import { formatCurrency } from "@/lib/utils";
import { Pencil, Trash2 } from "lucide-react";

type CustomerPaymentDialogCustomer = Customer & {
  pendingAmount: number;
};

type CustomerPaymentDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  customer: CustomerPaymentDialogCustomer | null;
  onPaymentRecorded: () => void;
};

const getTodayDate = () => new Date().toISOString().split("T")[0];

const parseDateInput = (value: string | Date | undefined) => {
  if (!value) {
    return getTodayDate();
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? getTodayDate() : date.toISOString().split("T")[0];
};

const formatDisplayDate = (value: string | Date) => {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "-" : format(date, "MMM d, yyyy");
};

const getCreditAmount = (summary?: CustomerPaymentSummary) => {
  if (!summary) {
    return 0;
  }
  return (
    summary.availableCredit ??
    summary.creditBalance ??
    summary.customerCredit ??
    summary.totalUnallocated ??
    0
  );
};

export function CustomerPaymentDialog({
  open,
  onOpenChange,
  customer,
  onPaymentRecorded,
}: CustomerPaymentDialogProps) {
  const { toast } = useToast();
  const {
    createCustomerPayment,
    getCustomerPayments,
    updateCustomerPayment,
    deleteCustomerPayment,
  } = useApi();

  const [amount, setAmount] = useState("");
  const [paymentDate, setPaymentDate] = useState(getTodayDate());
  const [note, setNote] = useState("");
  const [editingPaymentId, setEditingPaymentId] = useState<string | null>(null);
  const [paymentToDelete, setPaymentToDelete] = useState<CustomerPayment | null>(null);
  const [payments, setPayments] = useState<CustomerPayment[]>([]);
  const [summary, setSummary] = useState<CustomerPaymentSummary | undefined>();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const resetForm = () => {
    setAmount("");
    setPaymentDate(getTodayDate());
    setNote("");
    setEditingPaymentId(null);
  };

  const refreshPayments = async () => {
    if (!customer) {
      return;
    }
    setIsLoadingHistory(true);
    try {
      const response = await getCustomerPayments(customer.id);
      setPayments(response.payments);
      setSummary(response.summary);
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Failed to load payments",
        description: error instanceof Error ? error.message : "Try again.",
      });
    } finally {
      setIsLoadingHistory(false);
    }
  };

  useEffect(() => {
    if (!open || !customer) {
      return;
    }
    resetForm();
    void refreshPayments();
  }, [open, customer?.id]);

  const sortedPayments = useMemo(
    () =>
      [...payments].sort((a, b) => {
        const first = new Date(a.paymentDate).getTime();
        const second = new Date(b.paymentDate).getTime();
        return (Number.isFinite(second) ? second : 0) - (Number.isFinite(first) ? first : 0);
      }),
    [payments]
  );

  if (!customer) {
    return null;
  }

  const displayedPending =
    summary?.pendingAmount ??
    summary?.outstandingAmount ??
    summary?.totalOutstanding ??
    customer.pendingAmount;

  const creditAmount = getCreditAmount(summary);
  const hasCreditInfo =
    summary?.availableCredit !== undefined ||
    summary?.creditBalance !== undefined ||
    summary?.customerCredit !== undefined ||
    summary?.totalUnallocated !== undefined;

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    const parsedAmount = Number(amount);
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      toast({
        variant: "destructive",
        title: "Invalid amount",
        description: "Enter a payment amount greater than 0.",
      });
      return;
    }

    if (!paymentDate) {
      toast({
        variant: "destructive",
        title: "Missing date",
        description: "Select a payment date.",
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const trimmedNote = note.trim();
      const payload = {
        amount: parsedAmount,
        paymentDate,
        note: editingPaymentId ? trimmedNote : (trimmedNote || undefined),
      };

      if (editingPaymentId) {
        await updateCustomerPayment(customer.id, editingPaymentId, payload);
        toast({
          title: "Payment updated",
          description: `${formatCurrency(parsedAmount)} was updated for ${customer.name}.`,
        });
      } else {
        await createCustomerPayment(customer.id, payload);
        toast({
          title: "Payment recorded",
          description: `${formatCurrency(parsedAmount)} was recorded for ${customer.name}.`,
        });
      }

      await refreshPayments();
      onPaymentRecorded();
      resetForm();
    } catch (error) {
      toast({
        variant: "destructive",
        title: editingPaymentId ? "Failed to update payment" : "Failed to record payment",
        description: error instanceof Error ? error.message : "Try again.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEdit = (payment: CustomerPayment) => {
    setEditingPaymentId(payment.id);
    setAmount(payment.amount.toString());
    setPaymentDate(parseDateInput(payment.paymentDate));
    setNote(payment.note ?? "");
  };

  const handleDelete = async () => {
    if (!customer || !paymentToDelete) {
      return;
    }
    setIsDeleting(true);
    try {
      await deleteCustomerPayment(customer.id, paymentToDelete.id);
      toast({
        title: "Payment deleted",
        description: "Payment record deleted successfully.",
      });

      if (editingPaymentId === paymentToDelete.id) {
        resetForm();
      }

      setPaymentToDelete(null);
      await refreshPayments();
      onPaymentRecorded();
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Failed to delete payment",
        description: error instanceof Error ? error.message : "Try again.",
      });
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[640px]">
          <DialogHeader>
            <DialogTitle>{editingPaymentId ? "Edit Payment" : "Record Payment"}</DialogTitle>
            <DialogDescription>
              Record and manage customer-level payments for {customer.name}. Overpayments are stored as
              customer credit.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div
              className={`grid gap-3 rounded-md border bg-muted/20 p-3 text-sm ${
                hasCreditInfo ? "sm:grid-cols-2" : "sm:grid-cols-1"
              }`}
            >
              <div className="flex items-center justify-between gap-4">
                <span className="text-muted-foreground">Pending Amount</span>
                <span className="font-semibold">{formatCurrency(Math.max(displayedPending, 0))}</span>
              </div>
              {hasCreditInfo && (
                <div className="flex items-center justify-between gap-4">
                  <span className="text-muted-foreground">Customer Credit</span>
                  <span className="font-semibold">{formatCurrency(Math.max(creditAmount, 0))}</span>
                </div>
              )}
            </div>
            <div className="grid gap-2 sm:grid-cols-3">
              <div className="grid gap-2">
                <Label htmlFor="customer-payment-amount">Amount</Label>
                <Input
                  id="customer-payment-amount"
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  min={0.01}
                  step="0.01"
                  inputMode="decimal"
                  placeholder="0.00"
                  disabled={isSubmitting}
                  required
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="customer-payment-date">Payment Date</Label>
                <Input
                  id="customer-payment-date"
                  type="date"
                  value={paymentDate}
                  onChange={(e) => setPaymentDate(e.target.value)}
                  disabled={isSubmitting}
                  required
                />
              </div>
              <div className="grid gap-2 sm:col-span-3">
                <Label htmlFor="customer-payment-note">Note (optional)</Label>
                <Textarea
                  id="customer-payment-note"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Payment reference, mode, or remarks"
                  disabled={isSubmitting}
                  rows={2}
                />
              </div>
            </div>
            <DialogFooter className="gap-2 sm:justify-between">
              <Button
                type="button"
                variant="outline"
                onClick={resetForm}
                disabled={isSubmitting || !editingPaymentId}
              >
                Cancel Edit
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting
                  ? "Saving..."
                  : editingPaymentId
                    ? "Update Payment"
                    : "Record Payment"}
              </Button>
            </DialogFooter>
          </form>

          <div className="space-y-3 border-t pt-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold">Payment History</h3>
              <Badge variant="outline">{sortedPayments.length}</Badge>
            </div>
            <div className="max-h-[260px] space-y-2 overflow-y-auto pr-1">
              {isLoadingHistory && (
                <p className="text-sm text-muted-foreground">Loading payment history...</p>
              )}
              {!isLoadingHistory && sortedPayments.length === 0 && (
                <p className="text-sm text-muted-foreground">No payments recorded yet.</p>
              )}
              {!isLoadingHistory &&
                sortedPayments.map((payment) => {
                  const allocatedAmount = payment.allocations.reduce(
                    (total, allocation) => total + allocation.allocatedAmount,
                    0
                  );
                  const creditFromPayment = Math.max(payment.amount - allocatedAmount, 0);

                  return (
                    <div key={payment.id} className="rounded-md border p-3 text-sm">
                      <div className="flex items-start justify-between gap-2">
                        <div className="space-y-1">
                          <p className="font-medium">{formatCurrency(payment.amount)}</p>
                          <p className="text-muted-foreground">{formatDisplayDate(payment.paymentDate)}</p>
                          {payment.note && <p className="text-muted-foreground">{payment.note}</p>}
                        </div>
                        <div className="flex items-center gap-1">
                          <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            onClick={() => handleEdit(payment)}
                            disabled={isSubmitting || isDeleting}
                          >
                            <Pencil className="h-4 w-4" />
                            <span className="sr-only">Edit payment</span>
                          </Button>
                          <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            onClick={() => setPaymentToDelete(payment)}
                            disabled={isSubmitting || isDeleting}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                            <span className="sr-only">Delete payment</span>
                          </Button>
                        </div>
                      </div>
                      {payment.allocations.length > 0 && (
                        <div className="mt-2 space-y-1 text-xs text-muted-foreground">
                          {payment.allocations.map((allocation) => (
                            <p key={allocation.id ?? `${payment.id}-${allocation.invoiceId}`}>
                              Applied {formatCurrency(allocation.allocatedAmount)} to invoice{" "}
                              {allocation.invoiceNumber ?? allocation.invoiceId}
                            </p>
                          ))}
                        </div>
                      )}
                      {creditFromPayment > 0 && (
                        <p className="mt-2 text-xs text-muted-foreground">
                          Unallocated credit from this payment: {formatCurrency(creditFromPayment)}
                        </p>
                      )}
                    </div>
                  );
                })}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={Boolean(paymentToDelete)}
        onOpenChange={(isOpen) => {
          if (!isOpen) {
            setPaymentToDelete(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete payment record?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. The customer and invoice balances will be recalculated.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive hover:bg-destructive/90"
              onClick={handleDelete}
              disabled={isDeleting}
            >
              {isDeleting ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
