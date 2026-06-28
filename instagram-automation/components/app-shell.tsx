import Link from "next/link";

import { exampleBucketName } from "@/lib/utils";

const navItems = [
  { href: "/", label: "Dashboard" },
  { href: "/queue", label: "Queue" },
  { href: "/history", label: "History" },
  { href: "/settings", label: "Settings" },
  { href: "/test-lab", label: "Test Lab" }
];

export function AppShell({
  children,
  kicker = "SeriesPart.Hub",
  title = "Reel Publishing Engine",
  subtitle = "Schedule public Supabase clips, publish with Meta, and keep the queue clean."
}: Readonly<{
  children: React.ReactNode;
  kicker?: string;
  title?: string;
  subtitle?: string;
}>) {
  return (
    <main className="min-h-screen">
      <header className="border-b border-line bg-panel">
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-5 px-4 py-6 md:px-8">
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase text-moss">{kicker}</p>
              <h1 className="mt-2 text-3xl font-bold tracking-normal text-ink md:text-5xl">
                {title}
              </h1>
              <p className="mt-3 max-w-2xl text-base leading-7 text-steel">{subtitle}</p>
            </div>
            <div className="rounded border border-line bg-white px-4 py-3 text-sm text-steel">
              Supabase bucket: <span className="font-semibold text-ink">{exampleBucketName}</span>
            </div>
          </div>
          <nav className="flex flex-wrap gap-2">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="rounded border border-line bg-white px-3 py-2 text-sm font-medium text-ink hover:border-moss hover:text-moss"
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </div>
      </header>
      <div className="mx-auto w-full max-w-7xl px-4 py-6 md:px-8">{children}</div>
    </main>
  );
}
