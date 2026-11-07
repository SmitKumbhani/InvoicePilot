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
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Check, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { useApi } from "@/lib/api";
import { getItemGroups } from "@/lib/actions";
import type { Item } from "@/lib/types";
import { useEffect, useState, useMemo, useRef } from "react";

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

function GroupAutocomplete({
  value,
  onChange,
  existingGroups = [],
}: {
  value: string;
  onChange: (val: string) => void;
  existingGroups?: string[];
}) {
  const [open, setOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const [internalGroups, setInternalGroups] = useState<string[]>(existingGroups);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (existingGroups && existingGroups.length > 0) {
      setInternalGroups(existingGroups);
    }
  }, [existingGroups]);

  const onInputFocus = async () => {
    setOpen(true);
    if (!internalGroups || internalGroups.length === 0) {
      try {
        console.log("[ItemDialog:GroupAutocomplete] Fetching groups on input focus...");
        const groups = await getItemGroups();
        const filtered = groups.filter((g) => g && g !== "Uncategorized");
        console.log(`[ItemDialog:GroupAutocomplete] Loaded ${filtered.length} groups on focus:`, filtered);
        setInternalGroups(filtered);
      } catch (err) {
        console.error("[ItemDialog:GroupAutocomplete] Error fetching groups on focus:", err);
      }
    }
  };

  const query = value || "";
  const trimmed = query.trim();

  const filteredGroups = useMemo(() => {
    if (!trimmed) return internalGroups;
    return internalGroups.filter((g) =>
      g.toLowerCase().includes(trimmed.toLowerCase())
    );
  }, [internalGroups, trimmed]);

  const hasExactMatch = useMemo(() => {
    return internalGroups.some(
      (g) => g.toLowerCase() === trimmed.toLowerCase()
    );
  }, [internalGroups, trimmed]);

  const canCreateNew = trimmed.length > 0 && !hasExactMatch;

  // Options list for arrow navigation: existing matching groups + create option (if applicable)
  const optionsList = useMemo(() => {
    const list = [...filteredGroups];
    if (canCreateNew) {
      list.push(`__CREATE__:${trimmed}`);
    }
    return list;
  }, [filteredGroups, canCreateNew, trimmed]);

  useEffect(() => {
    setHighlightedIndex(-1);
  }, [value]);

  const selectGroup = (groupName: string) => {
    onChange(groupName);
    setOpen(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!open && (e.key === "ArrowDown" || e.key === "ArrowUp")) {
      setOpen(true);
      return;
    }

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlightedIndex((prev) =>
        prev < optionsList.length - 1 ? prev + 1 : 0
      );
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightedIndex((prev) =>
        prev > 0 ? prev - 1 : optionsList.length - 1
      );
    } else if (e.key === "Enter") {
      if (open && highlightedIndex >= 0 && highlightedIndex < optionsList.length) {
        e.preventDefault();
        const selected = optionsList[highlightedIndex];
        if (selected.startsWith("__CREATE__:")) {
          selectGroup(selected.replace("__CREATE__:", ""));
        } else {
          selectGroup(selected);
        }
      } else if (open) {
        setOpen(false);
      }
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <div ref={containerRef} className="w-full">
          <Input
            value={value}
            onChange={(e) => {
              onChange(e.target.value);
              setOpen(true);
            }}
            onFocus={onInputFocus}
            onKeyDown={handleKeyDown}
            placeholder="e.g., Services, Hardware, or type new group..."
            autoComplete="off"
          />
        </div>
      </PopoverTrigger>
      <PopoverContent
        className="w-[--radix-popover-trigger-width] min-w-[280px] p-1 max-h-60 overflow-y-auto"
        align="start"
        sideOffset={4}
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        {optionsList.length === 0 ? (
          <div className="py-3 px-3 text-sm text-muted-foreground text-center">
            Type a group name to create one.
          </div>
        ) : (
          <div className="space-y-0.5">
            {filteredGroups.map((group, idx) => (
              <div
                key={group}
                className={cn(
                  "flex items-center justify-between px-3 py-1.5 text-sm rounded cursor-pointer transition-colors",
                  idx === highlightedIndex
                    ? "bg-accent text-accent-foreground"
                    : "hover:bg-accent/50 text-foreground"
                )}
                onMouseEnter={() => setHighlightedIndex(idx)}
                onMouseDown={(e) => {
                  e.preventDefault();
                  selectGroup(group);
                }}
              >
                <span>{group}</span>
                {value === group && <Check className="h-4 w-4 text-primary" />}
              </div>
            ))}

            {canCreateNew && (
              <div
                className={cn(
                  "flex items-center gap-2 px-3 py-2 text-sm rounded cursor-pointer text-primary transition-colors border-t mt-1 font-medium",
                  optionsList.indexOf(`__CREATE__:${trimmed}`) === highlightedIndex
                    ? "bg-accent text-accent-foreground"
                    : "hover:bg-accent/50"
                )}
                onMouseEnter={() =>
                  setHighlightedIndex(optionsList.indexOf(`__CREATE__:${trimmed}`))
                }
                onMouseDown={(e) => {
                  e.preventDefault();
                  selectGroup(trimmed);
                }}
              >
                <Plus className="h-4 w-4 shrink-0" />
                <span className="truncate">
                  Create new group &ldquo;{trimmed}&rdquo;
                </span>
              </div>
            )}
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}

export function ItemDialog({ open, onOpenChange, item }: ItemDialogProps) {
  const { toast } = useToast();
  const { createItem, updateItem } = useApi();
  const isEditMode = !!item;
  const [existingGroups, setExistingGroups] = useState<string[]>([]);

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
    if (open) {
      getItemGroups()
        .then((groups) => {
          const filtered = groups.filter((g) => g && g !== "Uncategorized");
          console.log(`[ItemDialog] Loaded ${filtered.length} existing groups:`, filtered);
          setExistingGroups(filtered);
        })
        .catch((err) => {
          console.error("[ItemDialog] Error fetching existing groups:", err);
        });

      if (isEditMode && item) {
        form.reset({
          name: item.name,
          price: item.price,
          purchasePrice: item.price,
          group_name: item.group_name || "",
        });
      } else {
        form.reset({
          name: "",
          price: 0,
          purchasePrice: 0,
          group_name: "",
        });
      }
    }
  }, [item, isEditMode, open, form]);

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
      onOpenChange(false);
    } catch (error) {
      const message = error instanceof Error ? error.message : "An unknown error occurred.";
      toast({
        variant: "destructive",
        title: "Error",
        description: `Failed to ${isEditMode ? 'update' : 'create'} item: ${message}`,
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
                    <GroupAutocomplete
                      value={field.value || ""}
                      onChange={field.onChange}
                      existingGroups={existingGroups}
                    />
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
