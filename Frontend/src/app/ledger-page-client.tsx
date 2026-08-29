"use client";

import { LedgerClient } from "@/components/ledger-client";
import { Search } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { useState, useMemo } from "react";
import type { Invoice } from "@/lib/types";
import { Input } from "@/components/ui/input";

export default function LedgerPageClient({ invoices }: { invoices: Invoice[] }) {
  const [searchTerm, setSearchTerm] = useState("");
  
  const filteredInvoices = useMemo(() => {
    return invoices?.filter(invoice => {
      const invoiceNumber = invoice.invoiceNumber?.toLowerCase() || "";
      const customerName = invoice.customer?.name?.toLowerCase() || "";
      const lowerCaseSearchTerm = searchTerm.toLowerCase();

      return (
        invoiceNumber.includes(lowerCaseSearchTerm) ||
        customerName.includes(lowerCaseSearchTerm)
      );
    });
  }, [invoices, searchTerm]);

  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold font-headline tracking-tight">Ledger</h1>
          <p className="text-muted-foreground">
            Track and manage all your invoices.
          </p>
        </div>
        <Button asChild>
          <Link href="/invoices/new">
            New Invoice
          </Link>
        </Button>
      </div>
      <div className="relative">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          type="search"
          placeholder="Search invoices by number or customer..."
          className="pl-8"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>
      <LedgerClient invoices={filteredInvoices} onInvoiceUpdate={() => {}} />
    </div>
  );
}
