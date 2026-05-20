// src/lib/print-receipts.ts

/**
 * Open a hidden window, write the given HTML inside an A4-styled boilerplate,
 * and trigger the browser print dialog. Closes the window after print.
 *
 * The HTML should consist of one or more elements with class `receipt-page`,
 * each of which becomes a separate printed page.
 *
 * `contentHtml` is injected without sanitization — callers MUST pass a string
 * from a trusted source (e.g. `ref.current.innerHTML` snapshot of React-rendered
 * DOM). Never pass user-typed text.
 */
export function printReceiptsHtml(opts: {
  title: string
  contentHtml: string
}): void {
  const { title, contentHtml } = opts
  const printWindow = window.open("", "_blank", "width=800,height=1000")
  if (!printWindow) {
    console.error("Failed to open print window (popup blocked?)")
    return
  }

  printWindow.document.write(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>${escapeHtml(title)}</title>
      <script src="https://cdn.tailwindcss.com"></script>
      <style>
        @media print {
          body { margin: 0; padding: 0; }
          @page { size: A4 portrait; margin: 0; }
          .receipt-page {
            width: 210mm;
            min-height: 297mm;
            padding: 8mm;
            page-break-after: always;
          }
          .receipt-page:last-child { page-break-after: auto; }
          .no-break { page-break-inside: avoid; }
        }
      </style>
    </head>
    <body>
      ${contentHtml}
    </body>
    </html>
  `)
  printWindow.document.close()

  // Wait for tailwind CDN to load, then print.
  setTimeout(() => {
    printWindow.print()
    printWindow.close()
  }, 1000)
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
}
