"use client";

import { SidebarProvider, Sidebar, SidebarInset } from "@/components/ui/sidebar";
import { AppSidebar } from "./app-sidebar";
import { AppHeader } from "./app-header";
import { useLoader } from "@/hooks/use-loader";
import LoadingOverlay from "./loading-overlay";

export function AppLayout({ children }: { children: React.ReactNode }) {
  const { isLoading } = useLoader();

  return (
    <SidebarProvider>
      <LoadingOverlay isLoading={isLoading} />
      <Sidebar>
        <AppSidebar />
      </Sidebar>
      <div className="flex flex-1 flex-col">
        <AppHeader />
        <SidebarInset>
          <main className="flex-1 p-4 md:p-6">{children}</main>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}
