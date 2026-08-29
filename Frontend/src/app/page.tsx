import { getInvoices } from "@/lib/actions";
import LedgerPageClient from "./ledger-page-client";

export const dynamic = "force-dynamic";

export default async function LedgerPage() {
  const invoices = await getInvoices();
  return <LedgerPageClient invoices={invoices} />;
}
