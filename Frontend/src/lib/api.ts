"use client"
import { useLoader } from "@/hooks/use-loader";
import * as serverActions from "./actions";
import type { Invoice, InvoiceUpsertInput } from "./types";

export const useApi = () => {
  const { showLoader, hideLoader } = useLoader();

  const getInvoices = async (status?: "all" | Invoice["status"]) => {
    showLoader();
    try {
      return await serverActions.getInvoices(status);
    } finally {
      hideLoader();
    }
  };

  const getInvoiceById = async (invoiceId: string) => {
    showLoader();
    try {
      return await serverActions.getInvoiceById(invoiceId);
    } finally {
      hideLoader();
    }
  };

  const getCustomers = async () => {
    showLoader();
    try {
      return await serverActions.getCustomers();
    } finally {
      hideLoader();
    }
  };

  const getItems = async () => {
    showLoader();
    try {
      return await serverActions.getItems();
    } finally {
      hideLoader();
    }
  };

  const getItemPriceHistory = async (itemId: string, customerId: string) => {
    showLoader();
    try {
      return await serverActions.getItemPriceHistory(itemId, customerId);
    } finally {
      hideLoader();
    }
  };

  const createInvoice = async (invoiceData: InvoiceUpsertInput) => {
    showLoader();
    try {
      return await serverActions.createInvoice(invoiceData);
    } finally {
      hideLoader();
    }
  };

  const updateInvoice = async (invoiceId: string, invoiceData: InvoiceUpsertInput) => {
    showLoader();
    try {
      return await serverActions.updateInvoice(invoiceId, invoiceData);
    } finally {
      hideLoader();
    }
  };

  const updateInvoicePayment = async (invoiceId: string, paymentAmount: number) => {
    showLoader();
    try {
      return await serverActions.updateInvoicePayment(invoiceId, paymentAmount);
    } finally {
      hideLoader();
    }
  };

  const setInvoicePaidAmount = async (invoiceId: string, amountPaid: number) => {
    showLoader();
    try {
      return await serverActions.setInvoicePaidAmount(invoiceId, amountPaid);
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
      return await serverActions.updateItem(itemId, itemData);
    } finally {
      hideLoader();
    }
  };

  const createCustomer = async (customerData: { name: string; phone: string }) => {
    showLoader();
    try {
      return await serverActions.createCustomer(customerData);
    } finally {
      hideLoader();
    }
  };

  const updateCustomer = async (customerId: string, customerData: { name: string; phone: string }) => {
    showLoader();
    try {
      return await serverActions.updateCustomer(customerId, customerData);
    } finally {
      hideLoader();
    }
  };

  const deleteCustomer = async (customerId: string) => {
    showLoader();
    try {
      return await serverActions.deleteCustomer(customerId);
    } finally {
      hideLoader();
    }
  };

  const deleteInvoice = async (invoiceId: string) => {
    showLoader();
    try {
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
    updateInvoicePayment,
    setInvoicePaidAmount,
    createItem,
    updateItem,
    createCustomer,
    updateCustomer,
    deleteCustomer,
    deleteInvoice,
  };
};
