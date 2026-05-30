
"use client";

import type { Invoice, Customer } from "@/lib/types";
import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCurrency, cn } from "@/lib/utils";
import { format } from "date-fns";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Pencil, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { CustomerDialog } from "./customer-dialog";
import { CustomerPaymentDialog } from "./customer-payment-dialog";
import { CustomerLedgerDialog } from "./customer-ledger-dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useApi } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { useIsMobile } from "@/hooks/use-mobile";

type CustomerWithPending = Customer & {
  pendingAmount: number;
  customerCredit: number;
  invoices: Invoice[];
};

type CustomerClientProps = {
  customers: CustomerWithPending[];
  totals: {
    pendingAmount: number;
    customerCredit: number;
  };
  onCustomerUpdate: () => void;
};

const statusVariant: { [key in Invoice["status"]]: string } = {
    paid: "bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300",
    "partially-paid": "bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300",
    pending: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/50 dark:text-yellow-300",
    draft: "bg-gray-100 text-gray-800 dark:bg-gray-900/50 dark:text-gray-300",
  };

function InvoiceSubTable({ invoices }: { invoices: Invoice[] }) {
    const router = useRouter();
    const handleRowClick = (invoiceId: string) => {
        router.push(`/invoices/${invoiceId}`);
    };
    return (
        <Table>
            <TableHeader>
                <TableRow>
                    <TableHead>Invoice #</TableHead>
                    <TableHead>Issue Date</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Amount Due</TableHead>
                </TableRow>
            </TableHeader>
            <TableBody>
                {invoices.map(invoice => (
                    <TableRow key={invoice.id} className="cursor-pointer hover:bg-muted/50" onClick={() => handleRowClick(invoice.id)}>
                        <TableCell className="font-medium">{invoice.invoiceNumber}</TableCell>
                        <TableCell>{format(new Date(new Date(invoice.issueDate).toUTCString()), 'MMM d, yyyy')}</TableCell>
                        <TableCell>
                            <Badge variant="outline" className={cn("border-transparent", statusVariant[invoice.status])}>
                                {invoice.status.charAt(0).toUpperCase() + invoice.status.slice(1).replace('-', ' ')}
                            </Badge>
                        </TableCell>
                        <TableCell className="text-right">{formatCurrency(Math.max(invoice.total - invoice.amountPaid, 0))}</TableCell>
                    </TableRow>
                ))}
            </TableBody>
        </Table>
    )
}

function CustomerBalance({ customer }: { customer: CustomerWithPending }) {
  const due = Math.max(customer.pendingAmount, 0);
  const credit = Math.max(customer.customerCredit || 0, 0);

  if (due > 0) {
    return <span className="font-semibold">{formatCurrency(due)}</span>;
  }

  if (credit > 0) {
    return (
      <span className="font-semibold text-emerald-700 dark:text-emerald-300">
        Credit {formatCurrency(credit)}
      </span>
    );
  }

  return <span className="font-semibold">{formatCurrency(0)}</span>;
}

function CustomerActions({
  customer,
  onEdit,
  onDelete,
  onRecordPayment,
  onViewLedger,
  isDeleting,
}: {
  customer: CustomerWithPending;
  onEdit: (e: React.MouseEvent, customer: Customer) => void;
  onDelete: (e: React.MouseEvent, customerId: string) => void;
  onRecordPayment: (e: React.MouseEvent, customer: CustomerWithPending) => void;
  onViewLedger: (e: React.MouseEvent, customer: CustomerWithPending) => void;
  isDeleting: boolean;
}) {
  return (
    <div className="flex items-center justify-end gap-1">
      <Button variant="outline" size="sm" onClick={(e) => onRecordPayment(e, customer)}>
        Record Payment
      </Button>
      <Button variant="secondary" size="sm" onClick={(e) => onViewLedger(e, customer)}>
        Ledger
      </Button>
      <Button variant="ghost" size="icon" onClick={(e) => onEdit(e, customer)}>
        <Pencil className="h-4 w-4" />
        <span className="sr-only">Edit</span>
      </Button>
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button variant="ghost" size="icon" onClick={(e) => e.stopPropagation()}>
            <Trash2 className="h-4 w-4 text-destructive" />
            <span className="sr-only">Delete</span>
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent onClick={(e) => e.stopPropagation()}>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the customer and all associated invoices.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={(e) => onDelete(e, customer.id)}
              disabled={isDeleting}
              className="bg-destructive hover:bg-destructive/90"
            >
              {isDeleting ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

export function CustomerClient({ customers, totals, onCustomerUpdate }: CustomerClientProps) {
  const { toast } = useToast();
  const { deleteCustomer } = useApi();
  const [expandedCustomerId, setExpandedCustomerId] = useState<string | null>(null);
  const [isCustomerDialogOpen, setIsCustomerDialogOpen] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [isPaymentDialogOpen, setIsPaymentDialogOpen] = useState(false);
  const [selectedPaymentCustomer, setSelectedPaymentCustomer] = useState<CustomerWithPending | null>(null);
  const [isLedgerDialogOpen, setIsLedgerDialogOpen] = useState(false);
  const [selectedLedgerCustomer, setSelectedLedgerCustomer] = useState<CustomerWithPending | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const isMobile = useIsMobile();
  const [localCustomers, setLocalCustomers] = useState(customers);

  useEffect(() => {
    setLocalCustomers(customers);
  }, [customers]);

  const toggleCustomer = (customerId: string) => {
    setExpandedCustomerId(prevId => prevId === customerId ? null : customerId);
  };
  
  const handleEditCustomer = (e: React.MouseEvent, customer: Customer) => {
    e.stopPropagation();
    setSelectedCustomer(customer);
    setIsCustomerDialogOpen(true);
  };
  
  const handleDeleteCustomer = async (e: React.MouseEvent, customerId: string) => {
    e.stopPropagation();
    setIsDeleting(true);
    try {
      await deleteCustomer(customerId);
      toast({
        title: "Success",
        description: "Customer deleted successfully.",
      });
      onCustomerUpdate();
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to delete customer.",
      });
    } finally {
      setIsDeleting(false);
    }
  };

  const handleDialogClose = (open: boolean) => {
    setIsCustomerDialogOpen(open);
    if (!open) {
      setSelectedCustomer(null);
    }
  };

  const handleRecordPayment = (e: React.MouseEvent, customer: CustomerWithPending) => {
    e.stopPropagation();
    setSelectedPaymentCustomer(customer);
    setIsPaymentDialogOpen(true);
  };

  const handlePaymentDialogClose = (open: boolean) => {
    setIsPaymentDialogOpen(open);
    if (!open) {
      setSelectedPaymentCustomer(null);
    }
  };

  const handleViewLedger = (e: React.MouseEvent, customer: CustomerWithPending) => {
    e.stopPropagation();
    setSelectedLedgerCustomer(customer);
    setIsLedgerDialogOpen(true);
  };

  const handleLedgerDialogClose = (open: boolean) => {
    setIsLedgerDialogOpen(open);
    if (!open) {
      setSelectedLedgerCustomer(null);
    }
  };

  let customerContent: React.ReactNode;
  if (isMobile) {
    customerContent = (
      <div className="space-y-4">
        {localCustomers.length === 0 ? (
          <div className="text-center text-muted-foreground mt-8">
            No customers found.
          </div>
        ) : (
          localCustomers.map((customer) => (
            <React.Fragment key={customer.id}>
              <Card onClick={() => toggleCustomer(customer.id)} className="cursor-pointer">
                <CardHeader>
                  <CardTitle>{customer.name}</CardTitle>
                  <CardDescription>{customer.phone}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Balance</span>
                    <CustomerBalance customer={customer} />
                  </div>
                </CardContent>
                <CardFooter className="flex justify-end">
                  <CustomerActions
                    customer={customer}
                    onEdit={handleEditCustomer}
                    onDelete={handleDeleteCustomer}
                    onRecordPayment={handleRecordPayment}
                    onViewLedger={handleViewLedger}
                    isDeleting={isDeleting}
                  />
                </CardFooter>
                {expandedCustomerId === customer.id && (
                  <div className="mt-4 border-t p-4 pt-0">
                    <h4 className="mb-2 text-sm font-semibold">Pending Invoices</h4>
                    {customer.invoices.length > 0 ? (
                      <InvoiceSubTable invoices={customer.invoices} />
                    ) : (
                      <p className="text-sm text-muted-foreground">No pending invoices.</p>
                    )}
                  </div>
                )}
              </Card>
            </React.Fragment>
          ))
        )}
        <Card className="border-dashed bg-muted/20">
          <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-medium">Ledger totals</p>
              <p className="text-xs text-muted-foreground">Across all customers</p>
            </div>
            <div className="flex flex-col gap-1 text-sm sm:text-right">
              <div className="flex items-center justify-between gap-8 sm:justify-end">
                <span className="text-muted-foreground">Pending</span>
                <span className="font-semibold">{formatCurrency(totals.pendingAmount)}</span>
              </div>
              <div className="flex items-center justify-between gap-8 sm:justify-end">
                <span className="text-muted-foreground">Credit</span>
                <span className="font-semibold text-emerald-700 dark:text-emerald-300">
                  {formatCurrency(totals.customerCredit)}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  } else {
    customerContent = (
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50 hover:bg-muted/50">
                <TableHead className="w-1/3">Customer</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead className="text-right">Balance</TableHead>
                <TableHead className="w-72 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {localCustomers.map((customer) => (
                <React.Fragment key={customer.id}>
                  <TableRow onClick={() => toggleCustomer(customer.id)} className="cursor-pointer">
                    <TableCell className="font-medium">{customer.name}</TableCell>
                    <TableCell>{customer.phone}</TableCell>
                    <TableCell className="text-right">
                      <CustomerBalance customer={customer} />
                    </TableCell>
                    <TableCell className="text-right">
                      <CustomerActions
                        customer={customer}
                        onEdit={handleEditCustomer}
                        onDelete={handleDeleteCustomer}
                        onRecordPayment={handleRecordPayment}
                        onViewLedger={handleViewLedger}
                        isDeleting={isDeleting}
                      />
                    </TableCell>
                  </TableRow>
                  {expandedCustomerId === customer.id && (
                    <TableRow>
                      <TableCell colSpan={4} className="p-0">
                        <div className="bg-muted/20 p-4">
                          <h4 className="mb-2 px-4 font-semibold">Pending Invoices</h4>
                          {customer.invoices.length > 0 ? (
                            <InvoiceSubTable invoices={customer.invoices} />
                          ) : (
                            <p className="px-4 text-sm text-muted-foreground">No pending invoices.</p>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                </React.Fragment>
              ))}
            </TableBody>
            <TableFooter>
              <TableRow className="bg-muted/30 hover:bg-muted/30">
                <TableCell colSpan={2}>
                  <div>
                    <div className="font-semibold">Ledger totals</div>
                    <div className="text-xs text-muted-foreground">Across all customers</div>
                  </div>
                </TableCell>
                <TableCell className="text-right">
                  <div className="font-semibold">{formatCurrency(totals.pendingAmount)}</div>
                  <div className="text-xs text-muted-foreground">Pending</div>
                </TableCell>
                <TableCell className="text-right">
                  <div className="font-semibold text-emerald-700 dark:text-emerald-300">
                    {formatCurrency(totals.customerCredit)}
                  </div>
                  <div className="text-xs text-muted-foreground">Credit</div>
                </TableCell>
              </TableRow>
            </TableFooter>
          </Table>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
    {customerContent}
    <CustomerDialog
        key={selectedCustomer?.id}
        open={isCustomerDialogOpen}
        onOpenChange={handleDialogClose}
        customer={selectedCustomer}
        onCustomerUpdate={onCustomerUpdate}
      />
      <CustomerPaymentDialog
        open={isPaymentDialogOpen}
        onOpenChange={handlePaymentDialogClose}
        customer={selectedPaymentCustomer}
        onPaymentRecorded={onCustomerUpdate}
      />
      <CustomerLedgerDialog
        open={isLedgerDialogOpen}
        onOpenChange={handleLedgerDialogClose}
        customer={selectedLedgerCustomer}
      />
    </>
  );
}
