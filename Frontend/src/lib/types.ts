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
  lineOrder?: number;
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

export type CustomerPaymentAllocation = {
  id?: string;
  invoiceId: string;
  invoiceNumber?: string;
  allocatedAmount: number;
  invoiceTotal?: number;
  invoiceAmountPaidBefore?: number;
  invoiceAmountPaidAfter?: number;
  invoiceRemainingBefore?: number;
  invoiceRemainingAfter?: number;
};

export type CustomerPayment = {
  id: string;
  customerId: string;
  amount: number;
  paymentDate: string | Date;
  note?: string;
  allocations: CustomerPaymentAllocation[];
  createdAt?: string | Date;
  updatedAt?: string | Date;
};

export type CustomerPaymentSummary = {
  pendingAmount?: number;
  outstandingAmount?: number;
  totalOutstanding?: number;
  totalPaid?: number;
  totalAllocated?: number;
  totalUnallocated?: number;
  availableCredit?: number;
  creditBalance?: number;
  customerCredit?: number;
};

export type CustomerPaymentsResponse = {
  payments: CustomerPayment[];
  summary?: CustomerPaymentSummary;
};

export type CreateCustomerPaymentInput = {
  amount: number;
  paymentDate: string;
  note?: string;
};

export type UpdateCustomerPaymentInput = {
  amount: number;
  paymentDate: string;
  note?: string;
};

export type SaleItem = {
  id: string;
  issueDate: string;
  status: InvoiceStatus;
  customerId: string;
  customerName: string;
  itemId: string | null;
  itemName: string;
  groupName: string | null;
  description: string;
  quantity: number;
  unitPrice: number;
  totalAmount: number;
  invoiceId: string;
  invoiceNumber: string;
};
