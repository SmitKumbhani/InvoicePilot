
"use client";

import { useState, useEffect, useMemo } from "react";
import type { Item } from "@/lib/types";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { SortableTableHead } from "@/components/ui/sortable-table-head";
import { Button } from "@/components/ui/button";
import { PlusCircle, Pencil } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { ItemDialog } from "./item-dialog";
import { useIsMobile } from "@/hooks/use-mobile";
import { compareNumber, compareText, useSortableData } from "@/hooks/use-sortable-data";

type ItemsClientProps = {
  items: Item[];
};

type ItemSortKey = "name" | "group" | "price";

export function ItemsClient({ items: initialItems }: ItemsClientProps) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<Item | null>(null);
  const [items, setItems] = useState(initialItems);
  
  const [itemSearch, setItemSearch] = useState("");
  const [groupSearch, setGroupSearch] = useState("");

  const filteredItems = useMemo(() => {
    return items.filter(item => {
      const matchesItem = item.name.toLowerCase().includes(itemSearch.toLowerCase());
      const matchesGroup = (item.group_name || "").toLowerCase().includes(groupSearch.toLowerCase());
      return matchesItem && matchesGroup;
    });
  }, [items, itemSearch, groupSearch]);

  const isMobile = useIsMobile();
  const { sortedData: sortedItems, sortConfig, requestSort } = useSortableData<Item, ItemSortKey>(
    filteredItems,
    {
      name: (first, second) => compareText(first.name, second.name),
      group: (first, second) => compareText(first.group_name, second.group_name),
      price: (first, second) => compareNumber(first.price, second.price),
    }
  );

  const sortableHeadProps = (key: ItemSortKey) => ({
    active: sortConfig?.key === key,
    direction: sortConfig?.key === key ? sortConfig.direction : undefined,
    onSort: () => requestSort(key),
  });

  useEffect(() => {
    setItems(initialItems);
  }, [initialItems]);

  const handleEdit = (item: Item) => {
    setSelectedItem(item);
    setIsDialogOpen(true);
  };

  const handleAdd = () => {
    setSelectedItem(null);
    setIsDialogOpen(true);
  }

  const handleDialogClose = (open: boolean) => {
    if (!open) {
      setSelectedItem(null);
    }
    setIsDialogOpen(open);
  }

  const itemsContent = sortedItems.length === 0 ? (
    <div className="text-center text-muted-foreground mt-8">
      No items found.
    </div>
  ) : (
    isMobile ? (
      <div className="space-y-4">
        {sortedItems.map((item) => (
          <Card key={item.id}>
            <CardHeader>
              <CardTitle>{item.name}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Group</span>
                <span>{item.group_name || 'N/A'}</span>
              </div>
              <div className="flex justify-between font-semibold">
                <span className="text-foreground">Sale Price</span>
                <span>{formatCurrency(item.price)}</span>
              </div>
            </CardContent>
            <CardFooter className="flex justify-end">
              <Button variant="ghost" size="icon" onClick={() => handleEdit(item)}>
                <Pencil className="h-4 w-4" />
                <span className="sr-only">Edit</span>
              </Button>
            </CardFooter>
          </Card>
        ))}
      </div>
    ) : (
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <SortableTableHead {...sortableHeadProps("name")}>Item Name</SortableTableHead>
                <SortableTableHead {...sortableHeadProps("group")}>Group</SortableTableHead>
                <SortableTableHead {...sortableHeadProps("price")} className="text-right" align="right">Sale Price</SortableTableHead>
                <TableHead className="w-20 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedItems.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="font-medium">{item.name}</TableCell>
                  <TableCell>{item.group_name}</TableCell>
                  <TableCell className="text-right">
                    {formatCurrency(item.price)}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="icon" onClick={() => handleEdit(item)}>
                      <Pencil className="h-4 w-4" />
                      <span className="sr-only">Edit</span>
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    )
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex flex-col sm:flex-row gap-4 w-full sm:w-auto flex-1">
          <Input 
            placeholder="Search by item name..." 
            value={itemSearch}
            onChange={(e) => setItemSearch(e.target.value)}
            className="max-w-xs"
          />
          <Input 
            placeholder="Search by group..." 
            value={groupSearch}
            onChange={(e) => setGroupSearch(e.target.value)}
            className="max-w-xs"
          />
        </div>
        <Button onClick={handleAdd}>
          <PlusCircle className="mr-2 h-4 w-4" />
          Add New Item
        </Button>
      </div>
      {itemsContent}
      <ItemDialog 
        key={selectedItem?.id}
        open={isDialogOpen} 
        onOpenChange={handleDialogClose} 
        item={selectedItem} 
      />
    </div>
  );
}
