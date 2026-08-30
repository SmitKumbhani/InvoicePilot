"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import {
  SidebarContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
} from "@/components/ui/sidebar";
import { BookCopy, FilePlus, Bird, Users, Package, LayoutDashboard } from "lucide-react";

const menuItems = [
  {
    href: "/dashboard",
    label: "Dashboard",
    icon: LayoutDashboard,
  },
  {
    href: "/",
    label: "Ledger",
    icon: BookCopy,
  },
  {
    href: "/customers",
    label: "Customers",
    icon: Users
  },
  {
    href: "/items",
    label: "Items",
    icon: Package
  },
  {
    href: "/invoices/new",
    label: "New Invoice",
    icon: FilePlus,
  },
];

export function AppSidebar() {
  const pathname = usePathname();
  
  return (
    <SidebarContent className="p-2">
      <div className="p-2 flex justify-center">
        <Link href="/" className="flex items-center gap-2 font-semibold font-headline">
            <Bird className="h-8 w-8 text-primary" />
        </Link>
      </div>
      <SidebarMenu>
        {menuItems.map((item) => (
          <SidebarMenuItem key={item.href}>
            <SidebarMenuButton
              asChild
              isActive={pathname === item.href}
              tooltip={item.label}
            >
              <Link href={item.href}>
                <item.icon />
                <span>{item.label}</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        ))}
      </SidebarMenu>
    </SidebarContent>
  );
}
