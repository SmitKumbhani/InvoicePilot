"use client";

import { useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { useApi } from "@/lib/api";
import type { Customer, CustomerPayment, Invoice } from "@/lib/types";
import { formatCurrency } from "@/lib/utils";
import { Printer, RefreshCcw } from "lucide-react";

type CustomerWithPending = Customer & {
  pendingAmount: number;
};

type CustomerLedgerDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  customer: CustomerWithPending | null;
};

type LedgerEvent =
  | {
      kind: "invoice";
      dateKey: string;
      timestamp: number;
      id: string;
      invoice: Invoice;
    }
  | {
      kind: "payment";
      dateKey: string;
      timestamp: number;
      id: string;
      payment: CustomerPayment;
    };

type LedgerRow = {
  id: string;
  dateLabel: string;
  transactionType: "Invoice" | "Payment" | "Credit";
  reference: string;
  invoiceNumber: string;
  description: string;
  debit: number;
  credit: number;
  runningBalance: number;
  invoiceTotal: number | null;
  invoicePaid: number | null;
  invoiceDue: number | null;
};

const roundMoney = (value: number): number =>
  Math.round((Number.isFinite(value) ? value : 0) * 100) / 100;

const getRowClassName = (type: LedgerRow["transactionType"]) => {
  if (type === "Invoice") {
    return "bg-amber-50/70 hover:bg-amber-100/70 dark:bg-amber-950/20 dark:hover:bg-amber-900/30";
  }
  if (type === "Payment") {
    return "bg-emerald-50/70 hover:bg-emerald-100/70 dark:bg-emerald-950/20 dark:hover:bg-emerald-900/30";
  }
  return "bg-cyan-50/70 hover:bg-cyan-100/70 dark:bg-cyan-950/20 dark:hover:bg-cyan-900/30";
};

const toTime = (value: string | Date | undefined): number => {
  if (!value) {
    return 0;
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 0 : date.getTime();
};

const toDateKey = (value: string | Date | undefined): string => {
  if (!value) {
    return "0000-00-00";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "0000-00-00";
  }
  return date.toISOString().slice(0, 10);
};

const toDateLabel = (value: string | Date | undefined): string => {
  if (!value) {
    return "-";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "-";
  }
  return format(date, "MMM d, yyyy");
};

const buildLedgerRows = (
  invoices: Invoice[],
  payments: CustomerPayment[]
): { rows: LedgerRow[]; closingBalance: number } => {
  const invoiceTotalById = new Map<string, number>();
  const invoiceNumberById = new Map<string, string>();
  const currentInvoicePaidById = new Map<string, number>();

  invoices.forEach((invoice) => {
    const total = roundMoney(Number(invoice.total || 0));
    const currentPaid = roundMoney(
      Math.min(total, Math.max(Number(invoice.amountPaid || 0), 0))
    );
    invoiceTotalById.set(invoice.id, total);
    invoiceNumberById.set(invoice.id, invoice.invoiceNumber);
    currentInvoicePaidById.set(invoice.id, currentPaid);
  });

  const invoiceEvents: LedgerEvent[] = invoices.map((invoice) => ({
    kind: "invoice",
    dateKey: toDateKey(invoice.issueDate),
    timestamp: toTime(invoice.createdAt ?? invoice.issueDate),
    id: invoice.id,
    invoice,
  }));

  const paymentEvents: LedgerEvent[] = payments.map((payment) => ({
    kind: "payment",
    dateKey: toDateKey(payment.paymentDate),
    timestamp: toTime(payment.createdAt ?? payment.paymentDate),
    id: payment.id,
    payment,
  }));

  const events = [...invoiceEvents, ...paymentEvents].sort((a, b) => {
    if (a.dateKey !== b.dateKey) {
      return a.dateKey.localeCompare(b.dateKey);
    }

    if (a.timestamp !== b.timestamp) {
      return a.timestamp - b.timestamp;
    }

    if (a.kind !== b.kind) {
      return a.kind === "invoice" ? -1 : 1;
    }

    return a.id.localeCompare(b.id);
  });

  let runningBalance = 0;
  const rows: LedgerRow[] = [];

  for (const event of events) {
    if (event.kind === "invoice") {
      const invoice = event.invoice;
      const invoiceTotal = invoiceTotalById.get(invoice.id) ?? roundMoney(Number(invoice.total || 0));
      const currentPaid = currentInvoicePaidById.get(invoice.id) ?? 0;
      const currentDue = roundMoney(Math.max(invoiceTotal - currentPaid, 0));

      runningBalance = roundMoney(runningBalance + invoiceTotal);
      rows.push({
        id: `invoice-${invoice.id}`,
        dateLabel: toDateLabel(invoice.issueDate),
        transactionType: "Invoice",
        reference: invoice.invoiceNumber,
        invoiceNumber: invoice.invoiceNumber,
        description: "Invoice issued",
        debit: invoiceTotal,
        credit: 0,
        runningBalance,
        invoiceTotal,
        invoicePaid: currentPaid,
        invoiceDue: currentDue,
      });
      continue;
    }

    const payment = event.payment;
    const paymentReference = `PAY-${payment.id.slice(0, 8)}`;
    const allocations = Array.isArray(payment.allocations) ? payment.allocations : [];
    let allocatedTotal = 0;

    for (const allocation of allocations) {
      const appliedAmount = roundMoney(Number(allocation.allocatedAmount || 0));
      allocatedTotal = roundMoney(allocatedTotal + appliedAmount);
      runningBalance = roundMoney(runningBalance - appliedAmount);

      rows.push({
        id: `payment-${payment.id}-${allocation.id ?? allocation.invoiceId}`,
        dateLabel: toDateLabel(payment.paymentDate),
        transactionType: "Payment",
        reference: paymentReference,
        invoiceNumber:
          allocation.invoiceNumber ??
          invoiceNumberById.get(allocation.invoiceId) ??
          allocation.invoiceId,
        description: payment.note?.trim() ? payment.note.trim() : "Payment allocation",
        debit: 0,
        credit: appliedAmount,
        runningBalance,
        invoiceTotal: null,
        invoicePaid: null,
        invoiceDue: null,
      });
    }

    const unallocated = roundMoney(Math.max(Number(payment.amount || 0) - allocatedTotal, 0));
    if (unallocated > 0) {
      runningBalance = roundMoney(runningBalance - unallocated);
      rows.push({
        id: `payment-credit-${payment.id}`,
        dateLabel: toDateLabel(payment.paymentDate),
        transactionType: "Credit",
        reference: paymentReference,
        invoiceNumber: "-",
        description: payment.note?.trim()
          ? `${payment.note.trim()} (unallocated credit)`
          : "Unallocated customer credit",
        debit: 0,
        credit: unallocated,
        runningBalance,
        invoiceTotal: null,
        invoicePaid: null,
        invoiceDue: null,
      });
    }
  }

  return { rows, closingBalance: roundMoney(runningBalance) };
};

export function CustomerLedgerDialog({
  open,
  onOpenChange,
  customer,
}: CustomerLedgerDialogProps) {
  const { toast } = useToast();
  const { getInvoices, getCustomerPayments } = useApi();

  const [isLoading, setIsLoading] = useState(false);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [payments, setPayments] = useState<CustomerPayment[]>([]);

  const refreshLedger = async () => {
    if (!customer) {
      return;
    }

    setIsLoading(true);
    try {
      const [invoiceList, paymentResponse] = await Promise.all([
        getInvoices(),
        getCustomerPayments(customer.id),
      ]);

      const customerInvoices = invoiceList
        .filter((invoice) => invoice.customerId === customer.id)
        .sort((a, b) => {
          const issueDelta = toTime(a.issueDate) - toTime(b.issueDate);
          if (issueDelta !== 0) {
            return issueDelta;
          }
          const createdDelta = toTime(a.createdAt) - toTime(b.createdAt);
          if (createdDelta !== 0) {
            return createdDelta;
          }
          return a.invoiceNumber.localeCompare(b.invoiceNumber);
        });

      const customerPayments = [...paymentResponse.payments].sort((a, b) => {
        const paymentDateDelta = toTime(a.paymentDate) - toTime(b.paymentDate);
        if (paymentDateDelta !== 0) {
          return paymentDateDelta;
        }
        const createdDelta = toTime(a.createdAt) - toTime(b.createdAt);
        if (createdDelta !== 0) {
          return createdDelta;
        }
        return a.id.localeCompare(b.id);
      });

      setInvoices(customerInvoices);
      setPayments(customerPayments);
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Failed to load customer ledger",
        description: error instanceof Error ? error.message : "Try again.",
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!open || !customer) {
      return;
    }
    void refreshLedger();
  }, [open, customer?.id]);

  const { rows, closingBalance } = useMemo(
    () => buildLedgerRows(invoices, payments),
    [invoices, payments]
  );

  const totals = useMemo(() => {
    const totalInvoiced = roundMoney(
      invoices.reduce((sum, invoice) => sum + Number(invoice.total || 0), 0)
    );
    const totalPaid = roundMoney(
      payments.reduce((sum, payment) => sum + Number(payment.amount || 0), 0)
    );
    const balanceDue = roundMoney(Math.max(closingBalance, 0));
    const customerCredit = roundMoney(Math.max(-closingBalance, 0));

    return {
      totalInvoiced,
      totalPaid,
      balanceDue,
      customerCredit,
    };
  }, [invoices, payments, closingBalance]);

  if (!customer) {
    return null;
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="customer-ledger-dialog-content h-[100dvh] w-[100vw] max-w-[100vw] min-h-0 overflow-hidden rounded-none p-0 sm:h-[92vh] sm:w-[96vw] sm:max-w-[1200px] sm:rounded-lg">
        <div className="customer-ledger-print print-content flex h-full min-h-0 flex-col">
          <DialogHeader className="customer-ledger-header border-b px-6 py-4 pr-16">
            <div className="flex items-start justify-between gap-4">
              <div>
                <DialogTitle>Customer Ledger</DialogTitle>
                <DialogDescription>
                  {customer.name} ({customer.phone}) - complete invoice and payment transaction history.
                </DialogDescription>
              </div>
              <div className="flex items-center gap-2 no-print">
                <Button variant="outline" size="sm" onClick={() => void refreshLedger()} disabled={isLoading}>
                  <RefreshCcw className="h-4 w-4" />
                  Refresh
                </Button>
                <Button size="sm" onClick={() => window.print()}>
                  <Printer className="h-4 w-4" />
                  Print Ledger
                </Button>
              </div>
            </div>
          </DialogHeader>

          <div className="customer-ledger-summary grid grid-cols-2 border-b bg-muted/20 text-sm sm:grid-cols-4">
            {[
              { label: "Total Invoiced", value: formatCurrency(totals.totalInvoiced) },
              { label: "Total Paid", value: formatCurrency(totals.totalPaid) },
              { label: "Balance Due", value: formatCurrency(totals.balanceDue) },
              { label: "Customer Credit", value: formatCurrency(totals.customerCredit) },
            ].map((tile, index) => (
              <div
                key={tile.label}
                className={[
                  "flex flex-col gap-0.5 px-4 py-2",
                  "border-border/70",
                  index % 2 === 0 ? "border-r" : "",
                  index < 2 ? "border-b sm:border-b-0" : "",
                  index < 3 ? "sm:border-r" : "",
                ].join(" ")}
              >
                <span className="text-xs leading-tight text-muted-foreground">{tile.label}</span>
                <span className="text-base font-semibold leading-tight">{tile.value}</span>
              </div>
            ))}
          </div>

          <div className="customer-ledger-body flex-1 min-h-0 overflow-y-auto px-6 py-4">
            <div className="space-y-6">
              <section>
                <h3 className="mb-2 text-sm font-semibold">Transaction Ledger</h3>
                <div className="space-y-2 md:hidden print:hidden">
                  {isLoading && (
                    <div className="rounded-md border bg-muted/20 p-3 text-center text-sm text-muted-foreground">
                      Loading customer ledger...
                    </div>
                  )}
                  {!isLoading && rows.length === 0 && (
                    <div className="rounded-md border bg-muted/20 p-3 text-center text-sm text-muted-foreground">
                      No transactions available for this customer.
                    </div>
                  )}
                  {!isLoading &&
                    rows.map((row) => (
                      <div key={row.id} className={`rounded-md border p-3 ${getRowClassName(row.transactionType)}`}>
                        <div className="flex items-center justify-between gap-2">
                          <Badge variant="outline">{row.transactionType}</Badge>
                          <span className="text-xs text-muted-foreground">{row.dateLabel}</span>
                        </div>
                        <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
                          <span className="text-muted-foreground">Reference</span>
                          <span className="text-right font-mono">{row.reference}</span>
                          <span className="text-muted-foreground">Invoice</span>
                          <span className="text-right">{row.invoiceNumber}</span>
                          <span className="text-muted-foreground">Invoice Total</span>
                          <span className="text-right">
                            {row.invoiceTotal === null ? "-" : formatCurrency(row.invoiceTotal)}
                          </span>
                          <span className="text-muted-foreground">Invoice Paid</span>
                          <span className="text-right">
                            {row.invoicePaid === null ? "-" : formatCurrency(row.invoicePaid)}
                          </span>
                          <span className="text-muted-foreground">Invoice Due</span>
                          <span className="text-right">
                            {row.invoiceDue === null ? "-" : formatCurrency(row.invoiceDue)}
                          </span>
                          <span className="text-muted-foreground">Payment Amount</span>
                          <span className="text-right">
                            {row.credit > 0 ? formatCurrency(row.credit) : "-"}
                          </span>
                        </div>
                        <div className="mt-2 flex items-center justify-between border-t pt-2 text-sm font-semibold">
                          <span>Balance</span>
                          <span>{formatCurrency(row.runningBalance)}</span>
                        </div>
                      </div>
                    ))}
                  {!isLoading && rows.length > 0 && (
                    <div className="rounded-md border bg-muted/20 p-3">
                      <div className="mb-2 text-sm font-semibold">Ledger Totals</div>
                      <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
                        <span className="text-muted-foreground">Invoice Total</span>
                        <span className="text-right">{formatCurrency(totals.totalInvoiced)}</span>
                        <span className="text-muted-foreground">Payment Amount</span>
                        <span className="text-right">{formatCurrency(totals.totalPaid)}</span>
                        <span className="text-muted-foreground font-semibold">Balance</span>
                        <span className="text-right font-semibold">{formatCurrency(closingBalance)}</span>
                      </div>
                    </div>
                  )}
                </div>

                <div className="customer-ledger-table-wrap hidden md:block print:block">
                <Table className="customer-ledger-print-table">
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Reference</TableHead>
                      <TableHead>Invoice</TableHead>
                      <TableHead className="text-right">Invoice Total</TableHead>
                      <TableHead className="text-right">Invoice Paid</TableHead>
                      <TableHead className="text-right">Invoice Due</TableHead>
                      <TableHead className="text-right">Payment Amount</TableHead>
                      <TableHead className="text-right">Balance</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {isLoading && (
                      <TableRow>
                        <TableCell colSpan={9} className="text-center text-muted-foreground">
                          Loading customer ledger...
                        </TableCell>
                      </TableRow>
                    )}
                    {!isLoading && rows.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={9} className="text-center text-muted-foreground">
                          No transactions available for this customer.
                        </TableCell>
                      </TableRow>
                    )}
                    {!isLoading &&
                      rows.map((row) => (
                        <TableRow key={row.id} className={getRowClassName(row.transactionType)}>
                          <TableCell>{row.dateLabel}</TableCell>
                          <TableCell>
                            <Badge variant="outline">{row.transactionType}</Badge>
                          </TableCell>
                          <TableCell className="font-mono text-xs">{row.reference}</TableCell>
                          <TableCell>{row.invoiceNumber}</TableCell>
                          <TableCell className="text-right">
                            {row.invoiceTotal === null ? "-" : formatCurrency(row.invoiceTotal)}
                          </TableCell>
                          <TableCell className="text-right">
                            {row.invoicePaid === null ? "-" : formatCurrency(row.invoicePaid)}
                          </TableCell>
                          <TableCell className="text-right">
                            {row.invoiceDue === null ? "-" : formatCurrency(row.invoiceDue)}
                          </TableCell>
                          <TableCell className="text-right">
                            {row.credit > 0 ? formatCurrency(row.credit) : "-"}
                          </TableCell>
                          <TableCell className="text-right font-medium">
                            {formatCurrency(row.runningBalance)}
                          </TableCell>
                        </TableRow>
                      ))}
                  </TableBody>
                  <TableFooter>
                    <TableRow>
                      <TableCell className="font-semibold">Ledger Totals</TableCell>
                      <TableCell>-</TableCell>
                      <TableCell>-</TableCell>
                      <TableCell>-</TableCell>
                      <TableCell className="text-right">{formatCurrency(totals.totalInvoiced)}</TableCell>
                      <TableCell className="text-right">-</TableCell>
                      <TableCell className="text-right">-</TableCell>
                      <TableCell className="text-right">{formatCurrency(totals.totalPaid)}</TableCell>
                      <TableCell className="text-right font-semibold">
                        {formatCurrency(closingBalance)}
                      </TableCell>
                    </TableRow>
                  </TableFooter>
                </Table>
                </div>
              </section>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
