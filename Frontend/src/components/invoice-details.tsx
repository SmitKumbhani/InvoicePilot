
"use client";

import type { Invoice } from "@/lib/types";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCurrency, cn } from "@/lib/utils";
import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PaymentDialog } from "./payment-dialog";
import { Separator } from "./ui/separator";

type InvoiceDetailsProps = {
  invoice: Invoice;
  previousBalanceDue: number;
  onItemFocus?: (itemId: string | null) => void;
};

const statusVariant: { [key in Invoice["status"]]: string } = {
  paid: "bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300",
  "partially-paid": "bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300",
  pending: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/50 dark:text-yellow-300",
  draft: "bg-gray-100 text-gray-800 dark:bg-gray-900/50 dark:text-gray-300",
};

export function InvoiceDetails({ invoice: initialInvoice, previousBalanceDue, onItemFocus }: InvoiceDetailsProps) {
  const [isPaymentDialogOpen, setIsPaymentDialogOpen] = useState(false);
  // This local state will be updated when the dialog closes after a successful payment.
  const [invoice, setInvoice] = useState(initialInvoice);

  const amountDue = invoice.total - invoice.amountPaid;
  const grandTotalDue = amountDue + previousBalanceDue;

  const handlePaymentSuccess = () => {
    // A simple way to refresh data without a full page reload is to just update local state
    // For a more robust solution, you might refetch or use a state management library
    const updatedInvoice = {
      ...invoice,
      // This is an optimistic update. The server has the real data.
      // We can't know the exact new amountPaid without a refetch, but we can close the loop.
    };
    // To properly update, we'd need the action to return the updated invoice.
    // For now, we'll just close the dialog. The revalidation on the server action will update the page on next navigation.
  };

  return (
    <>
      <Card id="invoice-details">
        <CardHeader className="flex-row items-start justify-between">
            <div>
                <CardTitle>{invoice.invoiceNumber}</CardTitle>
                <CardDescription>
                    Billed to: {invoice.customer.name} ({invoice.customer.phone})
                </CardDescription>
            </div>
            <div className="text-right space-y-1">
                 <Badge variant={"outline"} className={cn("text-base border-transparent", statusVariant[invoice.status])}>
                    {invoice.status.charAt(0).toUpperCase() + invoice.status.slice(1).replace("-", " ")}
                </Badge>
                {/* <p className="text-sm text-muted-foreground">Issued: {format(new Date(new Date(invoice.issueDate).toUTCString()), "MMM d, yyyy")}</p> */}
                <p className="text-sm text-muted-foreground">Issued: {invoice.created_at}</p>
            </div>
        </CardHeader>
        <CardContent>
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>Group</TableHead>
                        <TableHead>Description</TableHead>
                        <TableHead className="text-center">Quantity</TableHead>
                        <TableHead className="text-right">Unit Price</TableHead>
                        <TableHead className="text-right">Total</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {invoice.lineItems && invoice.lineItems.map((item, index) => (
                        <TableRow key={index} onFocus={() => onItemFocus?.(item.itemId)} onClick={() => onItemFocus?.(item.itemId)} className="cursor-pointer">
                            <TableCell>{item.group_name || 'N/A'}</TableCell>
                            <TableCell className="font-medium">{item.description}</TableCell>
                            <TableCell className="text-center">{item.quantity}</TableCell>
                            <TableCell className="text-right">{formatCurrency(item.unitPrice)}</TableCell>
                            <TableCell className="text-right">{formatCurrency(item.quantity * item.unitPrice)}</TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
            <Separator className="my-4"/>
            <div className="flex justify-end">
                <div className="w-full max-w-sm space-y-2">
                    <div className="flex justify-between">
                        <span>Invoice Total</span>
                        <span>{formatCurrency(invoice.total)}</span>
                    </div>
                    <div className="flex justify-between">
                        <span className="text-muted-foreground">Paid for this invoice</span>
                        <span>-{formatCurrency(invoice.amountPaid)}</span>
                    </div>
                     <div className="flex justify-between font-medium">
                        <span>Amount Due for this invoice</span>
                        <span>{formatCurrency(amountDue)}</span>
                    </div>
                    <Separator className="my-2"/>
                    <div className="flex justify-between">
                        <span>Previous Due</span>
                        <span>{formatCurrency(previousBalanceDue)}</span>
                    </div>
                    <Separator className="my-2"/>
                    <div className="flex justify-between font-bold text-xl text-primary">
                        <span>Grand Total Due</span>
                        <span>{formatCurrency(grandTotalDue)}</span>
                    </div>
                </div>
            </div>
        </CardContent>
        <CardFooter className="justify-end no-print">
            {invoice.status !== 'paid' && (
                 <Button onClick={() => setIsPaymentDialogOpen(true)}>Record Payment</Button>
            )}
        </CardFooter>
      </Card>
      <PaymentDialog
        invoice={invoice}
        open={isPaymentDialogOpen}
        onOpenChange={(open) => {
            setIsPaymentDialogOpen(open)
            if (!open) handlePaymentSuccess();
        }}
      />
    </>
  );
}
