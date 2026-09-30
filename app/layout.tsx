import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { AppShell } from "./components/AppShell";
import { AppFooter } from "./components/AppFooter";
import { Toaster } from "./components/ui/toast";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
});

const PREFS_SCRIPT = `try{if(localStorage.getItem("kesher.sidebar")==="collapsed")document.documentElement.dataset.sidebar="collapsed"}catch(e){}`;

export const metadata: Metadata = {
  title: "Kesher",
  description: "School communications platform for email, SMS, and WhatsApp.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable}`}
      suppressHydrationWarning
    >
      <head>
        {/* Applies saved UI preferences before first paint (no flash). */}
        <script dangerouslySetInnerHTML={{ __html: PREFS_SCRIPT }} />
      </head>
      <body className="flex flex-col md:flex-row bg-[#fafafa] text-[#0f0f0f]">
        <AppShell>
          <main className="flex-1 min-w-0 flex flex-col min-h-screen">
            {children}
            <AppFooter />
          </main>
        </AppShell>
        <Toaster />
      </body>
    </html>
  );
}
