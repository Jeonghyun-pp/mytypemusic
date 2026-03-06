"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMediaQuery } from "@/lib/hooks/useMediaQuery";
import UnifiedComposer from "./_components/UnifiedComposer";
import FeatureGuide from "./_components/FeatureGuide";

const NAV_GROUPS = [
  {
    label: "Create",
    items: [
      { label: "Home", href: "/studio" },
      { label: "Create Hub", href: "/studio/create" },
      { label: "Design", href: "/studio/design" },
      { label: "Reels", href: "/studio/reels" },
      { label: "Blog", href: "/studio/blog" },
      { label: "Import", href: "/studio/import" },
    ],
  },
  {
    label: "Plan",
    items: [
      { label: "Calendar", href: "/studio/calendar" },
      { label: "Plan", href: "/studio/plan" },
      { label: "Research", href: "/studio/research" },
      { label: "Database", href: "/studio/database" },
    ],
  },
  {
    label: "Publish",
    items: [
      { label: "Publish", href: "/studio/publish" },
      { label: "Autopilot", href: "/studio/autopilot" },
    ],
  },
  {
    label: "Manage",
    items: [
      { label: "Inbox", href: "/studio/inbox" },
      { label: "Campaigns", href: "/studio/campaigns" },
    ],
  },
  {
    label: "Analyze",
    items: [
      { label: "Analytics", href: "/studio/analytics" },
    ],
  },
  {
    label: "Settings",
    items: [
      { label: "Persona", href: "/studio/persona" },
      { label: "Accounts", href: "/studio/accounts" },
    ],
  },
] as const;

export default function StudioLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isMobile = useMediaQuery("(max-width: 768px)");
  const [menuOpen, setMenuOpen] = useState(false);
  const [composerOpen, setComposerOpen] = useState(false);

  function isActive(href: string) {
    if (href === "/studio") return pathname === "/studio";
    return pathname.startsWith(href);
  }

  const sidebarContent = (
    <>
      <div style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: isMobile ? "0 16px 12px" : "0 20px 16px",
        borderBottom: "1px solid var(--border)",
        marginBottom: 8,
      }}>
        <span style={{
          fontSize: 20,
          fontWeight: 700,
          letterSpacing: "-0.02em",
          color: "var(--text)",
        }}>
          Studio
        </span>
        {isMobile && (
          <button
            onClick={() => setMenuOpen(false)}
            style={{
              background: "none",
              border: "none",
              color: "var(--text)",
              fontSize: 20,
              cursor: "pointer",
              padding: 4,
            }}
          >
            ✕
          </button>
        )}
      </div>
      {NAV_GROUPS.map((group) => (
        <div key={group.label}>
          <div style={{
            fontSize: 10,
            fontWeight: 600,
            textTransform: "uppercase" as const,
            letterSpacing: "0.06em",
            color: "var(--text-muted)",
            padding: isMobile ? "12px 16px 4px" : "12px 20px 4px",
          }}>
            {group.label}
          </div>
          {group.items.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="nav-link"
              onClick={() => isMobile && setMenuOpen(false)}
              style={{
                display: "block",
                padding: isMobile ? "9px 16px" : "7px 20px",
                fontSize: 13,
                fontWeight: isActive(item.href) ? 600 : 500,
                color: isActive(item.href) ? "var(--text)" : "var(--text-muted)",
                textDecoration: "none",
                borderLeft: isActive(item.href) ? "2px solid var(--accent)" : "2px solid transparent",
                background: isActive(item.href) ? "var(--accent-light)" : "transparent",
                borderRadius: "0 8px 8px 0",
              }}
            >
              {item.label}
            </Link>
          ))}
        </div>
      ))}
    </>
  );

  return (
    <div style={{ display: "flex", minHeight: "100vh" }}>
      {/* Mobile header bar */}
      {isMobile && (
        <div style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          height: 48,
          background: "var(--bg-card)",
          borderBottom: "1px solid var(--border)",
          display: "flex",
          alignItems: "center",
          padding: "0 12px",
          zIndex: 100,
          gap: 12,
        }}>
          <button
            onClick={() => setMenuOpen(true)}
            style={{
              background: "none",
              border: "none",
              color: "var(--text)",
              fontSize: 20,
              cursor: "pointer",
              padding: 4,
              lineHeight: 1,
            }}
          >
            ☰
          </button>
          <span style={{ fontSize: 16, fontWeight: 700, color: "var(--text)", letterSpacing: "-0.02em" }}>
            Studio
          </span>
        </div>
      )}

      {/* Sidebar / Mobile drawer */}
      {isMobile ? (
        menuOpen && (
          <>
            {/* Backdrop */}
            <div
              className="drawer-backdrop"
              onClick={() => setMenuOpen(false)}
              style={{
                position: "fixed",
                inset: 0,
                background: "rgba(0,0,0,0.4)",
                zIndex: 200,
              }}
            />
            {/* Drawer */}
            <nav className="drawer-panel" style={{
              position: "fixed",
              top: 0,
              left: 0,
              bottom: 0,
              width: 240,
              background: "var(--bg-card)",
              borderRight: "1px solid var(--border)",
              zIndex: 201,
              padding: "24px 0",
              display: "flex",
              flexDirection: "column",
              gap: 4,
              overflowY: "auto",
            }}>
              {sidebarContent}
            </nav>
          </>
        )
      ) : (
        <nav style={{
          width: 200,
          flexShrink: 0,
          padding: "24px 0",
          borderRight: "1px solid var(--border)",
          background: "var(--bg-card)",
          display: "flex",
          flexDirection: "column",
          gap: 4,
          overflowY: "auto",
          position: "sticky",
          top: 0,
          height: "100vh",
        }}>
          {sidebarContent}
        </nav>
      )}

      {/* Main content */}
      <main className="page-enter" key={pathname} style={{
        flex: 1,
        padding: isMobile ? "60px 16px 24px" : "32px 40px",
        maxWidth: 1240,
        position: "relative",
      }}>
        {/* Feature Guide ? button */}
        <div style={{
          position: "absolute",
          top: isMobile ? 64 : 36,
          right: isMobile ? 16 : 40,
          zIndex: 50,
        }}>
          <FeatureGuide />
        </div>
        {children}
      </main>

      {/* FAB: New Post */}
      <button
        className="fab-btn"
        onClick={() => setComposerOpen(true)}
        style={{
          position: "fixed",
          bottom: isMobile ? 20 : 28,
          right: isMobile ? 20 : 28,
          width: 52,
          height: 52,
          borderRadius: "50%",
          border: "none",
          background: "linear-gradient(135deg, var(--accent), #2E8D5A)",
          color: "#fff",
          fontSize: 26,
          fontWeight: 300,
          cursor: "pointer",
          zIndex: 400,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
        title="새 포스트"
      >
        +
      </button>

      <UnifiedComposer open={composerOpen} onClose={() => setComposerOpen(false)} />
    </div>
  );
}
