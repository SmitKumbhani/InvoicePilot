import { getCustomers, getInvoices, getCustomerPayments } from "@/lib/actions";
import CustomersPageClient from "./customers-page-client";

export const dynamic = "force-dynamic";

export default async function CustomersPage() {
  const [customerList, invoiceList] = await Promise.all([
    getCustomers(),
    getInvoices(),
  ]);

  const customerCredits = await Promise.all(
    customerList.map(async (customer) => {
      try {
        const payments = await getCustomerPayments(customer.id);
        const creditValue =
          payments.summary?.customerCredit ??
          payments.summary?.availableCredit ??
          payments.summary?.creditBalance ??
          payments.summary?.totalUnallocated ??
          0;

        return {
          customerId: customer.id,
          customerCredit: Math.max(Number(creditValue) || 0, 0),
        };
      } catch {
        return {
          customerId: customer.id,
          customerCredit: 0,
        };
      }
    })
  );

  const customerCreditMap = new Map(
    customerCredits.map((entry) => [entry.customerId, entry.customerCredit])
  );

  const customerData = customerList.map((customer) => {
    const customerInvoices = invoiceList.filter(
      (inv) => inv.customerId === customer.id && inv.status !== "paid"
    );
    const pendingAmount = customerInvoices.reduce(
      (acc, inv) => acc + Math.max(inv.total - inv.amountPaid, 0),
      0
    );
    return {
      ...customer,
      pendingAmount,
      customerCredit: customerCreditMap.get(customer.id) ?? 0,
      invoices: customerInvoices,
    };
  });

  const totals = customerData.reduce(
    (acc, customer) => {
      acc.pendingAmount += Math.max(customer.pendingAmount || 0, 0);
      acc.customerCredit += Math.max(customer.customerCredit || 0, 0);
      return acc;
    },
    { pendingAmount: 0, customerCredit: 0 }
  );

  return <CustomersPageClient customers={customerData} totals={totals} />;
}
