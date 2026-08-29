
'use client';

import { useState } from "react";
import type { Customer, Invoice, Item } from "@/lib/types";
import { InvoiceDetails } from "@/components/invoice-details";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Pencil, Printer } from "lucide-react";
import { PriceHistoryPanel } from "@/components/price-history-panel";
import { useIsMobile } from "@/hooks/use-mobile";
import { InvoicePrintInterceptorDialog } from "./invoice-print-interceptor-dialog";

export function InvoicePageClient({
  invoice: initialInvoice,
  previousBalanceDue,
  printMode = "full",
}: {
  invoice: Invoice;
  previousBalanceDue: number;
  printMode?: "full" | "invoice-only";
}) {
  const [invoice, setInvoice] = useState(initialInvoice);
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [isPrintDialogOpen, setIsPrintDialogOpen] = useState(false);
  const isMobile = useIsMobile();

  return (
    <>
      <div className="flex flex-col gap-8 print-content">
          <div className="flex items-center justify-between no-print">
              <div className="flex items-center gap-4">
                  <Button variant="outline" size="icon" asChild>
                      <Link href="/">
                          <ArrowLeft />
                          <span className="sr-only">Back to Ledger</span>
                      </Link>
                  </Button>
                  <div>
                      <h1 className="text-3xl font-bold font-headline tracking-tight">
                          Invoice {invoice.invoiceNumber}
                      </h1>
                      <p className="text-muted-foreground">
                          From {invoice.customer.name}
                      </p>
                  </div>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" asChild className="no-print">
                  <Link href={`/invoices/${invoice.id}/edit`}>
                    <Pencil />
                    Edit Invoice
                  </Link>
                </Button>
                <Button onClick={() => setIsPrintDialogOpen(true)} className="no-print">
                  <Printer />
                  Print Invoice
                </Button>
              </div>
          </div>
        <div className="grid lg:grid-cols-5 gap-8">
            <div className="lg:col-span-3">
                <InvoiceDetails
                  invoice={invoice}
                  previousBalanceDue={previousBalanceDue}
                  totalsMode={printMode}
                  onItemFocus={setSelectedItemId}
                />
            </div>
            {!isMobile && (
                <div className="lg:col-span-2 no-print">
                    <PriceHistoryPanel itemId={selectedItemId} customerId={invoice.customerId} />
                </div>
            )}
        </div>
      </div>
      <InvoicePrintInterceptorDialog
        open={isPrintDialogOpen}
        onOpenChange={setIsPrintDialogOpen}
        invoiceId={invoice.id}
        invoiceNumber={invoice.invoiceNumber}
        invoiceTotal={invoice.total}
        previousBalanceDue={previousBalanceDue}
        amountPaid={invoice.amountPaid}
      />
    </>
  );
}
