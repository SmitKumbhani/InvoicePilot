import { getCustomers, getItems } from "@/lib/actions";
import { InvoiceCreator } from "@/components/invoice-creator";

export default async function NewInvoicePage() {
  const customers = await getCustomers();
  const items = await getItems();

  return <InvoiceCreator customers={customers} items={items} />;
}
