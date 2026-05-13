export type InvoicePrintMode = "full" | "invoice-only";

export function printInvoiceWithMode(invoiceId: string, mode: InvoicePrintMode) {
  const params = new URLSearchParams({
    print: "true",
    printMode: mode,
  });
  const printUrl = `/invoices/${invoiceId}?${params.toString()}`;

  const iframe = document.createElement("iframe");
  iframe.style.display = "none";
  iframe.src = printUrl;

  iframe.onload = function () {
    if (!iframe.contentWindow) {
      return;
    }

    iframe.contentWindow.focus();
    iframe.contentWindow.print();

    const removeIframe = () => {
      if (iframe.parentNode) {
        document.body.removeChild(iframe);
      }
    };

    if (iframe.contentWindow.onafterprint !== undefined) {
      iframe.contentWindow.onafterprint = removeIframe;
    } else {
      setTimeout(removeIframe, 1000);
    }
  };

  document.body.appendChild(iframe);
}

