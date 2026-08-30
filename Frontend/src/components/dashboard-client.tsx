"use client";

import { useState, useMemo } from "react";
import { SaleItem, Customer, Item } from "@/lib/types";
import { formatCurrency, cn } from "@/lib/utils";
import { format, isAfter, isBefore, startOfDay, endOfDay } from "date-fns";
import { CalendarIcon, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";

type DashboardClientProps = {
  sales: SaleItem[];
  customers: Customer[];
  items: Item[];
};

export function DashboardClient({ sales, customers, items }: DashboardClientProps) {
  // Default to current Indian Financial Year
  const today = new Date();
  const currentMonth = today.getMonth(); // 0-indexed (0 = Jan, 3 = Apr)
  const financialYearStart = new Date(currentMonth >= 3 ? today.getFullYear() : today.getFullYear() - 1, 3, 1); // April 1st

  // Draft filters (changed by user but not applied yet)
  const [draftStatus, setDraftStatus] = useState<string>("all");
  const [draftCustomer, setDraftCustomer] = useState<string>("all");
  const [draftGroup, setDraftGroup] = useState<string>("all");
  const [draftItem, setDraftItem] = useState<string>("all");
  const [draftDateFrom, setDraftDateFrom] = useState<Date | undefined>(financialYearStart);
  const [draftDateTo, setDraftDateTo] = useState<Date | undefined>(today);

  // Applied filters (used for filtering the actual data)
  const [appliedFilters, setAppliedFilters] = useState({
    status: "all",
    customer: "all",
    group: "all",
    item: "all",
    dateFrom: financialYearStart as Date | undefined,
    dateTo: today as Date | undefined,
  });

  const handleApply = () => {
    setAppliedFilters({
      status: draftStatus,
      customer: draftCustomer,
      group: draftGroup,
      item: draftItem,
      dateFrom: draftDateFrom,
      dateTo: draftDateTo,
    });
  };

  const itemGroups = useMemo(() => {
    const groups = new Set(items.map(item => item.group_name || "Uncategorized"));
    return Array.from(groups).sort();
  }, [items]);

  const filteredSales = useMemo(() => {
    return sales.filter((sale) => {
      if (appliedFilters.status !== "all" && sale.status !== appliedFilters.status) return false;
      if (appliedFilters.customer !== "all" && sale.customerId !== appliedFilters.customer) return false;
      if (appliedFilters.group !== "all" && (sale.groupName || "Uncategorized") !== appliedFilters.group) return false;
      if (appliedFilters.item !== "all" && sale.itemId !== appliedFilters.item) return false;
      
      const saleDate = new Date(sale.issueDate);
      if (appliedFilters.dateFrom && isBefore(saleDate, startOfDay(appliedFilters.dateFrom))) return false;
      if (appliedFilters.dateTo && isAfter(saleDate, endOfDay(appliedFilters.dateTo))) return false;

      return true;
    });
  }, [sales, appliedFilters]);

  const summary = useMemo(() => {
    let totalQuantity = 0;
    let totalAmount = 0;
    filteredSales.forEach(sale => {
      totalQuantity += sale.quantity;
      totalAmount += sale.totalAmount;
    });
    const avgSellingPrice = totalQuantity > 0 ? totalAmount / totalQuantity : 0;

    return { totalQuantity, totalAmount, avgSellingPrice };
  }, [filteredSales]);

  const exportCSV = () => {
    const headers = ["Date", "Invoice #", "Customer", "Item Name", "Group Name", "Quantity", "Selling Price", "Total Amount", "Status"];
    const rows = filteredSales.map(sale => [
      format(new Date(sale.issueDate), "yyyy-MM-dd"),
      sale.invoiceNumber,
      `"${sale.customerName}"`,
      `"${sale.itemName}"`,
      `"${sale.groupName || ""}"`,
      sale.quantity,
      sale.unitPrice,
      sale.totalAmount,
      sale.status
    ]);
    
    const csvContent = [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `sales_export_${format(new Date(), "yyyyMMdd")}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold font-headline tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground">Sales summary and insights.</p>
        </div>
        <Button onClick={exportCSV} variant="outline" className="gap-2">
          <Download className="h-4 w-4" /> Export CSV
        </Button>
      </div>

      <Card>
        <CardContent className="p-4 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={draftStatus} onValueChange={setDraftStatus}>
                <SelectTrigger><SelectValue placeholder="All Statuses" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="paid">Paid</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="partially-paid">Partially Paid</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Customer</Label>
              <Select value={draftCustomer} onValueChange={setDraftCustomer}>
                <SelectTrigger><SelectValue placeholder="All Customers" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Customers</SelectItem>
                  {customers.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Item Group</Label>
              <Select value={draftGroup} onValueChange={setDraftGroup}>
                <SelectTrigger><SelectValue placeholder="All Groups" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Groups</SelectItem>
                  {itemGroups.map(g => <SelectItem key={g} value={g}>{g}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Item Name</Label>
              <Select value={draftItem} onValueChange={setDraftItem}>
                <SelectTrigger><SelectValue placeholder="All Items" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Items</SelectItem>
                  {items.map(i => <SelectItem key={i.id} value={i.id}>{i.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>From Date</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant={"outline"} className={cn("w-full justify-start text-left font-normal", !draftDateFrom && "text-muted-foreground")}>
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {draftDateFrom ? format(draftDateFrom, "PPP") : <span>Pick a date</span>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0"><Calendar mode="single" selected={draftDateFrom} onSelect={setDraftDateFrom} initialFocus /></PopoverContent>
              </Popover>
            </div>

            <div className="space-y-2">
              <Label>To Date</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant={"outline"} className={cn("w-full justify-start text-left font-normal", !draftDateTo && "text-muted-foreground")}>
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {draftDateTo ? format(draftDateTo, "PPP") : <span>Pick a date</span>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0"><Calendar mode="single" selected={draftDateTo} onSelect={setDraftDateTo} initialFocus /></PopoverContent>
              </Popover>
            </div>
          </div>
          
          <div className="flex justify-end">
             <Button onClick={handleApply}>Apply Filters</Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Quantity</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary.totalQuantity}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Selling Price</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(summary.avgSellingPrice)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Amount</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(summary.totalAmount)}</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Invoice #</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Item Name</TableHead>
                <TableHead>Group</TableHead>
                <TableHead className="text-right">Quantity</TableHead>
                <TableHead className="text-right">Selling Price</TableHead>
                <TableHead className="text-right">Total Amount</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredSales.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="h-24 text-center">
                    No sales found for the selected filters.
                  </TableCell>
                </TableRow>
              ) : (
                filteredSales.map((sale) => (
                  <TableRow key={sale.id}>
                    <TableCell className="whitespace-nowrap">{format(new Date(sale.issueDate), "yyyy-MM-dd")}</TableCell>
                    <TableCell className="whitespace-nowrap">{sale.invoiceNumber}</TableCell>
                    <TableCell>{sale.customerName}</TableCell>
                    <TableCell>{sale.itemName}</TableCell>
                    <TableCell>{sale.groupName || "-"}</TableCell>
                    <TableCell className="text-right">{sale.quantity}</TableCell>
                    <TableCell className="text-right">{formatCurrency(sale.unitPrice)}</TableCell>
                    <TableCell className="text-right">{formatCurrency(sale.totalAmount)}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
