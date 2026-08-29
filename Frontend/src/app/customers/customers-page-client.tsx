"use client";

import { useMemo, useState } from "react";
import { CustomerClient } from "@/components/customer-client";
import { Button } from "@/components/ui/button";
import { PlusCircle, Search } from "lucide-react";
import { CustomerDialog } from "@/components/customer-dialog";
import { Input } from "@/components/ui/input";
import type { Customer, Invoice } from "@/lib/types";

type CustomerWithPending = Customer & {
  pendingAmount: number;
  customerCredit: number;
  invoices: Invoice[];
};

export default function CustomersPageClient({
  customers,
  totals,
}: {
  customers: CustomerWithPending[];
  totals: { pendingAmount: number; customerCredit: number };
}) {
  const [isCustomerDialogOpen, setIsCustomerDialogOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  const filteredCustomers = useMemo(() => {
    return customers.filter(
      (customer) =>
        customer.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        customer.phone.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [customers, searchTerm]);

  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold font-headline tracking-tight">Customers</h1>
          <p className="text-muted-foreground">
            Manage customer balances and view their invoices.
          </p>
        </div>
        <Button onClick={() => setIsCustomerDialogOpen(true)}>
          <PlusCircle />
          Add New Customer
        </Button>
      </div>
      <div className="relative">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          type="search"
          placeholder="Search customers by name or phone..."
          className="pl-8"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>
      <CustomerClient
        customers={filteredCustomers}
        totals={totals}
        onCustomerUpdate={() => {
          // No-op: Server Actions automatically revalidate the path
        }}
      />
      <CustomerDialog
        open={isCustomerDialogOpen}
        onOpenChange={setIsCustomerDialogOpen}
        onCustomerUpdate={() => {
          // No-op: Server Actions automatically revalidate the path
        }}
      />
    </div>
  );
}
