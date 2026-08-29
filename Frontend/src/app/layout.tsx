import type { Metadata } from "next";
import { PT_Sans } from "next/font/google";
import "./globals.css";
import { AppLayout } from "@/components/app-layout";
import { Toaster } from "@/components/ui/toaster";
import { LoaderProvider } from "@/hooks/use-loader";

const ptSans = PT_Sans({
  subsets: ["latin"],
  weight: ["400", "700"],
  style: ["normal", "italic"],
  variable: "--font-pt-sans",
  display: "swap",
});

export const metadata: Metadata = {
  title: "InvoicePilot",
  description: "Generate invoices, track payments, and manage your business.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${ptSans.variable} font-body antialiased`}>
        <LoaderProvider>
          <AppLayout>{children}</AppLayout>
          <Toaster />
        </LoaderProvider>
      </body>
    </html>
  );
}
