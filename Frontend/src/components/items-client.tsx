
"use client";

import { useState, useEffect } from "react";
import type { Item } from "@/lib/types";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { PlusCircle, Pencil } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { ItemDialog } from "./item-dialog";
import { useIsMobile } from "@/hooks/use-mobile";

type ItemsClientProps = {
  items: Item[];
};

export function ItemsClient({ items: initialItems }: ItemsClientProps) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<Item | null>(null);
  const [items, setItems] = useState(initialItems);
  const isMobile = useIsMobile();

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

  const itemsContent = items.length === 0 ? (
    <div className="text-center text-muted-foreground mt-8">
      No items found.
    </div>
  ) : (
    isMobile ? (
      <div className="space-y-4">
        {items.map((item) => (
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
                <TableHead>Item Name</TableHead>
                <TableHead>Group</TableHead>
                <TableHead className="text-right">Sale Price</TableHead>
                <TableHead className="w-20 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item) => (
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
    <>
      <div className="flex justify-end">
        <Button onClick={handleAdd}>
          <PlusCircle />
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
    </>
  );
}
