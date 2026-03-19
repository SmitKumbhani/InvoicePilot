"use client";
import { useEffect, useState } from "react";
import { useApi } from "@/lib/api";
import type { PriceHistoryEntry } from "@/lib/types";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { History } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { format } from "date-fns";
import { formatCurrency } from "@/lib/utils";

export function PriceHistoryPanel({ itemId, customerId }: { itemId: string | null, customerId: string | null }) {
  const [history, setHistory] = useState<PriceHistoryEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [itemName, setItemName] = useState<string>("");
  const { getItemPriceHistory } = useApi();

  useEffect(() => {
    if (itemId && customerId) {
      setLoading(true);
      getItemPriceHistory(itemId, customerId)
        .then((data) => {
          setHistory(data);
          if (data.length > 0) {
            setItemName(data[0].itemName);
          } else {
            setItemName("");
          }
        })
        .finally(() => setLoading(false));
    } else {
      setHistory([]);
      setItemName("");
    }
  }, [itemId, customerId]);

  return (
    <Card className="sticky top-20">
      <CardHeader>
        <CardTitle className="font-headline flex items-center gap-2">
          <History className="w-6 h-6" />
          Price History
        </CardTitle>
        <CardDescription>
          Purchase price history for the selected item for this customer.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {loading && <PriceHistorySkeleton />}
        {!loading && (!itemId || !customerId) && (
          <div className="text-center text-muted-foreground py-8">
            Select a customer and an item to see its price history.
          </div>
        )}
        {!loading && itemId && customerId && history.length === 0 && (
          <div className="text-center text-muted-foreground py-8">
            No price history available for this item for this customer.
          </div>
        )}
        {!loading && itemId && customerId && history.length > 0 && (
          <div className="space-y-4">
            <h4 className="font-semibold">{itemName}</h4>
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>Purchase Date</TableHead>
                        <TableHead className="text-right">Price</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {history.map((entry, index) => (
                        <TableRow key={index}>
                            <TableCell>{format(new Date(new Date(entry.issueDate).toUTCString()), "MMM d, yyyy")}</TableCell>
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
