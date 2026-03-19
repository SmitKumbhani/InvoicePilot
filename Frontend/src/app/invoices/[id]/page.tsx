
import { getCustomers, getInvoiceById, getInvoices, getItems } from "@/lib/actions";
import { notFound } from "next/navigation";
import { InvoicePageClient } from "@/components/invoice-page-client";

export default async function InvoicePage({ params: paramsPromise }: { params: Promise<{ id: string }> }) {
  const params = await paramsPromise;
  const invoice = await getInvoiceById(params.id);

  if (!invoice) {
    notFound();
  }

  const [allInvoices, customers, items] = await Promise.all([
    getInvoices(),
    getCustomers(),
    getItems(),
  ]);
  const customerOtherInvoices = allInvoices.filter(
    (inv) => inv.customerId === invoice.customerId && inv.id !== invoice.id
  );
  
  const previousBalanceDue = customerOtherInvoices.reduce((acc, inv) => {
    return acc + Math.max(inv.total - inv.amountPaid, 0);
  }, 0);


  return (
    <InvoicePageClient
      invoice={invoice}
      previousBalanceDue={previousBalanceDue}
      customers={customers}
      items={items}
    />
  );
}
