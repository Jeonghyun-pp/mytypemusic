"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const styles = {
  container: {
    maxWidth: "1440px",
    margin: "0 auto",
    padding: "40px 32px",
  } as const,
  header: {
    display: "flex",
    alignItems: "center",
    gap: "24px",
    marginBottom: "32px",
  } as const,
  title: {
    fontSize: "26px",
    fontWeight: 700,
    letterSpacing: "-0.02em",
    color: "var(--text)",
  } as const,
  nav: {
    display: "flex",
    gap: "4px",
    marginLeft: "auto",
    background: "var(--bg-input)",
    borderRadius: "var(--radius-sm)",
    padding: "4px",
  } as const,
  tab: {
    padding: "8px 20px",
    borderRadius: "10px",
    fontSize: "13px",
    fontWeight: 500,
    color: "var(--text-muted)",
    background: "transparent",
    textDecoration: "none",
    transition: "all var(--transition)",
  } as const,
  tabActive: {
    color: "var(--text)",
    background: "var(--bg-card)",
    boxShadow: "var(--shadow-card)",
    fontWeight: 600,
  } as const,
};

const TABS = [
  { label: "Home", href: "/studio" },
  { label: "Design", href: "/studio/design" },
  { label: "Reels", href: "/studio/reels" },
  { label: "Calendar", href: "/studio/calendar" },
  { label: "Plan", href: "/studio/plan" },
  { label: "Database", href: "/studio/database" },
  { label: "Research", href: "/studio/research" },
] as const;

export default function StudioLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  function isActive(href: string) {
    if (href === "/studio") return pathname === "/studio";
    return pathname.startsWith(href);
  }

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h1 style={styles.title}>Studio</h1>
        <nav style={styles.nav}>
          {TABS.map((tab) => (
            <Link
              key={tab.href}
              href={tab.href}
              style={{
                ...styles.tab,
                ...(isActive(tab.href) ? styles.tabActive : {}),
              }}
            >
              {tab.label}
            </Link>
          ))}
        </nav>
      </div>
      {children}
    </div>
  );
}
