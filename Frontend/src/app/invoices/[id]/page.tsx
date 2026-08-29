
import { getInvoiceById, getInvoices } from "@/lib/actions";
import { notFound } from "next/navigation";
import { InvoicePageClient } from "@/components/invoice-page-client";

export default async function InvoicePage({
  params: paramsPromise,
  searchParams: searchParamsPromise,
}: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ printMode?: string }>;
}) {
  const params = await paramsPromise;
  const searchParams = searchParamsPromise ? await searchParamsPromise : undefined;
  const invoice = await getInvoiceById(params.id);

  if (!invoice) {
    notFound();
  }

  const customerOtherInvoices = await getInvoices(undefined, invoice.customerId);
  const previousBalanceDue = customerOtherInvoices
    .filter((inv) => inv.id !== invoice.id)
    .reduce((acc, inv) => {
      return acc + Math.max(inv.total - inv.amountPaid, 0);
    }, 0);

  const printMode = searchParams?.printMode === "invoice-only" ? "invoice-only" : "full";


  return (
    <InvoicePageClient
      invoice={invoice}
      previousBalanceDue={previousBalanceDue}
      printMode={printMode}
    />
  );
}
