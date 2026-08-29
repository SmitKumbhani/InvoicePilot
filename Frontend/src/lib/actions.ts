
"use server";

import { revalidatePath } from "next/cache";
import type {
  Invoice,
  Customer,
  Item,
  PriceHistoryEntry,
  InvoiceUpsertInput,
  LineItem,
  CustomerPayment,
  CustomerPaymentAllocation,
  CustomerPaymentSummary,
  CustomerPaymentsResponse,
  CreateCustomerPaymentInput,
  UpdateCustomerPaymentInput,
} from "./types";

const API_BASE_URL = "http://backend:5001/api";

const toNumber = (value: unknown): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const toOptionalNumber = (value: unknown): number | undefined => {
  if (value === undefined || value === null) {
    return undefined;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
};

const toRecord = (value: unknown): Record<string, any> =>
  value && typeof value === "object" ? (value as Record<string, any>) : {};

const normalizeLineItem = (lineItem: any): LineItem => ({
  id: lineItem.id ? String(lineItem.id) : undefined,
  itemId: lineItem.itemId ?? lineItem.item_id ?? null,
  lineOrder: toOptionalNumber(lineItem.lineOrder ?? lineItem.line_order),
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

const normalizeCustomerPaymentAllocation = (allocation: any): CustomerPaymentAllocation => ({
  id: allocation.id ? String(allocation.id) : undefined,
  invoiceId: String(allocation.invoiceId ?? allocation.invoice_id ?? ""),
  invoiceNumber: allocation.invoiceNumber ?? allocation.invoice_number ?? undefined,
  allocatedAmount: toNumber(
    allocation.allocatedAmount ?? allocation.allocated_amount ?? allocation.amount
  ),
  invoiceTotal: toOptionalNumber(allocation.invoiceTotal ?? allocation.invoice_total),
  invoiceAmountPaidBefore: toOptionalNumber(
    allocation.invoiceAmountPaidBefore ?? allocation.invoice_amount_paid_before
  ),
  invoiceAmountPaidAfter: toOptionalNumber(
    allocation.invoiceAmountPaidAfter ?? allocation.invoice_amount_paid_after
  ),
  invoiceRemainingBefore: toOptionalNumber(
    allocation.invoiceRemainingBefore ?? allocation.invoice_remaining_before
  ),
  invoiceRemainingAfter: toOptionalNumber(
    allocation.invoiceRemainingAfter ?? allocation.invoice_remaining_after
  ),
});

const normalizeCustomerPayment = (payment: any): CustomerPayment => ({
  id: String(payment.id ?? payment.paymentId ?? payment.payment_id ?? ""),
  customerId: String(payment.customerId ?? payment.customer_id ?? ""),
  amount: toNumber(payment.amount),
  paymentDate: payment.paymentDate ?? payment.payment_date ?? "",
  note: payment.note ?? undefined,
  allocations: Array.isArray(payment.allocations)
    ? payment.allocations.map(normalizeCustomerPaymentAllocation)
    : Array.isArray(payment.paymentAllocations)
      ? payment.paymentAllocations.map(normalizeCustomerPaymentAllocation)
      : Array.isArray(payment.payment_allocations)
        ? payment.payment_allocations.map(normalizeCustomerPaymentAllocation)
        : [],
  createdAt: payment.createdAt ?? payment.created_at,
  updatedAt: payment.updatedAt ?? payment.updated_at,
});

const normalizeCustomerPaymentSummary = (summary: any): CustomerPaymentSummary | undefined => {
  if (!summary || typeof summary !== "object") {
    return undefined;
  }

  const nestedCredit = toRecord(summary.customerCredit ?? summary.customer_credit);
  const resolvedTotalUnallocated =
    summary.totalUnallocated ??
    summary.total_unallocated ??
    nestedCredit.totalUnallocated ??
    nestedCredit.total_unallocated;
  const resolvedCustomerCredit =
    summary.customerCreditValue ??
    summary.customer_credit_value ??
    summary.customerCredit ??
    summary.customer_credit ??
    nestedCredit.amount ??
    nestedCredit.value ??
    nestedCredit.totalUnallocated ??
    nestedCredit.total_unallocated;

  return {
    pendingAmount: toOptionalNumber(summary.pendingAmount ?? summary.pending_amount),
    outstandingAmount: toOptionalNumber(summary.outstandingAmount ?? summary.outstanding_amount),
    totalOutstanding: toOptionalNumber(summary.totalOutstanding ?? summary.total_outstanding),
    totalPaid: toOptionalNumber(summary.totalPaid ?? summary.total_paid),
    totalAllocated: toOptionalNumber(summary.totalAllocated ?? summary.total_allocated),
    totalUnallocated: toOptionalNumber(resolvedTotalUnallocated),
    availableCredit: toOptionalNumber(summary.availableCredit ?? summary.available_credit),
    creditBalance: toOptionalNumber(summary.creditBalance ?? summary.credit_balance),
    customerCredit: toOptionalNumber(resolvedCustomerCredit),
  };
};

const normalizeCustomerPaymentsResponse = (payload: any): CustomerPaymentsResponse => {
  const root = toRecord(payload);
  const dataRoot = toRecord(root.data);
  const rootSummaryFallbackRaw = {
    pendingAmount: root.pendingAmount ?? root.pending_amount,
    outstandingAmount: root.outstandingAmount ?? root.outstanding_amount,
    totalOutstanding: root.totalOutstanding ?? root.total_outstanding,
    totalPaid: root.totalPaid ?? root.total_paid,
    totalAllocated: root.totalAllocated ?? root.total_allocated,
    totalUnallocated: root.totalUnallocated ?? root.total_unallocated,
    availableCredit: root.availableCredit ?? root.available_credit,
    creditBalance: root.creditBalance ?? root.credit_balance,
    customerCredit: root.customerCredit ?? root.customer_credit,
  };
  const rootSummaryFallback = Object.values(rootSummaryFallbackRaw).some(
    (value) => value !== undefined && value !== null
  )
    ? rootSummaryFallbackRaw
    : undefined;

  const paymentsRaw = Array.isArray(payload)
    ? payload
    : Array.isArray(root.payments)
      ? root.payments
      : Array.isArray(dataRoot.payments)
        ? dataRoot.payments
        : Array.isArray(root.data)
        ? root.data
        : [];

  const summaryRaw =
    root.summary ??
    dataRoot.summary ??
    root.customerSummary ??
    dataRoot.customerSummary ??
    root.customer_summary ??
    dataRoot.customer_summary ??
    root.creditSummary ??
    dataRoot.creditSummary ??
    root.credit_summary ??
    dataRoot.credit_summary ??
    root.customerCreditSummary ??
    dataRoot.customerCreditSummary ??
    root.customer_credit_summary ??
    dataRoot.customer_credit_summary ??
    rootSummaryFallback ??
    undefined;

  return {
    payments: paymentsRaw.map(normalizeCustomerPayment),
    summary: normalizeCustomerPaymentSummary(summaryRaw),
  };
};

const normalizeSingleCustomerPayment = (
  payload: any,
  paymentIdHint?: string
): CustomerPayment => {
  const root = toRecord(payload);
  const directPayment = root.payment ?? root.data;
  if (directPayment) {
    return normalizeCustomerPayment(directPayment);
  }

  const listResponse = normalizeCustomerPaymentsResponse(payload);
  const matchedPayment = paymentIdHint
    ? listResponse.payments.find((payment) => payment.id === paymentIdHint)
    : listResponse.payments[0];

  if (!matchedPayment) {
    throw new Error("Payment response did not include a payment record");
  }

  return matchedPayment;
};

export async function getInvoices(
  status?: "all" | Invoice["status"],
  customerId?: string
): Promise<Invoice[]> {
  const url = new URL(`${API_BASE_URL}/invoices`);
  if (customerId) {
    url.searchParams.append("customerId", customerId);
  }
  const res = await fetch(url.toString());
  if (!res.ok) {
    throw new Error("Failed to fetch invoices");
  }
  const payload = await res.json();
  const invoices = Array.isArray(payload) ? payload.map(normalizeInvoice) : [];
  invoices.sort((a, b) => {
    const createdDelta =
      new Date(b.createdAt ?? 0).getTime() - new Date(a.createdAt ?? 0).getTime();
    if (createdDelta !== 0) {
      return createdDelta;
    }

    const issueDelta =
      new Date(b.issueDate ?? 0).getTime() - new Date(a.issueDate ?? 0).getTime();
    if (issueDelta !== 0) {
      return issueDelta;
    }

    return String(b.id).localeCompare(String(a.id));
  });

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

export async function createCustomerPayment(
  customerId: string,
  paymentData: CreateCustomerPaymentInput
): Promise<CustomerPayment> {
  const res = await fetch(`${API_BASE_URL}/customers/${customerId}/payments`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(paymentData),
  });

  if (!res.ok) {
    const errorBody = await res.json().catch(() => null);
    throw new Error(errorBody?.error || "Failed to create customer payment");
  }

  revalidatePath("/");
  revalidatePath("/customers");

  const payload = await res.json();
  return normalizeSingleCustomerPayment(payload);
}

export async function getCustomerPayments(
  customerId: string
): Promise<CustomerPaymentsResponse> {
  const res = await fetch(`${API_BASE_URL}/customers/${customerId}/payments`);
  if (!res.ok) {
    throw new Error("Failed to fetch customer payments");
  }

  const payload = await res.json();
  return normalizeCustomerPaymentsResponse(payload);
}

export async function updateCustomerPayment(
  customerId: string,
  paymentId: string,
  paymentData: UpdateCustomerPaymentInput
): Promise<CustomerPayment> {
  const paymentsBaseUrl = `${API_BASE_URL}/customers/${customerId}/payments`;
  const updateHeaders = {
    "Content-Type": "application/json",
  };
  let res = await fetch(`${paymentsBaseUrl}/${paymentId}`, {
    method: "PUT",
    headers: updateHeaders,
    body: JSON.stringify(paymentData),
  });

  if (!res.ok && (res.status === 404 || res.status === 405)) {
    res = await fetch(paymentsBaseUrl, {
      method: "PUT",
      headers: updateHeaders,
      body: JSON.stringify({
        ...paymentData,
        paymentId,
      }),
    });
  }

  if (!res.ok) {
    const errorBody = await res.json().catch(() => null);
    throw new Error(errorBody?.error || "Failed to update customer payment");
  }

  revalidatePath("/");
  revalidatePath("/customers");

  const payload = await res.json();
  return normalizeSingleCustomerPayment(payload, paymentId);
}

export async function deleteCustomerPayment(
  customerId: string,
  paymentId: string
): Promise<{ success: true }> {
  const paymentsBaseUrl = `${API_BASE_URL}/customers/${customerId}/payments`;
  let res = await fetch(`${paymentsBaseUrl}/${paymentId}`, {
    method: "DELETE",
  });

  if (!res.ok && (res.status === 404 || res.status === 405)) {
    res = await fetch(`${paymentsBaseUrl}?paymentId=${encodeURIComponent(paymentId)}`, {
      method: "DELETE",
    });
  }

  if (!res.ok && (res.status === 404 || res.status === 405)) {
    res = await fetch(paymentsBaseUrl, {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ paymentId }),
    });
  }

  if (!res.ok) {
    const errorBody = await res.json().catch(() => null);
    throw new Error(errorBody?.error || "Failed to delete customer payment");
  }

  revalidatePath("/");
  revalidatePath("/customers");

  return { success: true };
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
