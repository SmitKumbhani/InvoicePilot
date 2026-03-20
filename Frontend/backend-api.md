# Backend API Endpoints (Server Actions)

This Next.js application uses **Server Actions** to handle backend operations. These are functions defined in `src/lib/actions.ts` and marked with `"use server"`. They can be called directly from client components, and Next.js automatically creates and manages the necessary endpoints behind the scenes.

Here is the list of all the backend functions required to power the app's current features, along with their traditional REST API equivalents for reference.

---

### Invoice Management

*   **`getInvoices()`**: Fetches a list of all invoices.
    *   **REST Equivalent**: `GET /api/invoices`

*   **`getInvoiceById(invoiceId)`**: Retrieves a single invoice by its ID.
    *   **REST Equivalent**: `GET /api/invoices/{id}`

*   **`createInvoice(invoiceData)`**: Creates a new invoice.
    *   **REST Equivalent**: `POST /api/invoices`

*   **`updateInvoice(invoiceId, invoiceData)`**: Updates an existing invoice (customer/date/items/prices) and recalculates totals.
    *   **REST Equivalent**: `PUT /api/invoices/{id}`

*   **`deleteInvoice(invoiceId)`**: Deletes an invoice.
    *   **REST Equivalent**: `DELETE /api/invoices/{id}`

---

### Customer Management

*   **`getCustomers()`**: Fetches a list of all customers.
    *   **REST Equivalent**: `GET /api/customers`

*   **`createCustomer(customerData)`**: Creates a new customer.
    *   **REST Equivalent**: `POST /api/customers`

*   **`updateCustomer(customerId, customerData)`**: Updates an existing customer's details.
    *   **REST Equivalent**: `PUT /api/customers/{id}`

*   **`deleteCustomer(customerId)`**: Deletes a customer and all of their associated invoices.
    *   **REST Equivalent**: `DELETE /api/customers/{id}`

*   **`createCustomerPayment(customerId, paymentData)`**: Records a customer-level payment and auto-allocates to oldest invoices first.
    *   **REST Equivalent**: `POST /api/customers/{id}/payments`

*   **`getCustomerPayments(customerId)`**: Retrieves customer payment history, allocations, and credit summary.
    *   **REST Equivalent**: `GET /api/customers/{id}/payments`

*   **`updateCustomerPayment(customerId, paymentId, paymentData)`**: Updates a customer payment and recalculates invoice allocations.
    *   **REST Equivalent**: `PUT /api/customers/{id}/payments/{paymentId}`

*   **`deleteCustomerPayment(customerId, paymentId)`**: Deletes a customer payment and recalculates invoice allocations.
    *   **REST Equivalent**: `DELETE /api/customers/{id}/payments/{paymentId}`

---

### Item & Price Management

*   **`getItems()`**: Fetches a list of all items/services.
    *   **REST Equivalent**: `GET /api/items`

*   **`createItem(itemData)`**: Creates a new billable item.
    *   **REST Equivalent**: `POST /api/items`

*   **`updateItem(itemId, itemData)`**: Updates an existing item.
    *   **REST Equivalent**: `PUT /api/items/{id}`

*   **`getItemPriceHistory(itemId, customerId)`**: Retrieves the purchase history of a specific item for a specific customer.
    *   **REST Equivalent**: `GET /api/items/{itemId}/history?customerId={customerId}`
