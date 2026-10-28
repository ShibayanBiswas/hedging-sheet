import type { Metadata, Viewport } from "next";
import { connection } from "next/server";

import { AppShell } from "@/components/layout/app-shell";
import { DeskDialogProvider } from "@/lib/context/desk-dialog-provider";
import { DeskProvider } from "@/lib/context/desk-provider";
import { ThemeProvider } from "@/lib/context/theme-provider";

import "./globals.css";

const themeInitScript = `(function(){try{var t=localStorage.getItem("hs-theme");if(t==="dark"){document.documentElement.classList.add("dark");document.documentElement.style.colorScheme="dark";}else{document.documentElement.classList.remove("dark");document.documentElement.style.colorScheme="light";}}catch(e){}})();`;

export const metadata: Metadata = {
  title: "Hedging Sheet | Anand Rathi Wealth",
  description: "Accelerator hedging sheet: option book replication, inbuilt solve, day 1 vega hedge and margin stress.",
  icons: { icon: "/brand/arwl-logo.svg" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#faf7f0" },
    { media: "(prefers-color-scheme: dark)", color: "#12100c" },
  ],
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // Pages open on today's IST date, so they render per request rather than at build time.
  await connection();
  return (
    <html lang="en-IN" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className="bg-background font-serif text-ink antialiased">
        <ThemeProvider>
          <DeskDialogProvider>
            <DeskProvider>
              <AppShell>{children}</AppShell>
            </DeskProvider>
          </DeskDialogProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
