
"use server";

import { revalidatePath } from "next/cache";
import type {
  Invoice,
  Customer,
  Item,
  PriceHistoryEntry,
  InvoiceUpsertInput,
  LineItem,
} from "./types";

const API_BASE_URL = "http://backend:5001/api";

const toNumber = (value: unknown): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const normalizeLineItem = (lineItem: any): LineItem => ({
  id: lineItem.id ? String(lineItem.id) : undefined,
  itemId: lineItem.itemId ?? lineItem.item_id ?? null,
  group_name: lineItem.group_name ?? undefined,
  description: lineItem.description ?? lineItem.item_name ?? "",
  quantity: toNumber(lineItem.quantity),
  unitPrice: toNumber(lineItem.unitPrice ?? lineItem.unit_price),
  itemName: lineItem.itemName ?? lineItem.item_name ?? undefined,
});

const normalizeInvoice = (invoice: any): Invoice => {
  const customer = invoice.customer ?? {};
  const customerId = String(invoice.customerId ?? customer.id ?? "");

  return {
    id: String(invoice.id),
    invoiceNumber: String(invoice.invoiceNumber ?? invoice.invoice_number ?? ""),
    customer: {
      id: String(customer.id ?? customerId),
      name: String(customer.name ?? ""),
      phone: String(customer.phone ?? ""),
    },
    customerId,
    issueDate: invoice.issueDate ?? invoice.issue_date ?? "",
    status: (invoice.status ?? "pending") as Invoice["status"],
    lineItems: Array.isArray(invoice.lineItems)
      ? invoice.lineItems.map(normalizeLineItem)
      : [],
    total: toNumber(invoice.total),
    amountPaid: toNumber(invoice.amountPaid ?? invoice.amount_paid),
    createdAt: invoice.createdAt ?? invoice.created_at,
    updatedAt: invoice.updatedAt ?? invoice.updated_at,
  };
};

const normalizePriceHistory = (entry: any): PriceHistoryEntry => ({
  unitPrice: toNumber(entry.unitPrice ?? entry.unit_price),
  issueDate: entry.issueDate ?? entry.issue_date ?? "",
  itemName: entry.itemName ?? entry.item_name ?? undefined,
});

export async function getInvoices(
  status?: "all" | Invoice["status"]
): Promise<Invoice[]> {
  const res = await fetch(`${API_BASE_URL}/invoices`);
  if (!res.ok) {
    throw new Error("Failed to fetch invoices");
  }
  const payload = await res.json();
  const invoices = Array.isArray(payload) ? payload.map(normalizeInvoice) : [];

  if (status && status !== "all") {
    return invoices.filter((inv) => inv.status === status);
  }
  return invoices;
}

export async function getInvoiceById(invoiceId: string): Promise<Invoice | undefined> {
  const res = await fetch(`${API_BASE_URL}/invoices/${invoiceId}`);
  if (!res.ok) {
    return undefined;
  }

  const payload = await res.json();
  return normalizeInvoice(payload);
}

export async function getCustomers(): Promise<Customer[]> {
  const res = await fetch(`${API_BASE_URL}/customers`);
  if (!res.ok) {
    throw new Error("Failed to fetch customers");
  }
  return res.json();
}

export async function getItems(): Promise<Item[]> {
  const res = await fetch(`${API_BASE_URL}/items`);
  if (!res.ok) {
    throw new Error("Failed to fetch items");
  }
  return res.json();
}

export async function getItemPriceHistory(
  itemId: string,
  customerId: string
): Promise<PriceHistoryEntry[]> {
  const res = await fetch(`${API_BASE_URL}/items/${itemId}/history?customerId=${customerId}`);
  if (!res.ok) {
    return [];
  }

  const payload = await res.json();
  return Array.isArray(payload) ? payload.map(normalizePriceHistory) : [];
}

export async function createInvoice(
  invoiceData: InvoiceUpsertInput
) {
  const res = await fetch(`${API_BASE_URL}/invoices`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(invoiceData),
  });

  if (!res.ok) {
    throw new Error("Failed to create invoice");
  }

  revalidatePath("/");
  revalidatePath("/customers");
  return res.json();
}

export async function updateInvoice(
  invoiceId: string,
  invoiceData: InvoiceUpsertInput
): Promise<Invoice> {
  const res = await fetch(`${API_BASE_URL}/invoices/${invoiceId}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(invoiceData),
  });

  if (!res.ok) {
    throw new Error("Failed to update invoice");
  }

  revalidatePath("/");
  revalidatePath("/customers");
  revalidatePath(`/invoices/${invoiceId}`);

  const payload = await res.json();
  return normalizeInvoice(payload.invoice ?? payload);
}

export async function updateInvoicePayment(
  invoiceId: string,
  paymentAmount: number
): Promise<Invoice> {
  const res = await fetch(`${API_BASE_URL}/invoices/${invoiceId}/payment`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ paymentAmount }),
  });

  if (!res.ok) {
    const errorBody = await res.json().catch(() => null);
    throw new Error(errorBody?.error || "Failed to update invoice payment");
  }

  revalidatePath("/");
  revalidatePath("/customers");
  revalidatePath(`/invoices/${invoiceId}`);

  const payload = await res.json();
  return normalizeInvoice(payload.invoice ?? payload);
}

export async function setInvoicePaidAmount(
  invoiceId: string,
  amountPaid: number
): Promise<Invoice> {
  const res = await fetch(`${API_BASE_URL}/invoices/${invoiceId}/payment`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ amountPaid }),
  });

  if (!res.ok) {
    const errorBody = await res.json().catch(() => null);
    throw new Error(errorBody?.error || "Failed to update paid amount");
  }

  revalidatePath("/");
  revalidatePath("/customers");
  revalidatePath(`/invoices/${invoiceId}`);

  const payload = await res.json();
  return normalizeInvoice(payload.invoice ?? payload);
}

export async function createItem(itemData: {
  name: string;
  price: number;
  purchasePrice?: number;
  group_name?: string;
}) {
  const res = await fetch(`${API_BASE_URL}/items`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(itemData),
  });

  if (!res.ok) {
    throw new Error("Failed to create item");
  }

  revalidatePath("/items");
  revalidatePath("/invoices/new");

  return res.json();
}

export async function updateItem(itemId: string, itemData: {
    name: string;
    price: number;
    purchasePrice?: number;
    group_name?: string;
}) {
    const res = await fetch(`${API_BASE_URL}/items/${itemId}`, {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(itemData),
    });

    if (!res.ok) {
        throw new Error("Failed to update item");
    }

    revalidatePath("/items");
    revalidatePath("/invoices/new");
    revalidatePath("/"); 

    return res.json();
}

export async function createCustomer(customerData: {
  name: string;
  phone: string;
}) {
  const res = await fetch(`${API_BASE_URL}/customers`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(customerData),
  });

  if (!res.ok) {
    throw new Error("Failed to create customer");
  }
  
  revalidatePath("/customers");
  revalidatePath("/invoices/new");
  
  return res.json();
}

export async function updateCustomer(customerId: string, customerData: {
  name: string;
  phone: string;
}) {
  const res = await fetch(`${API_BASE_URL}/customers/${customerId}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(customerData),
  });

  if (!res.ok) {
    throw new Error("Failed to update customer");
  }
  
  revalidatePath("/customers");
  revalidatePath("/");
  revalidatePath("/invoices/new");
  
  return res.json();
}

export async function deleteCustomer(customerId: string) {
  const res = await fetch(`${API_BASE_URL}/customers/${customerId}`, {
    method: 'DELETE',
  });

  if (!res.ok) {
    throw new Error("Failed to delete customer");
  }
  
  revalidatePath("/customers");
  revalidatePath("/");
  
  return { success: true };
}

export async function deleteInvoice(invoiceId: string) {
  const res = await fetch(`${API_BASE_URL}/invoices/${invoiceId}`, {
    method: 'DELETE',
  });

  if (!res.ok) {
    throw new Error("Failed to delete invoice");
  }
  
  revalidatePath("/");
  revalidatePath("/customers");
  
  return { success: true };
}
