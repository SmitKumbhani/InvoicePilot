"use client";
import { useEffect, useState, useRef } from "react";
import { getItemPriceHistory } from "@/lib/actions";
import type { PriceHistoryEntry } from "@/lib/types";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { History } from "lucide-react";
import { Table, TableBody, TableCell, TableHeader, TableRow } from "@/components/ui/table";
import { SortableTableHead } from "@/components/ui/sortable-table-head";
import { format } from "date-fns";
import { formatCurrency } from "@/lib/utils";
import { compareDate, compareNumber, useSortableData } from "@/hooks/use-sortable-data";

type PriceHistorySortKey = "issueDate" | "unitPrice";

export function PriceHistoryPanel({ itemId, customerId }: { itemId: string | null, customerId: string | null }) {
  const [history, setHistory] = useState<PriceHistoryEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [itemName, setItemName] = useState<string>("");
  // Call server action directly — NOT through useApi() — to avoid triggering
  // the global full-screen LoadingOverlay on every item focus/selection.
  const fetchIdRef = useRef(0);
  const { sortedData: sortedHistory, sortConfig, requestSort } = useSortableData<PriceHistoryEntry, PriceHistorySortKey>(
    history,
    {
      issueDate: (first, second) => compareDate(first.issueDate, second.issueDate),
      unitPrice: (first, second) => compareNumber(first.unitPrice, second.unitPrice),
    }
  );

  const sortableHeadProps = (key: PriceHistorySortKey) => ({
    active: sortConfig?.key === key,
    direction: sortConfig?.key === key ? sortConfig.direction : undefined,
    onSort: () => requestSort(key),
  });

  useEffect(() => {
    if (itemId && customerId) {
      const currentFetchId = ++fetchIdRef.current;
      setLoading(true);
      getItemPriceHistory(itemId, customerId)
        .then((data) => {
          // Only apply if this is still the latest request (prevents stale responses)
          if (currentFetchId !== fetchIdRef.current) return;
          setHistory(data);
          if (data.length > 0) {
            setItemName(data[0].itemName);
          } else {
            setItemName("");
          }
        })
        .catch((err) => {
          if (currentFetchId !== fetchIdRef.current) return;
          console.error(`[PriceHistoryPanel] Error fetching price history for item=${itemId}, customer=${customerId}:`, err);
          setHistory([]);
          setItemName("");
        })
        .finally(() => {
          if (currentFetchId === fetchIdRef.current) {
            setLoading(false);
          }
        });
    } else {
      setHistory([]);
      setItemName("");
    }
  }, [itemId, customerId]);

  return (
    <Card className="sticky top-20">
      <CardHeader className="p-4 pb-2">
        <CardTitle className="font-headline text-base flex items-center gap-2">
          <History className="w-4 h-4 text-primary" />
          Price History
        </CardTitle>
        <CardDescription className="text-xs">
          Recent purchase history for selected item.
        </CardDescription>
      </CardHeader>
      <CardContent className="p-4 pt-2">
        {loading && <PriceHistorySkeleton />}
        {!loading && (!itemId || !customerId) && (
          <div className="text-center text-xs text-muted-foreground py-6">
            Select customer and item to see price history.
          </div>
        )}
        {!loading && itemId && customerId && history.length === 0 && (
          <div className="text-center text-xs text-muted-foreground py-6">
            No price history found.
          </div>
        )}
        {!loading && itemId && customerId && history.length > 0 && (
          <div className="space-y-3">
            <h4 className="font-semibold text-sm truncate" title={itemName}>{itemName}</h4>
            <Table>
                <TableHeader>
                    <TableRow>
                        <SortableTableHead {...sortableHeadProps("issueDate")} className="text-xs py-2">Date</SortableTableHead>
                        <SortableTableHead {...sortableHeadProps("unitPrice")} className="text-right text-xs py-2" align="right">Price</SortableTableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {sortedHistory.map((entry, index) => (
                        <TableRow key={index}>
                            <TableCell>{format(new Date(new Date(entry.issueDate).toUTCString()), "dd/MM/yyyy")}</TableCell>
                            <TableCell className="text-right">{formatCurrency(entry.unitPrice)}</TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function PriceHistorySkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-6 w-3/4" />
      <div className="space-y-2">
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-8 w-full" />
      </div>
    </div>
  );
}
