import { getCustomers, getItems, getInvoiceById } from "@/lib/actions";
import { InvoiceCreator } from "@/components/invoice-creator";
import { notFound } from "next/navigation";

export default async function EditInvoicePage({
  params: paramsPromise,
}: {
  params: Promise<{ id: string }>;
}) {
  const params = await paramsPromise;
  const invoice = await getInvoiceById(params.id);

  if (!invoice) {
    notFound();
  }

  const [customers, items] = await Promise.all([getCustomers(), getItems()]);

  return <InvoiceCreator invoice={invoice} customers={customers} items={items} />;
}
