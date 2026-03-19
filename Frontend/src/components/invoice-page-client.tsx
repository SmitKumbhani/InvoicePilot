
'use client';

import { useState } from "react";
import type { Customer, Invoice, Item } from "@/lib/types";
import { InvoiceDetails } from "@/components/invoice-details";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Pencil, Printer } from "lucide-react";
import { PriceHistoryPanel } from "@/components/price-history-panel";
import { useIsMobile } from "@/hooks/use-mobile";
import { InvoiceEditDialog } from "./invoice-edit-dialog";

export function InvoicePageClient({
  invoice: initialInvoice,
  previousBalanceDue,
  customers,
  items,
}: {
  invoice: Invoice;
  previousBalanceDue: number;
  customers: Customer[];
  items: Item[];
}) {
  const [invoice, setInvoice] = useState(initialInvoice);
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const isMobile = useIsMobile();

  const handlePrint = () => {
    window.print();
  };

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
                <Button variant="outline" onClick={() => setIsEditDialogOpen(true)} className="no-print">
                  <Pencil />
                  Edit Invoice
                </Button>
                <Button onClick={handlePrint}>
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
                  onItemFocus={setSelectedItemId}
                  onInvoiceUpdated={setInvoice}
                />
            </div>
            {!isMobile && (
                <div className="lg:col-span-2 no-print">
                    <PriceHistoryPanel itemId={selectedItemId} customerId={invoice.customerId} />
                </div>
            )}
        </div>
      </div>
      <InvoiceEditDialog
        open={isEditDialogOpen}
        onOpenChange={setIsEditDialogOpen}
        invoice={invoice}
        customers={customers}
        items={items}
        onInvoiceUpdated={setInvoice}
      />
    </>
  );
}
