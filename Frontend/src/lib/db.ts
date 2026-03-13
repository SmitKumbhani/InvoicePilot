
import type { Customer, Item, Invoice } from "./types";

// This file acts as our in-memory database.
// All server actions will import from this file to read and write data.

export const customers: Customer[] = [
  { id: "1", name: "Stark Industries", phone: "555-123-4567" },
  { id: "2", name: "Wayne Enterprises", phone: "555-987-6543" },
  { id: "3", name: "Cyberdyne Systems", phone: "555-867-5309" },
];

export const items: Item[] = [
  { id: "item-1", name: "Web Design", price: 1500.0, group_name: "Services" },
  { id: "item-2", name: "Backend Development", price: 2500.0, group_name: "Services" },
  { id: "item-3", name: "Monthly Retainer", price: 1000.0, group_name: "Services" },
  { id: "item-4", name: "Logo Design", price: 500.0, group_name: "Design" },
];

export let invoices: Invoice[] = [
  {
    id: "inv-1",
    invoiceNumber: "INV0001",
    customer: customers[0],
    customerId: "1",
    issueDate: "2024-05-01",
    status: "paid",
    lineItems: [
      {
        itemId: "item-1",
        group_name: "Services",
        description: "Web Design",
        quantity: 1,
        unitPrice: 1500.0,
      },
    ],
    total: 1500.0,
    amountPaid: 1500.0,
  },
  {
    id: "inv-2",
    invoiceNumber: "INV0002",
    customer: customers[1],
    customerId: "2",
    issueDate: "2024-05-15",
    status: "partially-paid",
    lineItems: [
      {
        itemId: "item-2",
        group_name: "Services",
        description: "Backend Development",
        quantity: 1,
        unitPrice: 2500.0,
      },
      {
        itemId: "item-4",
        group_name: "Design",
        description: "Logo Design",
        quantity: 1,
        unitPrice: 500.0,
      },
    ],
    total: 3000.0,
    amountPaid: 1000.0,
  },
  {
    id: "inv-3",
    invoiceNumber: "INV0003",
    customer: customers[2],
    customerId: "3",
    issueDate: "2024-06-01",
    status: "pending",
    lineItems: [
      {
        itemId: "item-3",
        group_name: "Services",
        description: "Monthly Retainer",
        quantity: 1,
        unitPrice: 1000.0,
      },
    ],
    total: 1000.0,
    amountPaid: 0,
  },
    {
    id: "inv-4",
    invoiceNumber: "INV0004",
    customer: customers[1],
    customerId: "2",
    issueDate: "2024-06-05",
    status: "pending",
    lineItems: [
      {
        itemId: "item-1",
        group_name: "Services",
        description: "Web Design",
        quantity: 1,
        unitPrice: 1500.0,
      },
    ],
    total: 1500.0,
    amountPaid: 0,
  },
];
