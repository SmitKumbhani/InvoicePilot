"use client";

import { useForm, useFieldArray, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useState, useMemo } from "react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { CalendarIcon, PlusCircle, Trash2 } from "lucide-react";
import { cn, formatCurrency } from "@/lib/utils";
import { format } from "date-fns";
import type { Customer, Item } from "@/lib/types";
import { useApi } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { useRouter } from "next/navigation";
import { useLoader } from "@/hooks/use-loader";

const lineItemSchema = z.object({
  itemId: z.string().min(1, "Item is required."),
  group_name: z.string().optional(),
  description: z.string(),
  quantity: z.coerce.number().min(1, "Quantity must be at least 1."),
  unitPrice: z.coerce.number().min(0.01, "Price must be positive."),
});

const invoiceSchema = z.object({
  customerId: z.string().min(1, "Customer is required."),
  issueDate: z.date({ required_error: "Issue date is required." }),
  lineItems: z.array(lineItemSchema).min(1, "At least one item is required."),
});

type InvoiceFormValues = z.infer<typeof invoiceSchema>;

type InvoiceFormProps = {
  customers: Customer[];
  items: Item[];
  onItemFocus: (itemId: string | null) => void;
  onCustomerChange: (customerId: string | null) => void;
};

export function InvoiceForm({ customers, items, onItemFocus, onCustomerChange }: InvoiceFormProps) {
  const { toast } = useToast();
  const router = useRouter();
  const { createInvoice } = useApi();
  const { showLoader, hideLoader } = useLoader();

  const form = useForm<InvoiceFormValues>({
    resolver: zodResolver(invoiceSchema),
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

  const watchedLineItems = form.watch("lineItems");
  const total = watchedLineItems.reduce(
    (acc, item) => acc + (item.quantity || 0) * (item.unitPrice || 0),
    0
  );

  const itemGroups = useMemo(() => {
    const groups = new Set(items.map(item => item.group_name || "Uncategorized"));
    return Array.from(groups);
  }, [items]);

  const itemsByGroup = (group_name?: string) => {
    if (!group_name) return [];
    return items.filter(item => (item.group_name || "Uncategorized") === group_name);
  };

  const onSubmit = async (data: InvoiceFormValues) => {
    showLoader();
    try {
      const newInvoiceData = {
        ...data,
        issueDate: data.issueDate.toUTCString(),
        status: "pending" as const,
        total,
      };
      await createInvoice(newInvoiceData);
      toast({
        title: "Success",
        description: "Invoice created successfully.",
      });
      router.push("/");
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to create invoice.",
      });
    } finally {
      hideLoader();
    }
  };
  
  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
        <div className="grid md:grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="customerId"
            render={({ field }) => (
              <FormItem className="md:col-span-1">
                <FormLabel>Customer</FormLabel>
                <Select
                  onValueChange={(value) => {
                    field.onChange(value);
                    onCustomerChange(value);
                  }}
                  defaultValue={field.value}
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a customer" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {customers.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
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
                        variant={"outline"}
                        className={cn(
                          "pl-3 text-left font-normal",
                          !field.value && "text-muted-foreground"
                        )}
                      >
                        {field.value ? (
                          format(field.value, "PPP")
                        ) : (
                          <span>Pick a date</span>
                        )}
                        <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                      </Button>
                    </FormControl>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={field.value}
                      onSelect={field.onChange}
                      initialFocus
                    />
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
            <div
              key={field.id}
              className="grid grid-cols-12 gap-2 items-start p-3 border rounded-lg"
            >
              <Controller
                control={form.control}
                name={`lineItems.${index}.group_name`}
                render={({ field: controllerField }) => (
                  <FormItem className="col-span-3">
                    <Select onValueChange={controllerField.onChange} defaultValue={controllerField.value}>
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
                        const selectedItem = items.find((i) => i.id === value);
                        form.setValue(
                          `lineItems.${index}.description`,
                          selectedItem?.name || ""
                        );
                        form.setValue(
                          `lineItems.${index}.unitPrice`,
                          selectedItem?.price || 0
                        );
                        onItemFocus(value);
                      }}
                      defaultValue={controllerField.value}
                      disabled={!watchedLineItems[index]?.group_name}
                    >
                      <FormControl>
                        <SelectTrigger onFocus={() => onItemFocus(controllerField.value)}>
                          <SelectValue placeholder="Select item" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {itemsByGroup(watchedLineItems[index]?.group_name).map((i) => (
                          <SelectItem key={i.id} value={i.id}>
                            {i.name}
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
                      <Input type="number" placeholder="Qty" {...field} />
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
                      <Input type="number" placeholder="Price" {...field} />
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
            <PlusCircle className="mr-2 h-4 w-4" /> Add Item
          </Button>
           {form.formState.errors.lineItems && !form.formState.errors.lineItems.root && (
            <p className="text-sm font-medium text-destructive">{form.formState.errors.lineItems.message}</p>
          )}
        </div>

        <div className="flex justify-end">
            <div className="w-full max-w-sm space-y-2">
                <div className="flex justify-between font-bold text-lg">
                    <span>Total</span>
                    <span>{formatCurrency(total)}</span>
                </div>
            </div>
        </div>

        <Button type="submit" disabled={form.formState.isSubmitting}>
            {form.formState.isSubmitting ? "Saving..." : "Save Invoice"}
        </Button>
      </form>
    </Form>
  );
}
