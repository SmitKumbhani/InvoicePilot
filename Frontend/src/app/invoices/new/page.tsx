import { InvoiceCreator } from "@/components/invoice-creator";
import { getItemGroups } from "@/lib/actions";

export default async function NewInvoicePage() {
  const groups = await getItemGroups();
  return <InvoiceCreator initialGroups={groups} />;
}
