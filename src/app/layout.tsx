import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "Progress Tracker",
  description: "A small app for tracking student progress across topics.",
};

export default function RootLayout({
  children,
}: {
  readonly children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen">
        <header className="border-b border-border">
          <nav className="mx-auto flex max-w-5xl items-center gap-6 px-4 py-3 text-sm">
            <Link href="/" className="font-semibold">
              Progress Tracker
            </Link>
            <Link
              href="/students"
              className="text-muted-foreground hover:text-foreground"
            >
              Students
            </Link>
            <Link
              href="/topics"
              className="text-muted-foreground hover:text-foreground"
            >
              Topics
            </Link>
            <Link
              href="/insights"
              className="text-muted-foreground hover:text-foreground"
            >
              Insights
            </Link>
            <Link
              href="/progress/new"
              className="text-muted-foreground hover:text-foreground"
            >
              Record progress
            </Link>
          </nav>
        </header>
        <main className="mx-auto max-w-5xl px-4 py-8">{children}</main>
      </body>
    </html>
  );
}
