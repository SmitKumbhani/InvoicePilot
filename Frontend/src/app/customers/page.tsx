
"use client";
import { useApi } from "@/lib/api";
import { CustomerClient } from "@/components/customer-client";
import { useEffect, useState, useMemo } from "react";
import { Customer } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { PlusCircle, Search } from "lucide-react";
import { CustomerDialog } from "@/components/customer-dialog";
import { Input } from "@/components/ui/input";

type CustomerWithPending = Customer & {
  pendingAmount: number;
  invoices: any[];
};


export default function CustomersPage() {
    const [customers, setCustomers] = useState<CustomerWithPending[]>([]);
    const [loading, setLoading] = useState(true);
    const [isCustomerDialogOpen, setIsCustomerDialogOpen] = useState(false);
    const [refreshCount, setRefreshCount] = useState(0);
    const [searchTerm, setSearchTerm] = useState("");
    const { getCustomers, getInvoices } = useApi();

    useEffect(() => {
        async function fetchData() {
            setLoading(true);
            const [customerList, invoiceList] = await Promise.all([
                getCustomers(),
                getInvoices()
            ]);

            const customerData = customerList.map(customer => {
                const customerInvoices = invoiceList.filter(inv => inv.customerId === customer.id && inv.status !== 'paid');
                const pendingAmount = customerInvoices.reduce((acc, inv) => acc + (inv.total - inv.amountPaid), 0);
                return {
                    ...customer,
                    pendingAmount,
                    invoices: customerInvoices
                }
            });

            setCustomers(customerData);
            setLoading(false);
        }
        fetchData();
    }, [refreshCount]);

    const handleCustomerUpdate = () => {
        setRefreshCount(prev => prev + 1);
    }

    const filteredCustomers = useMemo(() => {
        return customers.filter(customer =>
            customer.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            customer.phone.toLowerCase().includes(searchTerm.toLowerCase())
        );
    }, [customers, searchTerm]);


    if (loading) {
        return <div>Loading...</div>
    }


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
            <CustomerClient customers={filteredCustomers} onCustomerUpdate={handleCustomerUpdate} />
             <CustomerDialog
                open={isCustomerDialogOpen}
                onOpenChange={setIsCustomerDialogOpen}
                onCustomerUpdate={handleCustomerUpdate}
            />
        </div>
    )
}
