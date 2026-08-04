import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { AppShell } from "./components/AppShell";
import { AppFooter } from "./components/AppFooter";
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

export const metadata: Metadata = {
  title: "Kesher",
  description: "Communications CRM for Heichal HaTorah",
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
    >
      <body className="flex bg-[#fafafa] text-[#0f0f0f]">
        <AppShell>
          <main className="flex-1 min-w-0 flex flex-col min-h-screen">
            {children}
            <AppFooter />
          </main>
        </AppShell>
      </body>
    </html>
  );
}
