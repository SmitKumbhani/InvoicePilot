import { getSales, getCustomers, getItems } from "@/lib/actions";
import { DashboardClient } from "@/components/dashboard-client";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const [sales, customers, items] = await Promise.all([
    getSales(),
    getCustomers(),
    getItems()
  ]);

  return <DashboardClient sales={sales} customers={customers} items={items} />;
}
