
"use client";

import { useState, useEffect } from "react";
import type { Invoice } from "@/lib/types";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { formatCurrency, cn } from "@/lib/utils";
import { format } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { useRouter } from "next/navigation";
import { Button } from "./ui/button";
import { Printer, Trash2 } from "lucide-react";
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
import { InvoicePrintInterceptorDialog } from "./invoice-print-interceptor-dialog";

type LedgerClientProps = {
  invoices: Invoice[];
  onInvoiceUpdate: () => void;
};

const statusVariant: { [key in Invoice["status"]]: string } = {
  paid: "bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300",
  "partially-paid": "bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300",
  pending: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/50 dark:text-yellow-300",
  draft: "bg-gray-100 text-gray-800 dark:bg-gray-900/50 dark:text-gray-300",
};

export function LedgerClient({ invoices: initialInvoices, onInvoiceUpdate }: LedgerClientProps) {
  const [invoices, setInvoices] = useState(initialInvoices);
  const [filter, setFilter] = useState<"all" | Invoice["status"]>("all");
  const router = useRouter();
  const { toast } = useToast();
  const { deleteInvoice, getInvoices } = useApi();
  const [isDeleting, setIsDeleting] = useState(false);
  const [isPrintDialogOpen, setIsPrintDialogOpen] = useState(false);
  const [printContext, setPrintContext] = useState<{
    invoiceId: string;
    invoiceNumber: string;
    invoiceTotal: number;
    previousBalanceDue: number;
    amountPaid: number;
  } | null>(null);
  const isMobile = useIsMobile();

  // Keep local state in sync with props
  useEffect(() => {
    setInvoices(initialInvoices);
  }, [initialInvoices]);

  const filteredInvoices = invoices.filter((invoice) => {
    if (filter === "all") return true;
    return invoice.status === filter;
  });

  const tabValues: (Invoice["status"] | "all")[] = ["all", "pending", "partially-paid", "paid"];

  const handleRowClick = (invoiceId: string) => {
    router.push(`/invoices/${invoiceId}`);
  };

  const handlePrint = async (e: React.MouseEvent, invoiceId: string) => {
    e.stopPropagation();
    const fallbackInvoice = invoices.find((invoice) => invoice.id === invoiceId);
    if (!fallbackInvoice) {
      return;
    }

    setPrintContext({
      invoiceId: fallbackInvoice.id,
      invoiceNumber: fallbackInvoice.invoiceNumber,
      invoiceTotal: fallbackInvoice.total,
      previousBalanceDue: 0,
      amountPaid: fallbackInvoice.amountPaid,
    });
    setIsPrintDialogOpen(true);

    try {
      const allInvoices = await getInvoices();
      const selected = allInvoices.find((invoice) => invoice.id === invoiceId);
      if (!selected) {
        return;
      }

      const previousBalanceDue = allInvoices
        .filter((invoice) => invoice.customerId === selected.customerId && invoice.id !== selected.id)
        .reduce((sum, invoice) => sum + Math.max(invoice.total - invoice.amountPaid, 0), 0);

      setPrintContext({
        invoiceId: selected.id,
        invoiceNumber: selected.invoiceNumber,
        invoiceTotal: selected.total,
        previousBalanceDue,
        amountPaid: selected.amountPaid,
      });
    } catch {
      // Keep fallback context if this fetch fails.
    }
  };

  const handleDeleteInvoice = async (e: React.MouseEvent, invoiceId: string) => {
    e.stopPropagation();
    setIsDeleting(true);
    try {
      await deleteInvoice(invoiceId);
      toast({
        title: "Success",
        description: "Invoice deleted successfully.",
      });
      // Trigger update on parent page
      onInvoiceUpdate();
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to delete invoice.",
      });
    } finally {
      setIsDeleting(false);
    }
  };


  return (
    <>
      <Tabs
        defaultValue="all"
        onValueChange={(value) => setFilter(value as any)}
      >
        <TabsList className="grid w-full grid-cols-4 md:w-fit">
          {tabValues.map((value) => (
            <TabsTrigger key={value} value={value} className="capitalize">{value.replace('-', ' ')}</TabsTrigger>
          ))}
        </TabsList>
        {tabValues.map((value) => (
            <TabsContent key={value} value={value}>
                {isMobile ? (
                  <InvoiceCardList
                    invoices={filteredInvoices} 
                    onCardClick={handleRowClick} 
                    onPrintClick={handlePrint}
                    onDeleteClick={handleDeleteInvoice}
                    isDeleting={isDeleting}
                  />
                ) : (
                  <InvoiceTable 
                      invoices={filteredInvoices} 
                      onRowClick={handleRowClick} 
                      onPrintClick={handlePrint}
                      onDeleteClick={handleDeleteInvoice}
                      isDeleting={isDeleting}
                  />
                )}
            </TabsContent>
        ))}
      </Tabs>
      <InvoicePrintInterceptorDialog
        open={isPrintDialogOpen}
        onOpenChange={setIsPrintDialogOpen}
        invoiceId={printContext?.invoiceId ?? null}
        invoiceNumber={printContext?.invoiceNumber}
        invoiceTotal={printContext?.invoiceTotal}
        previousBalanceDue={printContext?.previousBalanceDue}
        amountPaid={printContext?.amountPaid}
      />
    </>
  );
}

type InvoiceActionProps = {
  invoiceId: string;
  invoiceNumber: string;
  onPrintClick: (e: React.MouseEvent, invoiceId: string) => void | Promise<void>;
  onDeleteClick: (e: React.MouseEvent, invoiceId: string) => Promise<void>;
  isDeleting: boolean;
};

function InvoiceActions({ invoiceId, invoiceNumber, onPrintClick, onDeleteClick, isDeleting }: InvoiceActionProps) {
  return (
    <div className="flex items-center justify-end">
      <Button variant="ghost" size="icon" onClick={(e) => onPrintClick(e, invoiceId)}>
        <Printer className="h-4 w-4" />
        <span className="sr-only">Print</span>
      </Button>
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button variant="ghost" size="icon" onClick={(e) => e.stopPropagation()}>
            <Trash2 className="h-4 w-4 text-destructive" />
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent onClick={(e) => e.stopPropagation()}>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the invoice {invoiceNumber}.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={(e) => onDeleteClick(e, invoiceId)}
              disabled={isDeleting}
              className="bg-destructive hover:bg-destructive/90"
            >
              {isDeleting ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}


type InvoiceCardListProps = {
  invoices: Invoice[];
  onCardClick: (invoiceId: string) => void;
  onPrintClick: (e: React.MouseEvent, invoiceId: string) => void | Promise<void>;
  onDeleteClick: (e: React.MouseEvent, invoiceId: string) => Promise<void>;
  isDeleting: boolean;
};

function InvoiceCardList({ invoices, onCardClick, onPrintClick, onDeleteClick, isDeleting }: InvoiceCardListProps) {
  if (invoices.length === 0) {
    return (
      <div className="text-center text-muted-foreground mt-8">
        No invoices found.
      </div>
    );
  }
  return (
    <div className="space-y-4">
      {invoices.map((invoice) => (
        <Card key={invoice.id} onClick={() => onCardClick(invoice.id)} className="cursor-pointer">
          <CardHeader>
            <div className="flex justify-between items-start">
              <div>
                <CardTitle>{invoice.invoiceNumber}</CardTitle>
                <CardDescription>{invoice.customer.name}</CardDescription>
              </div>
              <Badge variant={"outline"} className={cn("border-transparent", statusVariant[invoice.status])}>
                {invoice.status.charAt(0).toUpperCase() + invoice.status.slice(1).replace("-", " ")}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Issue Date</span>
                <span>{invoice.issueDate ? format(new Date(new Date(invoice.issueDate).toUTCString()), "MMM d, yyyy") : ""}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Total</span>
                <span>{formatCurrency(invoice.total)}</span>
              </div>
              <div className="flex justify-between font-semibold">
                <span className="text-foreground">Amount Due</span>
                <span>{formatCurrency(Math.max(invoice.total - invoice.amountPaid, 0))}</span>
              </div>
          </CardContent>
          <CardFooter className="flex justify-end">
             <InvoiceActions 
                invoiceId={invoice.id} 
                invoiceNumber={invoice.invoiceNumber}
                onPrintClick={onPrintClick}
                onDeleteClick={onDeleteClick}
                isDeleting={isDeleting}
              />
          </CardFooter>
        </Card>
      ))}
    </div>
  );
}


type InvoiceTableProps = {
  invoices: Invoice[];
  onRowClick: (invoiceId: string) => void;
  onPrintClick: (e: React.MouseEvent, invoiceId: string) => void | Promise<void>;
  onDeleteClick: (e: React.MouseEvent, invoiceId: string) => Promise<void>;
  isDeleting: boolean;
};

function InvoiceTable({ invoices, onRowClick, onPrintClick, onDeleteClick, isDeleting }: InvoiceTableProps) {
  if (invoices.length === 0) {
    return (
      <div className="text-center text-muted-foreground mt-8">
        No invoices found.
      </div>
    );
  }
  return (
    <Card>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Invoice #</TableHead>
              <TableHead>Customer</TableHead>
              <TableHead className="hidden md:table-cell">Issue Date</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Amount Due</TableHead>
              <TableHead className="text-right hidden md:table-cell">Total</TableHead>
              <TableHead className="text-right w-28">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {invoices.map((invoice) => (
              <TableRow key={invoice.id} onClick={() => onRowClick(invoice.id)} className="cursor-pointer">
                <TableCell className="font-medium">
                  {invoice.invoiceNumber}
                </TableCell>
                <TableCell>{invoice.customer?.name}</TableCell>
                <TableCell className="hidden md:table-cell">
                  {invoice.issueDate ? format(new Date(new Date(invoice.issueDate).toUTCString()), "MMM d, yyyy") : ""}
                </TableCell>
                <TableCell>
                  <Badge
                    variant={"outline"}
                    className={cn("border-transparent", statusVariant[invoice.status])}
                  >
                    {invoice.status.charAt(0).toUpperCase() +
                      invoice.status.slice(1).replace("-", " ")}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  {formatCurrency(Math.max(invoice.total - invoice.amountPaid, 0))}
                </TableCell>
                <TableCell className="text-right hidden md:table-cell">
                  {formatCurrency(invoice.total)}
                </TableCell>
                <TableCell className="text-right">
                  <InvoiceActions 
                    invoiceId={invoice.id} 
                    invoiceNumber={invoice.invoiceNumber}
                    onPrintClick={onPrintClick}
                    onDeleteClick={onDeleteClick}
                    isDeleting={isDeleting}
                  />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
