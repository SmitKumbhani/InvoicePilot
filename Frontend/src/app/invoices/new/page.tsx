import { getCustomers, getItems } from "@/lib/actions";
import { InvoiceCreator } from "@/components/invoice-creator";

export default async function NewInvoicePage() {
  const [customers, items] = await Promise.all([
    getCustomers(),
    getItems()
  ]);

  return <InvoiceCreator customers={customers} items={items} />;
}
