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

// Applies saved UI preferences before first paint (no flash):
//  - sidebar collapsed state (Part 3)
//  - theme: "light" (default) | "dark" | "system"; exposes window.__kesherTheme
//    for Settings → Appearance and follows OS changes while on "system".
const PREFS_SCRIPT = `(function(){var d=document.documentElement;function get(k){try{return localStorage.getItem(k)}catch(e){return null}}
if(get("kesher.sidebar")==="collapsed")d.dataset.sidebar="collapsed";
var m=window.matchMedia("(prefers-color-scheme: dark)");
window.__kesherTheme=function(p){p=p==="dark"||p==="system"?p:"light";d.dataset.themePref=p;d.dataset.theme=p==="system"?(m.matches?"dark":"light"):p};
window.__kesherTheme(get("kesher.theme"));
m.addEventListener("change",function(){if(d.dataset.themePref==="system")window.__kesherTheme("system")});})();`;

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
