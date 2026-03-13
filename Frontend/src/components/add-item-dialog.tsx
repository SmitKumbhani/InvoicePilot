"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { createItem, updateItem } from "@/lib/actions";
import type { Item } from "@/lib/types";
import { useEffect } from "react";

const itemSchema = z.object({
  name: z.string().min(3, "Item name must be at least 3 characters."),
  price: z.coerce.number().min(0.01, "Sale price must be positive."),
  purchasePrice: z.coerce.number().min(0.01, "Purchase price must be positive.").optional(),
  group_name: z.string().optional(),
});

type ItemFormValues = z.infer<typeof itemSchema>;

type ItemDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item?: Item | null;
};

export function ItemDialog({ open, onOpenChange, item }: ItemDialogProps) {
  const { toast } = useToast();
  const isEditMode = !!item;

  const form = useForm<ItemFormValues>({
    resolver: zodResolver(itemSchema),
    defaultValues: {
      name: "",
      price: 0,
      purchasePrice: 0,
      group_name: "",
    },
  });

  useEffect(() => {
    if (isEditMode && item) {
      form.reset({
        name: item.name,
        price: item.price,
        purchasePrice: item.price, // Assuming purchase price is same as sale price for now
        group_name: item.group_name || "",
      });
    } else {
      form.reset();
    }
  }, [item, isEditMode, form]);
  

  const onSubmit = async (data: ItemFormValues) => {
    try {
      if (isEditMode && item) {
        await updateItem(item.id, data);
        toast({
          title: "Success",
          description: "Item updated successfully.",
        });
      } else {
        await createItem(data);
        toast({
          title: "Success",
          description: "Item created successfully.",
        });
      }
      form.reset();
      onOpenChange(false);
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: `Failed to ${isEditMode ? 'update' : 'create'} item.`,
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>{isEditMode ? "Edit Item" : "Add New Item"}</DialogTitle>
          <DialogDescription>
            {isEditMode ? "Update the details for this item." : "Enter the details for the new item."}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Item Name</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g., Web Design" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="group_name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Group Name (Optional)</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g., Services or Manufacturer" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="price"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Sale Price</FormLabel>
                  <FormControl>
                    <Input type="number" step="0.01" placeholder="1500.00" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="purchasePrice"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Purchase Price</FormLabel>
                  <FormControl>
                    <Input type="number" step="0.01" placeholder="1200.00" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button type="submit" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting ? "Saving..." : (isEditMode ? "Save Changes" : "Save Item")}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
