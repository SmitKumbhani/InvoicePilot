
"use client";

import { useApi } from "@/lib/api";
import { LedgerClient } from "@/components/ledger-client";
import { PlusCircle, Search } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { useEffect, useState, useMemo } from "react";
import { Invoice } from "@/lib/types";
import { Input } from "@/components/ui/input";
import { useLoader } from "@/hooks/use-loader";

export default function LedgerPage() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [refreshCount, setRefreshCount] = useState(0);
  const [searchTerm, setSearchTerm] = useState("");
  const { getInvoices } = useApi();
  const { isLoading, showLoader, hideLoader } = useLoader();

  useEffect(() => {
    async function fetchData() {
      showLoader();
      const invoiceList = await getInvoices();
      setInvoices(invoiceList);
      hideLoader();
    }
    fetchData();
  }, [refreshCount]);

  const handleInvoiceUpdate = () => {
    setRefreshCount(prev => prev + 1);
  };
  
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
      <LedgerClient invoices={filteredInvoices} onInvoiceUpdate={handleInvoiceUpdate} />
    </div>
  );
}
