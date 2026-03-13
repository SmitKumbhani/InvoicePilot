
"use client";
import type { Customer, Item } from "@/lib/types";
import { useState } from "react";
import { InvoiceForm } from "./invoice-form";
import { PriceHistoryPanel } from "./price-history-panel";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "./ui/card";
import { useIsMobile } from "@/hooks/use-mobile";

type InvoiceCreatorProps = {
  customers: Customer[];
  items: Item[];
};

export function InvoiceCreator({ customers, items }: InvoiceCreatorProps) {
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const isMobile = useIsMobile();


  return (
    <div className="grid lg:grid-cols-5 gap-8">
      <div className="lg:col-span-3">
        <Card>
            <CardHeader>
                <CardTitle className="font-headline">Create Invoice</CardTitle>
                <CardDescription>Fill out the details below to generate a new invoice.</CardDescription>
            </CardHeader>
            <CardContent>
                <InvoiceForm
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
