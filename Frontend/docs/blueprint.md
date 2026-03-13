# **App Name**: InvoicePilot

## Core Features:

- Database Connection & Schema Management: Connects to a PostgreSQL database, creates schemas and tables if they don't exist, or utilizes existing ones for data storage. Includes error handling and connection status indicators.
- Invoice Generation: Generates invoices with customizable fields like items, quantities, prices, customer details, and tax rates.
- Data Persistence: Saves generated invoice data in the PostgreSQL database, using a JSON string format for flexibility and to accommodate variable invoice structures. This also allows complex objects and data to be handled easily.
- Pricing History: Displays the purchase price history for selected items in a side panel during invoice generation. This helps with informed pricing decisions.
- Ledger Management: Provides a ledger to track payments, distinguishing between pending and completed payments, to enable effective accounts receivable management.

## Style Guidelines:

- Primary color: A calming blue (#468B97) to instill trust and reliability.
- Background color: Light, desaturated blue (#E3E9EB) to ensure comfortable readability.
- Accent color: Muted gold (#C8B486) to highlight key actions and information.
- Body and headline font: 'PT Sans', a humanist sans-serif for its balance of modern appeal and readability, fitting for both headlines and invoice details.
- Use clean and professional icons related to invoices, payments, and database management.
- A clean, well-organized layout with clear sections for invoice generation, pricing history, and ledger view to ensure an efficient user experience.
- Subtle transitions and animations for form inputs and data updates, creating a smooth and responsive feel.