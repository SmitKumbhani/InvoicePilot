import { getItems } from "@/lib/actions";
import { ItemsClient } from "@/components/items-client";
import { PlusCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

export default async function ItemsPage() {
  const items = await getItems();

  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold font-headline tracking-tight">Items</h1>
          <p className="text-muted-foreground">
            Manage your items and stock.
          </p>
        </div>
      </div>
      <ItemsClient items={items} />
    </div>
  );
}
