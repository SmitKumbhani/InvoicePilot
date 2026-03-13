
"use server";

import { revalidatePath } from "next/cache";
import type { Invoice, Customer, Item, PriceHistoryEntry } from "./types";

const API_BASE_URL = "http://backend:5001/api";

export async function getInvoices(
  status?: "all" | "paid" | "pending" | "partially-paid"
): Promise<Invoice[]> {
  const res = await fetch(`${API_BASE_URL}/invoices`);
  if (!res.ok) {
    throw new Error("Failed to fetch invoices");
  }
  const invoices = await res.json();
  if (status && status !== "all") {
    return invoices.filter((inv: Invoice) => inv.status === status);
  }
  return invoices;
}

export async function getInvoiceById(invoiceId: string): Promise<Invoice | undefined> {
    const res = await fetch(`${API_BASE_URL}/invoices/${invoiceId}`);
    if (!res.ok) {
        return undefined;
    }
    return res.json();
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
  return res.json();
}

export async function createInvoice(
  invoiceData: Omit<Invoice, "id" | "invoiceNumber" | "customer" | "amountPaid">
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

export async function updateInvoicePayment(
  invoiceId: string,
  paymentAmount: number
) {
  const res = await fetch(`${API_BASE_URL}/invoices/${invoiceId}/payment`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ paymentAmount }),
  });

  if (!res.ok) {
    throw new Error("Failed to update invoice payment");
  }

  revalidatePath("/");
  revalidatePath("/customers");
  revalidatePath(`/invoices/${invoiceId}`);
  
  return res.json();
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
