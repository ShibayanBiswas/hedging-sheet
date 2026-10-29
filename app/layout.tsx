import type { Metadata, Viewport } from "next";
import { connection } from "next/server";

import { AppShell } from "@/components/layout/app-shell";
import { DeskDialogProvider } from "@/lib/context/desk-dialog-provider";
import { DeskKeyProvider } from "@/lib/context/desk-key-provider";
import { SurfaceUploadProvider } from "@/lib/context/surface-upload-provider";
import { DeskProvider } from "@/lib/context/desk-provider";

import "./globals.css";

export const metadata: Metadata = {
  title: "Hedging Sheet | Anand Rathi Wealth",
  description: "Accelerator hedging sheet: option book replication, inbuilt solve, day 1 vega hedge and margin stress.",
  icons: { icon: "/brand/arwl-logo.svg" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#ffffff",
  colorScheme: "light",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // Pages open on today's IST date, so they render per request rather than at build time.
  await connection();
  return (
    <html lang="en-IN">
      <body className="bg-white font-serif text-ink antialiased">
        <DeskDialogProvider>
          <DeskKeyProvider>
            <DeskProvider>
              <SurfaceUploadProvider>
                <AppShell>{children}</AppShell>
              </SurfaceUploadProvider>
            </DeskProvider>
          </DeskKeyProvider>
        </DeskDialogProvider>
      </body>
    </html>
  );
}
