export type Customer = {
  id: string;
  name: string;
  phone: string;
};

export type Item = {
  id: string;
  name: string;
  price: number;
  group_name?: string;
};

export type LineItem = {
  id?: string;
  itemId?: string | null;
  group_name?: string;
  description: string;
  quantity: number;
  unitPrice: number;
  itemName?: string;
};

export type InvoiceStatus = "paid" | "pending" | "draft" | "partially-paid";

export type Invoice = {
  id: string;
  invoiceNumber: string;
  customer: Customer;
  customerId: string;
  issueDate: string | Date;
  status: InvoiceStatus;
  lineItems: LineItem[];
  total: number;
  amountPaid: number;
  createdAt?: string | Date;
  updatedAt?: string | Date;
};

export type PriceHistoryEntry = {
  unitPrice: number;
  issueDate: string | Date;
  itemName?: string;
};

export type InvoiceUpsertInput = {
  customerId: string;
  issueDate: string;
  lineItems: LineItem[];
  status?: InvoiceStatus;
};
