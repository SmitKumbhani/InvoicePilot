"use client";

import { useEffect, useMemo } from "react";
import { useForm, useFieldArray, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import type { Customer, Invoice, Item } from "@/lib/types";
import { useApi } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { CalendarIcon, PlusCircle, Trash2 } from "lucide-react";
import { cn, formatCurrency } from "@/lib/utils";
import { format } from "date-fns";
import { useRouter } from "next/navigation";

const lineItemSchema = z.object({
  itemId: z.string().min(1, "Item is required."),
  group_name: z.string().optional(),
  description: z.string().min(1, "Description is required."),
  quantity: z.coerce.number().min(1, "Quantity must be at least 1."),
  unitPrice: z.coerce.number().min(0, "Price must be 0 or greater."),
});

const invoiceEditSchema = z.object({
  customerId: z.string().min(1, "Customer is required."),
  issueDate: z.date({ required_error: "Issue date is required." }),
  lineItems: z.array(lineItemSchema).min(1, "At least one item is required."),
});

type InvoiceEditValues = z.infer<typeof invoiceEditSchema>;

type InvoiceEditDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  invoice: Invoice;
  customers: Customer[];
  items: Item[];
  onInvoiceUpdated: (invoice: Invoice) => void;
};

export function InvoiceEditDialog({
  open,
  onOpenChange,
  invoice,
  customers,
  items,
  onInvoiceUpdated,
}: InvoiceEditDialogProps) {
  const { updateInvoice } = useApi();
  const { toast } = useToast();
  const router = useRouter();

  const form = useForm<InvoiceEditValues>({
    resolver: zodResolver(invoiceEditSchema),
    defaultValues: {
      customerId: "",
      issueDate: new Date(),
      lineItems: [],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "lineItems",
  });

  useEffect(() => {
    if (!open) return;

    form.reset({
      customerId: invoice.customerId,
      issueDate: new Date(invoice.issueDate),
      lineItems: invoice.lineItems.map((lineItem) => ({
        itemId: lineItem.itemId ?? "",
        group_name: lineItem.group_name ?? "",
        description: lineItem.description,
        quantity: lineItem.quantity,
        unitPrice: lineItem.unitPrice,
      })),
    });
  }, [open, invoice, form]);

  const watchedLineItems = form.watch("lineItems");
  const total = watchedLineItems.reduce(
    (sum, lineItem) => sum + (lineItem.quantity || 0) * (lineItem.unitPrice || 0),
    0
  );

  const itemGroups = useMemo(() => {
    const groups = new Set(items.map((item) => item.group_name || "Uncategorized"));
    return Array.from(groups);
  }, [items]);

  const itemsByGroup = (groupName?: string) => {
    if (!groupName) return [];
    return items.filter((item) => (item.group_name || "Uncategorized") === groupName);
  };

  const onSubmit = async (data: InvoiceEditValues) => {
    try {
      const updatedInvoice = await updateInvoice(invoice.id, {
        customerId: data.customerId,
        issueDate: data.issueDate.toUTCString(),
        lineItems: data.lineItems,
      });
      onInvoiceUpdated(updatedInvoice);
      router.refresh();
      onOpenChange(false);
      toast({
        title: "Invoice updated",
        description: "Invoice changes were saved successfully.",
      });
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to update invoice.",
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Edit Invoice {invoice.invoiceNumber}</DialogTitle>
          <DialogDescription>
            Update line items, quantity, prices, customer, or issue date.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <div className="grid md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="customerId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Customer</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select a customer" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {customers.map((customer) => (
                          <SelectItem key={customer.id} value={customer.id}>
                            {customer.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="issueDate"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>Issue Date</FormLabel>
                    <Popover>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button
                            variant="outline"
                            className={cn("pl-3 text-left font-normal", !field.value && "text-muted-foreground")}
                          >
                            {field.value ? format(field.value, "PPP") : <span>Pick a date</span>}
                            <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar mode="single" selected={field.value} onSelect={field.onChange} initialFocus />
                      </PopoverContent>
                    </Popover>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="space-y-4">
              <h3 className="text-lg font-medium">Items</h3>
              {fields.map((field, index) => (
                <div key={field.id} className="grid grid-cols-12 gap-2 items-start p-3 border rounded-lg">
                  <Controller
                    control={form.control}
                    name={`lineItems.${index}.group_name`}
                    render={({ field: controllerField }) => (
                      <FormItem className="col-span-3">
                        <Select onValueChange={controllerField.onChange} value={controllerField.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select group" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {itemGroups.map((group) => (
                              <SelectItem key={group} value={group}>
                                {group}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </FormItem>
                    )}
                  />
                  <Controller
                    control={form.control}
                    name={`lineItems.${index}.itemId`}
                    render={({ field: controllerField }) => (
                      <FormItem className="col-span-4">
                        <Select
                          onValueChange={(value) => {
                            controllerField.onChange(value);
                            const selectedItem = items.find((item) => item.id === value);
                            if (selectedItem) {
                              form.setValue(`lineItems.${index}.description`, selectedItem.name);
                              form.setValue(`lineItems.${index}.unitPrice`, selectedItem.price);
                              form.setValue(`lineItems.${index}.group_name`, selectedItem.group_name ?? "Uncategorized");
                            }
                          }}
                          value={controllerField.value}
                          disabled={!watchedLineItems[index]?.group_name}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select item" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {itemsByGroup(watchedLineItems[index]?.group_name).map((item) => (
                              <SelectItem key={item.id} value={item.id}>
                                {item.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name={`lineItems.${index}.quantity`}
                    render={({ field }) => (
                      <FormItem className="col-span-1">
                        <FormControl>
                          <Input type="number" min={1} {...field} />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name={`lineItems.${index}.unitPrice`}
                    render={({ field }) => (
                      <FormItem className="col-span-2">
                        <FormControl>
                          <Input type="number" min={0} step="0.01" {...field} />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  <div className="col-span-2 flex items-center justify-end pt-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => remove(index)}
                      className="text-destructive hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}

              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() =>
                  append({ itemId: "", description: "", quantity: 1, unitPrice: 0, group_name: "" })
                }
              >
                <PlusCircle className="mr-2 h-4 w-4" />
                Add Item
              </Button>
            </div>

            <div className="flex justify-end">
              <div className="w-full max-w-sm">
                <div className="flex justify-between font-bold text-lg">
                  <span>Total</span>
                  <span>{formatCurrency(total)}</span>
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button type="submit" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting ? "Saving..." : "Save Changes"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
