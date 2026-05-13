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

  const getInvoices = async (status?: "all" | Invoice["status"]) => {
    showLoader();
    try {
      if (enabled) {
        return [] as Invoice[];
      }
      return await serverActions.getInvoices(status);
    } finally {
      hideLoader();
    }
  };

  const getInvoiceById = async (invoiceId: string) => {
    showLoader();
    try {
      if (enabled) {
        return undefined;
      }
      return await serverActions.getInvoiceById(invoiceId);
    } finally {
      hideLoader();
    }
  };

  const getCustomers = async () => {
    showLoader();
    try {
      if (enabled) {
        return [] as Customer[];
      }
      return await serverActions.getCustomers();
    } finally {
      hideLoader();
    }
  };

  const getItems = async () => {
    showLoader();
    try {
      if (enabled) {
        return [] as Item[];
      }
      return await serverActions.getItems();
    } finally {
      hideLoader();
    }
  };

  const getItemPriceHistory = async (itemId: string, customerId: string) => {
    showLoader();
    try {
      if (enabled) {
        return [] as PriceHistoryEntry[];
      }
      return await serverActions.getItemPriceHistory(itemId, customerId);
    } finally {
      hideLoader();
    }
  };

  const createInvoice = async (invoiceData: InvoiceUpsertInput) => {
    showLoader();
    try {
      if (enabled) {
        return { status: "Safe mode active" };
      }
      return await serverActions.createInvoice(invoiceData);
    } finally {
      hideLoader();
    }
  };

  const updateInvoice = async (invoiceId: string, invoiceData: InvoiceUpsertInput) => {
    showLoader();
    try {
      if (enabled) {
        return {} as Invoice;
      }
      return await serverActions.updateInvoice(invoiceId, invoiceData);
    } finally {
      hideLoader();
    }
  };

  const createCustomerPayment = async (
    customerId: string,
    paymentData: CreateCustomerPaymentInput
  ): Promise<CustomerPayment> => {
    showLoader();
    try {
      if (enabled) {
        return {
          id: "",
          customerId,
          amount: paymentData.amount,
          paymentDate: paymentData.paymentDate,
          note: paymentData.note,
          allocations: [],
        };
      }
      return await serverActions.createCustomerPayment(customerId, paymentData);
    } finally {
      hideLoader();
    }
  };

  const getCustomerPayments = async (customerId: string): Promise<CustomerPaymentsResponse> => {
    showLoader();
    try {
      if (enabled) {
        return { payments: [], summary: { customerCredit: 0, totalUnallocated: 0 } };
      }
      return await serverActions.getCustomerPayments(customerId);
    } finally {
      hideLoader();
    }
  };

  const updateCustomerPayment = async (
    customerId: string,
    paymentId: string,
    paymentData: UpdateCustomerPaymentInput
  ): Promise<CustomerPayment> => {
    showLoader();
    try {
      if (enabled) {
        return {
          id: paymentId,
          customerId,
          amount: paymentData.amount,
          paymentDate: paymentData.paymentDate,
          note: paymentData.note,
          allocations: [],
        };
      }
      return await serverActions.updateCustomerPayment(customerId, paymentId, paymentData);
    } finally {
      hideLoader();
    }
  };

  const deleteCustomerPayment = async (
    customerId: string,
    paymentId: string
  ): Promise<{ success: true }> => {
    showLoader();
    try {
      if (enabled) {
        return { success: true };
      }
      return await serverActions.deleteCustomerPayment(customerId, paymentId);
    } finally {
      hideLoader();
    }
  };

  const createItem = async (itemData: {
    name: string;
    price: number;
    purchasePrice?: number;
    group_name?: string;
  }) => {
    showLoader();
    try {
      if (enabled) {
        return { status: "Safe mode active" };
      }
      return await serverActions.createItem(itemData);
    } finally {
      hideLoader();
    }
  };

  const updateItem = async (itemId: string, itemData: {
    name: string;
    price: number;
    purchasePrice?: number;
    group_name?: string;
  }) => {
    showLoader();
    try {
      if (enabled) {
        return { status: "Safe mode active" };
      }
      return await serverActions.updateItem(itemId, itemData);
    } finally {
      hideLoader();
    }
  };

  const createCustomer = async (customerData: { name: string; phone: string }) => {
    showLoader();
    try {
      if (enabled) {
        return { status: "Safe mode active" };
      }
      return await serverActions.createCustomer(customerData);
    } finally {
      hideLoader();
    }
  };

  const updateCustomer = async (customerId: string, customerData: { name: string; phone: string }) => {
    showLoader();
    try {
      if (enabled) {
        return { status: "Safe mode active" };
      }
      return await serverActions.updateCustomer(customerId, customerData);
    } finally {
      hideLoader();
    }
  };

  const deleteCustomer = async (customerId: string) => {
    showLoader();
    try {
      if (enabled) {
        return { success: true };
      }
      return await serverActions.deleteCustomer(customerId);
    } finally {
      hideLoader();
    }
  };

  const deleteInvoice = async (invoiceId: string) => {
    showLoader();
    try {
      if (enabled) {
        return { success: true };
      }
      return await serverActions.deleteInvoice(invoiceId);
    } finally {
      hideLoader();
    }
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
