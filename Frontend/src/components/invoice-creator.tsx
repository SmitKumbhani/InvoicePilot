
"use client";
import type { Customer, Item, Invoice } from "@/lib/types";
import { useState } from "react";
import { InvoiceForm } from "./invoice-form";
import { PriceHistoryPanel } from "./price-history-panel";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "./ui/card";
import { useIsMobile } from "@/hooks/use-mobile";

type InvoiceCreatorProps = {
  invoice?: Invoice;
  customers: Customer[];
  items: Item[];
};

export function InvoiceCreator({ invoice, customers, items }: InvoiceCreatorProps) {
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(invoice?.customerId || null);
  const isMobile = useIsMobile();


  return (
    <div className="grid lg:grid-cols-5 gap-8">
      <div className="lg:col-span-3">
        <Card>
            <CardHeader>
                <CardTitle className="font-headline">{invoice ? `Edit Invoice ${invoice.invoiceNumber}` : "Create Invoice"}</CardTitle>
                <CardDescription>{invoice ? "Update the details below to save changes." : "Fill out the details below to generate a new invoice."}</CardDescription>
            </CardHeader>
            <CardContent>
                <InvoiceForm
                    invoice={invoice}
                    customers={customers}
                    items={items}
                    onItemFocus={setSelectedItemId}
                    onCustomerChange={setSelectedCustomerId}
                />
            </CardContent>
        </Card>
      </div>
      {!isMobile && (
        <div className="lg:col-span-2">
            <PriceHistoryPanel itemId={selectedItemId} customerId={selectedCustomerId}/>
        </div>
      )}
    </div>
  );
}
