"use client"
import { useLoader } from "@/hooks/use-loader";
import * as serverActions from "./actions";
import { useKillSwitch } from "@/components/kill-switch-context";
import type {
  Customer,
  Item,
  Invoice,
  InvoiceUpsertInput,
  PriceHistoryEntry,
  CustomerPayment,
  CustomerPaymentsResponse,
  CreateCustomerPaymentInput,
  UpdateCustomerPaymentInput,
} from "./types";

export const useApi = () => {
  const { showLoader, hideLoader } = useLoader();
  const { enabled } = useKillSwitch();

  const wrapApi = async <T>(name: string, fn: () => Promise<T>, safeDefault?: T): Promise<T> => {
    showLoader();
    try {
      if (enabled) {
        console.warn(`[useApi] Safe mode active. Skipping ${name}.`);
        return safeDefault as T;
      }
      return await fn();
    } catch (error) {
      console.error(`[useApi Error in ${name}]:`, error);
      throw error;
    } finally {
      hideLoader();
    }
  };

  const getInvoices = async (status?: "all" | Invoice["status"]) => {
    return wrapApi("getInvoices", () => serverActions.getInvoices(status), [] as Invoice[]);
  };

  const getInvoiceById = async (invoiceId: string) => {
    return wrapApi("getInvoiceById", () => serverActions.getInvoiceById(invoiceId), undefined);
  };

  const getCustomers = async () => {
    return wrapApi("getCustomers", () => serverActions.getCustomers(), [] as Customer[]);
  };

  const getItems = async () => {
    return wrapApi("getItems", () => serverActions.getItems(), [] as Item[]);
  };

  const getItemPriceHistory = async (itemId: string, customerId: string) => {
    return wrapApi("getItemPriceHistory", () => serverActions.getItemPriceHistory(itemId, customerId), [] as PriceHistoryEntry[]);
  };

  const createInvoice = async (invoiceData: InvoiceUpsertInput) => {
    return wrapApi("createInvoice", () => serverActions.createInvoice(invoiceData), { status: "Safe mode active" });
  };

  const updateInvoice = async (invoiceId: string, invoiceData: InvoiceUpsertInput) => {
    return wrapApi("updateInvoice", () => serverActions.updateInvoice(invoiceId, invoiceData), { status: "Safe mode active" });
  };

  const createCustomerPayment = async (paymentData: CreateCustomerPaymentInput) => {
    return wrapApi("createCustomerPayment", () => serverActions.createCustomerPayment(paymentData), { status: "Safe mode active" } as any);
  };

  const getCustomerPayments = async (customerId: string) => {
    return wrapApi("getCustomerPayments", () => serverActions.getCustomerPayments(customerId), { customerId, payments: [], pendingAmount: 0, customerCredit: 0 } as CustomerPaymentsResponse);
  };

  const updateCustomerPayment = async (
    customerId: string,
    paymentId: string,
    paymentData: UpdateCustomerPaymentInput
  ) => {
    return wrapApi("updateCustomerPayment", () => serverActions.updateCustomerPayment(customerId, paymentId, paymentData), { status: "Safe mode active" } as any);
  };

  const deleteCustomerPayment = async (customerId: string, paymentId: string) => {
    return wrapApi("deleteCustomerPayment", () => serverActions.deleteCustomerPayment(customerId, paymentId), { message: "Safe mode active" });
  };

  const createItem = async (itemData: {
    name: string;
    price: number;
    purchasePrice?: number;
    group_name?: string;
  }) => {
    return wrapApi("createItem", () => serverActions.createItem(itemData), { status: "Safe mode active" } as any);
  };

  const updateItem = async (itemId: string, itemData: {
    name: string;
    price: number;
    purchasePrice?: number;
    group_name?: string;
  }) => {
    return wrapApi("updateItem", () => serverActions.updateItem(itemId, itemData), { status: "Safe mode active" } as any);
  };

  const createCustomer = async (customerData: { name: string; phone: string }) => {
    return wrapApi("createCustomer", () => serverActions.createCustomer(customerData), { status: "Safe mode active" } as any);
  };

  const updateCustomer = async (customerId: string, customerData: { name: string; phone: string }) => {
    return wrapApi("updateCustomer", () => serverActions.updateCustomer(customerId, customerData), { status: "Safe mode active" } as any);
  };

  const deleteCustomer = async (customerId: string) => {
    return wrapApi("deleteCustomer", () => serverActions.deleteCustomer(customerId), { success: true });
  };

  const deleteInvoice = async (invoiceId: string) => {
    return wrapApi("deleteInvoice", () => serverActions.deleteInvoice(invoiceId), { success: true });
  };

  return {
    getInvoices,
    getInvoiceById,
    getCustomers,
    getItems,
    getItemPriceHistory,
    createInvoice,
    updateInvoice,
    createCustomerPayment,
    getCustomerPayments,
    updateCustomerPayment,
    deleteCustomerPayment,
    createItem,
    updateItem,
    createCustomer,
    updateCustomer,
    deleteCustomer,
    deleteInvoice,
  };
};
