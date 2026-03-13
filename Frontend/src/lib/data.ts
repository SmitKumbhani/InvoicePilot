
import { customers, items, invoices } from "./db";
import type { Invoice, Customer, Item, PriceHistoryEntry } from "./types";

// This file is now deprecated for direct data mutation.
// It re-exports data from db.ts for any components that might still import from here.
// All data manipulation should happen in actions.ts which imports from db.ts.

export const priceHistory: PriceHistoryEntry[] = [];
export { customers, items, invoices };
