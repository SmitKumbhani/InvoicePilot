
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
  onInvoiceUpdated?: (invoice: Invoice) => void;
};

const statusVariant: { [key in Invoice["status"]]: string } = {
  paid: "bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300",
  "partially-paid": "bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300",
  pending: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/50 dark:text-yellow-300",
  draft: "bg-gray-100 text-gray-800 dark:bg-gray-900/50 dark:text-gray-300",
};

export function InvoiceDetails({ invoice, previousBalanceDue, onItemFocus, onInvoiceUpdated }: InvoiceDetailsProps) {
  const [isPaymentDialogOpen, setIsPaymentDialogOpen] = useState(false);
  const amountDue = Math.max(invoice.total - invoice.amountPaid, 0);
  const grandTotalDue = amountDue + previousBalanceDue;

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
                <p className="text-sm text-muted-foreground">
                  Issued: {invoice.issueDate ? format(new Date(new Date(invoice.issueDate).toUTCString()), "MMM d, yyyy") : ""}
                </p>
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
                    {invoice.lineItems.map((item, index) => (
                        <TableRow key={item.id ?? index} onFocus={() => onItemFocus?.(item.itemId ?? null)} onClick={() => onItemFocus?.(item.itemId ?? null)} className="cursor-pointer">
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
            <Button onClick={() => setIsPaymentDialogOpen(true)}>
              {amountDue > 0 ? "Record / Adjust Payment" : "Adjust Payment"}
            </Button>
        </CardFooter>
      </Card>
      <PaymentDialog
        invoice={invoice}
        open={isPaymentDialogOpen}
        onOpenChange={setIsPaymentDialogOpen}
        onPaymentRecorded={(updatedInvoice) => {
          onInvoiceUpdated?.(updatedInvoice);
        }}
      />
    </>
  );
}
