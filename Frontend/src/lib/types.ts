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
  itemId: string;
  group_name?: string;
  description: string;
  quantity: number;
  unitPrice: number;
};

export type Invoice = {
  id: string;
  invoiceNumber: string;
  customer: Customer;
  customerId: string;
  issueDate: string | Date;
  status: "paid" | "pending" | "draft" | "partially-paid";
  lineItems: LineItem[];
  total: number;
  amountPaid: number;
};

export type PriceHistoryEntry = {
  itemId: string;
  itemName: string;
  price: number;
  date: string;
  customerId: string;
};
