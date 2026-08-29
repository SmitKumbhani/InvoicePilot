"use client";

import * as React from "react";
import { ArrowDown, ArrowUp, ChevronsUpDown } from "lucide-react";

import { TableHead } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import type { SortDirection } from "@/hooks/use-sortable-data";

type SortableTableHeadProps = Omit<
  React.ComponentPropsWithoutRef<typeof TableHead>,
  "onClick"
> & {
  active: boolean;
  direction?: SortDirection;
  onSort: () => void;
  align?: "left" | "center" | "right";
};

export function SortableTableHead({
  active,
  direction,
  onSort,
  align = "left",
  className,
  children,
  ...props
}: SortableTableHeadProps) {
  const Icon = active ? (direction === "asc" ? ArrowUp : ArrowDown) : ChevronsUpDown;

  return (
    <TableHead
      aria-sort={
        active ? (direction === "asc" ? "ascending" : "descending") : "none"
      }
      className={className}
      {...props}
    >
      <button
        type="button"
        onClick={onSort}
        className={cn(
          "inline-flex h-8 w-full items-center gap-1.5 rounded-sm text-sm font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          align === "right" && "justify-end text-right",
          align === "center" && "justify-center text-center",
          align === "left" && "justify-start text-left"
        )}
      >
        <span>{children}</span>
        <Icon className={cn("h-3.5 w-3.5", !active && "opacity-50")} />
      </button>
    </TableHead>
  );
}
