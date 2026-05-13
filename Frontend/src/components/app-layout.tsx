"use client";

import { SidebarProvider, Sidebar, SidebarInset } from "@/components/ui/sidebar";
import { AppSidebar } from "./app-sidebar";
import { AppHeader } from "./app-header";
import { useLoader } from "@/hooks/use-loader";
import LoadingOverlay from "./loading-overlay";
import { KillSwitchProvider, useKillSwitch } from "./kill-switch-context";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <KillSwitchProvider>
      <AppLayoutShell>{children}</AppLayoutShell>
    </KillSwitchProvider>
  );
}

function AppLayoutShell({ children }: { children: React.ReactNode }) {
  const { isLoading } = useLoader();
  const { enabled } = useKillSwitch();

  return (
    <SidebarProvider>
      <LoadingOverlay isLoading={isLoading} />
      <Sidebar>
        <AppSidebar />
      </Sidebar>
      <div className="flex flex-1 flex-col">
        <AppHeader />
        <SidebarInset>
          <main className="flex-1 p-4 md:p-6">
            {enabled ? <SafeModePlaceholder /> : children}
          </main>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}

function SafeModePlaceholder() {
  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold font-headline tracking-tight">Ledger</h1>
          <p className="text-muted-foreground">Track and manage all your invoices.</p>
        </div>
        <Button disabled>New Invoice</Button>
      </div>

      <Input
        type="search"
        value=""
        readOnly
        disabled
        placeholder="Search invoices by number or customer..."
      />

      <Tabs value="all">
        <TabsList className="grid w-full grid-cols-4 md:w-fit">
          <TabsTrigger value="all" className="capitalize">all</TabsTrigger>
          <TabsTrigger value="pending" className="capitalize">pending</TabsTrigger>
          <TabsTrigger value="partially-paid" className="capitalize">partially paid</TabsTrigger>
          <TabsTrigger value="paid" className="capitalize">paid</TabsTrigger>
        </TabsList>
      </Tabs>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Invoice #</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead className="text-right">Due</TableHead>
                <TableHead className="w-[96px] text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow>
                <TableCell colSpan={6} className="py-10 text-center text-muted-foreground">
                  No invoices found.
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
