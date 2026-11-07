"use client";

import { useForm, useFieldArray, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useState, useEffect, useCallback, useRef } from "react";
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
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { CalendarIcon, PlusCircle, Trash2 } from "lucide-react";
import { cn, formatCurrency } from "@/lib/utils";
import { format } from "date-fns";
import type { Invoice } from "@/lib/types";
import { useApi } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { useRouter } from "next/navigation";
import { useLoader } from "@/hooks/use-loader";
import { SearchableCombobox, type ComboboxOption } from "@/components/ui/searchable-combobox";
import { searchCustomers, searchItems, getItemGroups } from "@/lib/actions";

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
  invoice?: Invoice;
  onItemFocus: (itemId: string | null) => void;
  onCustomerChange: (customerId: string | null) => void;
};

export function InvoiceForm({ invoice, onItemFocus, onCustomerChange }: InvoiceFormProps) {
  const { toast } = useToast();
  const router = useRouter();
  const { createInvoice, updateInvoice } = useApi();
  const { showLoader, hideLoader } = useLoader();
  const [lastSelectedGroupName, setLastSelectedGroupName] = useState("");
  const [isMac, setIsMac] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined") {
      setIsMac(navigator.platform.toUpperCase().indexOf("MAC") >= 0);
    }
  }, []);

  // Display values for combobox selections (not stored in form, only for UI display)
  const [customerDisplayName, setCustomerDisplayName] = useState(
    invoice?.customer.name || ""
  );
  // Track display values per line item field index
  const [lineItemDisplays, setLineItemDisplays] = useState<
    Record<number, { groupName: string; itemName: string }>
  >(() => {
    if (!invoice?.lineItems) return {};
    const initial: Record<number, { groupName: string; itemName: string }> = {};
    invoice.lineItems.forEach((item, idx) => {
      initial[idx] = {
        groupName: item.group_name || "",
        itemName: item.description || item.itemName || "",
      };
    });
    return initial;
  });

  // Cache item groups (small dataset, loaded once)
  const [allGroups, setAllGroups] = useState<string[]>([]);
  useEffect(() => {
    getItemGroups().then(setAllGroups);
  }, []);

  const form = useForm<InvoiceFormValues>({
    resolver: zodResolver(invoiceSchema),
    defaultValues: {
      customerId: invoice?.customerId || "",
      issueDate: invoice ? new Date(invoice.issueDate) : new Date(),
      lineItems: invoice?.lineItems.map(item => ({
        itemId: item.itemId ?? "",
        group_name: item.group_name ?? "",
        description: item.description,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
      })) || [],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "lineItems",
  });

  const watchedLineItems = form.watch("lineItems");
  const rawTotal = watchedLineItems.reduce(
    (acc, item) => acc + (item.quantity || 0) * (item.unitPrice || 0),
    0
  );
  const total = Math.round(rawTotal);

  // --- Display value helpers ---

  const updateLineItemDisplay = (
    index: number,
    field: "groupName" | "itemName",
    value: string
  ) => {
    setLineItemDisplays((prev) => ({
      ...prev,
      [index]: {
        ...prev[index],
        [field]: value,
      },
    }));
  };

  const handleAddNewItem = useCallback(() => {
    const newIndex = fields.length;
    append({
      itemId: "",
      description: "",
      quantity: 1,
      unitPrice: 0,
      group_name: lastSelectedGroupName,
    });
    if (lastSelectedGroupName) {
      updateLineItemDisplay(newIndex, "groupName", lastSelectedGroupName);
    }

    setTimeout(() => {
      const targetId = lastSelectedGroupName
        ? `line-item-${newIndex}-item-trigger`
        : `line-item-${newIndex}-group-trigger`;
      const el = document.getElementById(targetId);
      if (el) {
        el.focus();
      }
    }, 60);
  }, [fields.length, append, lastSelectedGroupName]);

  // --- Search functions for comboboxes ---

  const searchCustomersFn = useCallback(
    async (query: string): Promise<ComboboxOption[]> => {
      const results = await searchCustomers(query);
      return results.map((c) => ({
        value: c.id,
        label: c.name,
      }));
    },
    []
  );

  const searchGroupsFn = useCallback(
    async (query: string): Promise<ComboboxOption[]> => {
      const q = query.toLowerCase();
      const filtered = q
        ? allGroups.filter((g) => g.toLowerCase().includes(q))
        : allGroups;
      return filtered.map((g) => ({ value: g, label: g }));
    },
    [allGroups]
  );

  const createItemSearchFn = useCallback(
    (groupName: string) => {
      return async (query: string): Promise<ComboboxOption[]> => {
        const results = await searchItems(query, groupName || undefined);
        return results.map((i) => ({
          value: i.id,
          label: i.name,
          extra: { price: i.price },
        }));
      };
    },
    []
  );

  const handleGroupSelect = (
    index: number,
    value: string,
    label: string,
    onChange: (value: string) => void
  ) => {
    onChange(value);
    setLastSelectedGroupName(value);
    updateLineItemDisplay(index, "groupName", label);

    // Clear item if group changed and current item doesn't match
    const selectedItemId = form.getValues(`lineItems.${index}.itemId`);
    if (selectedItemId) {
      form.setValue(`lineItems.${index}.itemId`, "");
      form.setValue(`lineItems.${index}.description`, "");
      form.setValue(`lineItems.${index}.unitPrice`, 0);
      updateLineItemDisplay(index, "itemName", "");
      onItemFocus(null);
    }

    // Auto-focus the item combobox trigger in this row
    setTimeout(() => {
      const itemTrigger = document.getElementById(`line-item-${index}-item-trigger`);
      if (itemTrigger) {
        itemTrigger.focus();
      }
    }, 50);
  };

  const handleRemoveItem = (index: number) => {
    remove(index);
    setLineItemDisplays((prev) => {
      const updated: Record<number, { groupName: string; itemName: string }> = {};
      Object.entries(prev).forEach(([key, val]) => {
        const k = Number(key);
        if (k < index) {
          updated[k] = val;
        } else if (k > index) {
          updated[k - 1] = val;
        }
      });
      return updated;
    });
  };

  const onSubmit = useCallback(
    async (data: InvoiceFormValues) => {
      showLoader();
      try {
        if (invoice) {
          await updateInvoice(invoice.id, {
            customerId: data.customerId,
            issueDate: data.issueDate.toUTCString(),
            lineItems: data.lineItems,
          });
          toast({
            title: "Success",
            description: "Invoice updated successfully.",
          });
          router.push(`/invoices/${invoice.id}`);
        } else {
          const newInvoiceData = {
            customerId: data.customerId,
            issueDate: data.issueDate.toUTCString(),
            lineItems: data.lineItems,
            status: "pending" as const,
          };
          await createInvoice(newInvoiceData);
          toast({
            title: "Success",
            description: "Invoice created successfully.",
          });
          router.push("/");
        }
      } catch (error) {
        toast({
          variant: "destructive",
          title: "Error",
          description: invoice ? "Failed to update invoice." : "Failed to create invoice.",
        });
      } finally {
        hideLoader();
      }
    },
    [invoice, updateInvoice, createInvoice, router, showLoader, hideLoader, toast]
  );

  const onSubmitRef = useRef(onSubmit);
  onSubmitRef.current = onSubmit;

  // Window-level shortcut: Ctrl+S (Windows) / Cmd+S (Mac) to save the invoice
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        e.stopPropagation();
        form.handleSubmit((values) => onSubmitRef.current(values))();
      }
    };

    window.addEventListener("keydown", handleGlobalKeyDown, true);
    return () => {
      window.removeEventListener("keydown", handleGlobalKeyDown, true);
    };
  }, [form]);

  // Form-level keydown handler:
  // - Enter key adds a new item and focuses it instead of submitting the form
  // - Ctrl+S / Cmd+S triggers submit
  const handleFormKeyDown = (e: React.KeyboardEvent<HTMLFormElement>) => {
    // Save on Ctrl+S / Cmd+S
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
      e.preventDefault();
      e.stopPropagation();
      form.handleSubmit((values) => onSubmitRef.current(values))();
      return;
    }

    if (e.key === "Enter") {
      const target = e.target as HTMLElement;

      // Allow textareas to have normal multi-line enter
      if (target.tagName === "TEXTAREA") {
        return;
      }

      // If user specifically pressed enter on the submit button, allow submission
      if (target.getAttribute("type") === "submit" || target.closest('button[type="submit"]')) {
        return;
      }

      // If target is inside a combobox search input or open dialog, let combobox handle selection
      if (
        target.closest("[cmdk-input-wrapper]") ||
        target.closest('[role="dialog"]') ||
        target.closest("[data-radix-popper-content-wrapper]")
      ) {
        return;
      }

      // If target is a standard button (like delete or open trigger), let the button handle it
      if (target.tagName === "BUTTON") {
        return;
      }

      // In all other cases (e.g. Quantity input, Price input, row fields):
      // Prevent premature invoice creation, add a new item, and focus it!
      e.preventDefault();
      e.stopPropagation();
      handleAddNewItem();
    }
  };

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        onKeyDown={handleFormKeyDown}
        className="space-y-8"
      >
        <div className="grid md:grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="customerId"
            render={({ field }) => (
              <FormItem className="md:col-span-1">
                <FormLabel>Customer</FormLabel>
                <FormControl>
                  <SearchableCombobox
                    id="customer-combobox-trigger"
                    value={field.value}
                    displayValue={customerDisplayName}
                    onSelect={(id, label) => {
                      field.onChange(id);
                      setCustomerDisplayName(label);
                      onCustomerChange(id);
                    }}
                    searchFn={searchCustomersFn}
                    placeholder="Select a customer"
                    searchPlaceholder="Search customers..."
                    emptyMessage="No customers found."
                  />
                </FormControl>
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
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-medium">Items</h3>
            <span className="text-xs text-muted-foreground hidden sm:inline">
              Press <kbd className="px-1.5 py-0.5 rounded bg-muted text-muted-foreground border font-mono">Enter</kbd> to add row • <kbd className="px-1.5 py-0.5 rounded bg-muted text-muted-foreground border font-mono">{isMac ? "⌘+S" : "Ctrl+S"}</kbd> to save
            </span>
          </div>

          {fields.map((field, index) => (
            <div
              key={field.id}
              className="grid grid-cols-12 gap-2 items-start p-3 border rounded-lg"
            >
              <Controller
                control={form.control}
                name={`lineItems.${index}.group_name`}
                render={({ field: controllerField }) => (
                  <div className="col-span-3 flex items-center gap-2 pt-1">
                    <span className="text-sm font-medium text-muted-foreground w-4 shrink-0 text-right">{index + 1}.</span>
                    <FormItem className="flex-1">
                      <SearchableCombobox
                        id={`line-item-${index}-group-trigger`}
                        value={controllerField.value || ""}
                        displayValue={lineItemDisplays[index]?.groupName || controllerField.value || ""}
                        onSelect={(value, label) =>
                          handleGroupSelect(index, value, label, controllerField.onChange)
                        }
                        searchFn={searchGroupsFn}
                        placeholder="Select group"
                        searchPlaceholder="Search groups..."
                        emptyMessage="No groups found."
                      />
                    </FormItem>
                  </div>
                )}
              />
              <Controller
                control={form.control}
                name={`lineItems.${index}.itemId`}
                render={({ field: controllerField }) => (
                  <FormItem className="col-span-3">
                    <SearchableCombobox
                      id={`line-item-${index}-item-trigger`}
                      value={controllerField.value}
                      displayValue={lineItemDisplays[index]?.itemName || ""}
                      onSelect={(itemId, itemLabel, extra) => {
                        controllerField.onChange(itemId);
                        form.setValue(
                          `lineItems.${index}.description`,
                          itemLabel
                        );
                        updateLineItemDisplay(index, "itemName", itemLabel);
                        if (extra?.price !== undefined) {
                          form.setValue(
                            `lineItems.${index}.unitPrice`,
                            Number(extra.price)
                          );
                        }
                        onItemFocus(itemId);

                        // Automatically focus the quantity input in this row
                        setTimeout(() => {
                          const qtyEl = document.getElementById(`line-item-${index}-quantity`) as HTMLInputElement;
                          if (qtyEl) {
                            qtyEl.focus();
                            qtyEl.select();
                          }
                        }, 50);
                      }}
                      searchFn={createItemSearchFn(watchedLineItems[index]?.group_name || "")}
                      placeholder="Select item"
                      searchPlaceholder="Search items..."
                      emptyMessage="No items found."
                      disabled={!watchedLineItems[index]?.group_name}
                      onTriggerFocus={() => onItemFocus(controllerField.value)}
                    />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name={`lineItems.${index}.quantity`}
                render={({ field }) => (
                  <FormItem className="col-span-1">
                    <FormControl>
                      <Input
                        id={`line-item-${index}-quantity`}
                        type="number"
                        placeholder="Qty"
                        {...field}
                      />
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
                      <Input
                        id={`line-item-${index}-price`}
                        type="number"
                        placeholder="Price"
                        {...field}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
              <div className="col-span-2 flex items-center pt-2 px-2 text-sm text-muted-foreground font-medium">
                {formatCurrency((watchedLineItems[index]?.quantity || 0) * (watchedLineItems[index]?.unitPrice || 0))}
              </div>
              <div className="col-span-1 flex items-center justify-end pt-1">
                 <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => handleRemoveItem(index)}
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
            onClick={handleAddNewItem}
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

        <div className="flex items-center justify-between">
          <Button type="submit" disabled={form.formState.isSubmitting}>
            {form.formState.isSubmitting ? "Saving..." : (invoice ? "Save Changes" : "Save Invoice")}
          </Button>
          <span className="text-xs text-muted-foreground">
            Shortcut: <kbd className="px-1.5 py-0.5 rounded bg-muted border font-mono">{isMac ? "⌘S" : "Ctrl+S"}</kbd>
          </span>
        </div>
      </form>
    </Form>
  );
}
