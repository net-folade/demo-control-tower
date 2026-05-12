import type { Metadata } from "next";
import Link from "next/link";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { ThemeProvider, THEME_INIT_SCRIPT } from "../lib/theme";
import { ThemeToggle } from "../components/ThemeToggle";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Ghana Control Tower",
  description:
    "Demo control tower for West Africa / Ghana trade flows: ports, trade, commodities, disruption signals.",
};

const REPO_URL = "https://github.com/net-folade/demo-control-tower";

const NAV_LINKS: { href: string; label: string }[] = [
  { href: "/", label: "Overview" },
  { href: "/disruptions", label: "Disruptions" },
];

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body
        className="min-h-full flex flex-col bg-neutral-950 text-neutral-100"
        suppressHydrationWarning
      >
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
        <ThemeProvider>
          <TopNav />
          <div className="flex flex-1 flex-col w-full max-w-6xl mx-auto px-6 py-10">
            {children}
          </div>
          <SiteFooter />
        </ThemeProvider>
      </body>
    </html>
  );
}

function TopNav() {
  return (
    <header className="sticky top-0 z-20 border-b border-neutral-900 bg-neutral-950/80 backdrop-blur supports-[backdrop-filter]:bg-neutral-950/60">
      <nav className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2 group">
          <span
            aria-hidden
            className="inline-block h-2 w-2 rounded-full bg-emerald-400 group-hover:bg-emerald-300 transition-colors"
          />
          <span className="text-sm font-semibold tracking-tight">
            Ghana Control Tower
          </span>
        </Link>
        <ul className="flex items-center gap-1 text-sm">
          {NAV_LINKS.map((link) => (
            <li key={link.href}>
              <Link
                href={link.href}
                className="px-3 py-1.5 rounded-md text-neutral-400 hover:text-neutral-100 hover:bg-neutral-900 transition-colors"
              >
                {link.label}
              </Link>
            </li>
          ))}
          <li>
            <a
              href={REPO_URL}
              target="_blank"
              rel="noreferrer noopener"
              className="px-3 py-1.5 rounded-md text-neutral-500 hover:text-neutral-200 hover:bg-neutral-900 transition-colors font-mono text-xs"
            >
              GitHub ↗
            </a>
          </li>
          <li className="pl-1">
            <ThemeToggle />
          </li>
        </ul>
      </nav>
    </header>
  );
}

function SiteFooter() {
  return (
    <footer className="border-t border-neutral-900 mt-16">
      <div className="max-w-6xl mx-auto px-6 py-8 flex flex-col md:flex-row gap-4 md:gap-6 md:items-end justify-between text-xs text-neutral-500">
        <div className="flex flex-col gap-1.5 leading-relaxed">
          <p className="text-neutral-400">
            Built on public data + free-tier services.
          </p>
          <p>
            Sources: World Bank Pink Sheet · UN Comtrade · GPHA · Open-Meteo ·
            GDELT 2.0
          </p>
        </div>
        <div className="flex flex-col gap-1.5 md:items-end font-mono">
          <a
            href={REPO_URL}
            target="_blank"
            rel="noreferrer noopener"
            className="hover:text-neutral-200 transition-colors"
          >
            github.com/net-folade/demo-control-tower ↗
          </a>
          <p className="text-neutral-600">Demo · not financial advice</p>
        </div>
      </div>
    </footer>
  );
}
