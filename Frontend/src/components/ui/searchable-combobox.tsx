"use client";

import * as React from "react";
import { useState, useEffect, useCallback, useRef } from "react";
import { Check, ChevronsUpDown, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { useDebounce } from "@/hooks/use-debounce";

export type ComboboxOption = {
  value: string;
  label: string;
  extra?: any;
};

type SearchableComboboxProps = {
  /** HTML id for the trigger element */
  id?: string;
  /** Currently selected value (ID) */
  value: string;
  /** Display label for the current selection */
  displayValue?: string;
  /** Called when a selection is made */
  onSelect: (value: string, label: string, extra?: any) => void;
  /** Async search function — receives the query string, returns matching options */
  searchFn: (query: string) => Promise<ComboboxOption[]>;
  /** Trigger button placeholder when nothing is selected */
  placeholder?: string;
  /** Search input placeholder */
  searchPlaceholder?: string;
  /** Message when search returns no results */
  emptyMessage?: string;
  /** Disable the combobox */
  disabled?: boolean;
  /** Additional class names for the trigger button */
  className?: string;
  /** Called when the trigger receives focus */
  onTriggerFocus?: () => void;
};

export function SearchableCombobox({
  id,
  value,
  displayValue,
  onSelect,
  searchFn,
  placeholder = "Select...",
  searchPlaceholder = "Search...",
  emptyMessage = "No results found.",
  disabled = false,
  className,
  onTriggerFocus,
}: SearchableComboboxProps) {
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [options, setOptions] = useState<ComboboxOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);

  const debouncedQuery = useDebounce(searchQuery, 250);

  // Fetch results when the popover opens or the debounced query changes
  const fetchResults = useCallback(
    async (query: string) => {
      setLoading(true);
      try {
        const results = await searchFn(query);
        setOptions(results);
        setSelectedIndex(-1);
      } catch (err) {
        console.error(`[SearchableCombobox] Error fetching options for query "${query}":`, err);
        setOptions([]);
      } finally {
        setLoading(false);
      }
    },
    [searchFn]
  );

  // Load initial results when popover opens or debounced query changes
  useEffect(() => {
    if (open) {
      fetchResults(debouncedQuery);
    }
  }, [open, debouncedQuery, fetchResults]);

  // Focus input when popover opens, reset search when it closes
  useEffect(() => {
    if (open) {
      setTimeout(() => {
        inputRef.current?.focus();
      }, 50);
    } else {
      setSearchQuery("");
      setSelectedIndex(-1);
    }
  }, [open]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (options.length === 0) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev < options.length - 1 ? prev + 1 : 0));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev > 0 ? prev - 1 : options.length - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      e.stopPropagation();
      const idx = selectedIndex >= 0 ? selectedIndex : 0;
      if (idx >= 0 && idx < options.length) {
        const selected = options[idx];
        onSelect(selected.value, selected.label, selected.extra);
        setOpen(false);
      }
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn(
            "w-full justify-between font-normal text-left",
            !value && "text-muted-foreground",
            className
          )}
          onFocus={onTriggerFocus}
        >
          <span className="truncate">
            {value && displayValue ? displayValue : placeholder}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-[--radix-popover-trigger-width] min-w-[240px] p-0"
        align="start"
        onKeyDown={handleKeyDown}
      >
        <Command shouldFilter={false}>
          <CommandInput
            ref={inputRef}
            placeholder={searchPlaceholder}
            value={searchQuery}
            onValueChange={setSearchQuery}
          />
          <CommandList>
            {loading ? (
              <div className="flex items-center justify-center py-6">
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              </div>
            ) : options.length === 0 ? (
              <CommandEmpty>{emptyMessage}</CommandEmpty>
            ) : (
              <CommandGroup>
                {options.map((option, idx) => (
                  <CommandItem
                    key={option.value}
                    value={option.value}
                    className={cn(
                      idx === selectedIndex && "bg-accent text-accent-foreground"
                    )}
                    onMouseEnter={() => setSelectedIndex(idx)}
                    onSelect={() => {
                      onSelect(option.value, option.label, option.extra);
                      setOpen(false);
                    }}
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4",
                        value === option.value ? "opacity-100" : "opacity-0"
                      )}
                    />
                    <span className="truncate">{option.label}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
