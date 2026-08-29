"use client";

import { useMemo, useState } from "react";

export type SortDirection = "asc" | "desc";

export type SortConfig<Key extends string> = {
  key: Key;
  direction: SortDirection;
};

type Comparator<Item> = (a: Item, b: Item) => number;

const normalizeText = (value: string | number | null | undefined) =>
  String(value ?? "");

const normalizeNumber = (value: number | null | undefined) =>
  Number.isFinite(Number(value)) ? Number(value) : 0;

export const compareText = (
  first: string | number | null | undefined,
  second: string | number | null | undefined
) =>
  normalizeText(first).localeCompare(normalizeText(second), undefined, {
    numeric: true,
    sensitivity: "base",
  });

export const compareNumber = (
  first: number | null | undefined,
  second: number | null | undefined
) => normalizeNumber(first) - normalizeNumber(second);

export const compareDate = (
  first: string | Date | null | undefined,
  second: string | Date | null | undefined
) => {
  const firstTime = first ? new Date(first).getTime() : 0;
  const secondTime = second ? new Date(second).getTime() : 0;

  return (
    (Number.isNaN(firstTime) ? 0 : firstTime) -
    (Number.isNaN(secondTime) ? 0 : secondTime)
  );
};

export function useSortableData<Item, Key extends string>(
  data: Item[],
  comparators: Record<Key, Comparator<Item>>
) {
  const [sortConfig, setSortConfig] = useState<SortConfig<Key> | null>(null);

  const requestSort = (key: Key) => {
    setSortConfig((current) => ({
      key,
      direction:
        current?.key === key && current.direction === "asc" ? "desc" : "asc",
    }));
  };

  const sortedData = useMemo(() => {
    if (!sortConfig) {
      return data;
    }

    const comparator = comparators[sortConfig.key];
    const directionMultiplier = sortConfig.direction === "asc" ? 1 : -1;

    return data
      .map((item, index) => ({ item, index }))
      .sort((first, second) => {
        const comparison =
          comparator(first.item, second.item) * directionMultiplier;

        return comparison || first.index - second.index;
      })
      .map(({ item }) => item);
  }, [comparators, data, sortConfig]);

  return { sortedData, sortConfig, requestSort };
}
