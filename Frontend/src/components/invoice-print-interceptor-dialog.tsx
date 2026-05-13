"use client";

import { useMemo, useState, type ReactNode } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/utils";
import { printInvoiceWithMode, type InvoicePrintMode } from "@/lib/print-invoice";

type InvoicePrintInterceptorDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  invoiceId: string | null;
  invoiceNumber?: string;
  invoiceTotal?: number;
  previousBalanceDue?: number;
  amountPaid?: number;
};

export function InvoicePrintInterceptorDialog({
  open,
  onOpenChange,
  invoiceId,
  invoiceNumber,
  invoiceTotal = 0,
  previousBalanceDue = 0,
  amountPaid = 0,
}: InvoicePrintInterceptorDialogProps) {
  const [selectedMode, setSelectedMode] = useState<InvoicePrintMode | null>(null);

  const totals = useMemo(() => {
    const total = Number(invoiceTotal) || 0;
    const previous = Number(previousBalanceDue) || 0;
    const paid = Number(amountPaid) || 0;
    const totalDue = total + previous;
    const grand = totalDue - paid;
    return { total, previous, paid, totalDue, grand };
  }, [invoiceTotal, previousBalanceDue, amountPaid]);

  const handlePrint = (mode: InvoicePrintMode) => {
    if (!invoiceId) {
      return;
    }
    printInvoiceWithMode(invoiceId, mode);
    onOpenChange(false);
    setSelectedMode(null);
  };

  const resetAndClose = (nextOpen: boolean) => {
    if (!nextOpen) {
      setSelectedMode(null);
    }
    onOpenChange(nextOpen);
  };

  const OptionCard = ({
    mode,
    title,
    children,
  }: {
    mode: InvoicePrintMode;
    title: string;
    children: ReactNode;
  }) => {
    const isSelected = selectedMode === mode;
    const hasSelection = selectedMode !== null;

    return (
      <div
        role="button"
        tabIndex={0}
        className={`relative rounded-lg border p-4 text-left transition focus:outline-none focus:ring-2 focus:ring-primary/40 ${
          isSelected
            ? "border-primary shadow-md ring-2 ring-primary/25"
            : "border-border hover:border-primary/40"
        }`}
        onClick={() => setSelectedMode(mode)}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            setSelectedMode(mode);
          }
        }}
      >
        <div className={`${hasSelection && !isSelected ? "blur-[1px] opacity-65" : ""}`}>
          <div className="mb-3 flex items-center justify-between">
            <h4 className="font-semibold">{title}</h4>
            <Badge variant="outline">{mode === "full" ? "Standard" : "Invoice Only"}</Badge>
          </div>
          {children}
        </div>
        {isSelected && (
          <div className="absolute inset-0 flex items-center justify-center rounded-lg bg-background/45 backdrop-blur-[1.5px]">
            <Button onClick={() => handlePrint(mode)} size="lg" className="w-[min(240px,82%)]">
              Print This Version
            </Button>
          </div>
        )}
      </div>
    );
  };

  return (
    <Dialog open={open} onOpenChange={resetAndClose}>
      <DialogContent className="h-[100dvh] w-[100vw] max-w-[100vw] overflow-y-auto rounded-none p-4 sm:h-auto sm:w-full sm:max-w-5xl sm:rounded-lg sm:p-6">
        <DialogHeader>
          <DialogTitle>Choose Invoice Print Format</DialogTitle>
          <DialogDescription>
            Select one preview for invoice {invoiceNumber || "-"} and print that version.
          </DialogDescription>
        </DialogHeader>

        <div className="mb-2 text-xs text-muted-foreground md:hidden">
          Tap a preview card, then tap the center print button.
        </div>

        <div className="grid gap-3 md:grid-cols-2 md:gap-4">
          <OptionCard mode="full" title="With Previous Balance">
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span>Invoice Total</span>
                <span>{formatCurrency(totals.total)}</span>
              </div>
              <div className="flex justify-between">
                <span>Previous Due</span>
                <span>{formatCurrency(totals.previous)}</span>
              </div>
              <div className="flex justify-between">
                <span>Total Due</span>
                <span>{formatCurrency(totals.totalDue)}</span>
              </div>
              <div className="flex justify-between">
                <span>Amount Paid</span>
                <span>{formatCurrency(totals.paid)}</span>
              </div>
              <div className="mt-2 rounded-md border border-primary/30 bg-primary/10 px-3 py-2">
                <div className="flex justify-between text-lg font-bold text-primary">
                  <span>Grand Total Due</span>
                  <span>{formatCurrency(totals.grand)}</span>
                </div>
              </div>
            </div>
          </OptionCard>

          <OptionCard mode="invoice-only" title="Invoice Total Only">
            <div className="space-y-2 text-sm">
              <div className="border-t" />
              <div className="mt-2 rounded-md border border-primary/30 bg-primary/10 px-3 py-2">
                <div className="flex justify-between text-lg font-bold text-primary">
                  <span>Invoice Total</span>
                  <span>{formatCurrency(totals.total)}</span>
                </div>
              </div>
            </div>
          </OptionCard>
        </div>
      </DialogContent>
    </Dialog>
  );
}
