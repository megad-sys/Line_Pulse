"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Factory, Sun, Moon, LogOut, ChevronDown } from "lucide-react";
import { useDemoMode } from "@/lib/demo-context";
import { useTheme } from "@/lib/theme-context";
import { createClient } from "@/lib/supabase/client";

const links = [
  { href: "/dashboard", label: "Dashboard", exact: true },
];

export default function Nav({
  userName,
  userEmail,
  userInitials,
}: {
  userName: string;
  userEmail: string;
  userInitials: string;
}) {
  const pathname = usePathname();
  const router   = useRouter();
  const { isDemo, toggle } = useDemoMode();
  const { theme, toggleTheme } = useTheme();
  const [menuOpen, setMenuOpen] = useState(false);

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
  }

  return (
    <nav
      className="h-14 flex items-center px-6 gap-8 shrink-0 border-b"
      style={{ backgroundColor: "var(--bg)", borderColor: "var(--border)" }}
    >
      {/* Logo */}
      <div className="flex items-center gap-2 font-bold text-lg tracking-tight" style={{ color: "var(--text)" }}>
        <Factory size={20} style={{ color: "#60a5fa" }} />
        <span>Line Pulse</span>
      </div>

      {/* Nav links */}
      <div className="flex items-center gap-1 flex-1">
        {links.map((link) => {
          const active = link.exact ? pathname === link.href : pathname.startsWith(link.href);
          return (
            <Link key={link.href} href={link.href}
              className="px-3 py-1.5 rounded text-sm font-medium transition-colors"
              style={{
                color: active ? "var(--text)" : "var(--muted)",
                backgroundColor: active ? "var(--surface2)" : "transparent",
              }}>
              {link.label}
            </Link>
          );
        })}
      </div>

      {/* Right controls */}
      <div className="flex items-center gap-2">

        {/* Demo / Live toggle */}
        <button onClick={toggle}
          className={`text-xs font-semibold px-2.5 py-1 rounded-full border transition-colors ${
            isDemo
              ? "text-blue-400 bg-blue-400/10 border-blue-400/20 hover:bg-blue-400/20"
              : "hover:border-[var(--muted)]"
          }`}
          style={!isDemo ? { color: "var(--muted)", border: "1px solid var(--border)" } : {}}>
          {isDemo ? "Demo Mode" : "Live Data"}
        </button>

        {/* Theme toggle */}
        <button onClick={toggleTheme} title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
          className="w-8 h-8 flex items-center justify-center rounded-lg transition-colors"
          style={{ color: "var(--muted)", backgroundColor: "transparent" }}
          onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "var(--surface2)")}
          onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}>
          {theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
        </button>

        {/* User menu */}
        <div className="relative">
          <button
            onClick={() => setMenuOpen((v) => !v)}
            className="flex items-center gap-2 rounded-lg px-2 py-1.5 transition-colors"
            style={{ color: "var(--text)" }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "var(--surface2)")}
            onMouseLeave={(e) => !menuOpen && (e.currentTarget.style.backgroundColor = "transparent")}
          >
            <div
              className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
              style={{ backgroundColor: "#3730a3", color: "#f0ede8" }}
            >
              {userInitials}
            </div>
            <span className="text-sm max-w-[140px] truncate">{userEmail || userName}</span>
            <ChevronDown size={13} style={{ color: "var(--muted)" }} />
          </button>

          {menuOpen && (
            <>
              {/* Backdrop */}
              <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} />
              {/* Dropdown */}
              <div
                className="absolute right-0 top-full mt-1.5 w-52 rounded-xl border shadow-xl z-50 overflow-hidden"
                style={{ backgroundColor: "var(--surface)", borderColor: "var(--border)" }}
              >
                <div className="px-4 py-3 border-b" style={{ borderColor: "var(--border)" }}>
                  <p className="text-xs font-medium truncate" style={{ color: "var(--muted)" }}>Signed in as</p>
                  <p className="text-sm font-semibold truncate mt-0.5" style={{ color: "var(--text)" }}>{userEmail}</p>
                </div>
                <button
                  onClick={handleSignOut}
                  className="w-full flex items-center gap-2.5 px-4 py-3 text-sm transition-colors text-left"
                  style={{ color: "var(--muted)" }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLButtonElement).style.backgroundColor = "var(--surface2)";
                    (e.currentTarget as HTMLButtonElement).style.color = "#f87171";
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLButtonElement).style.backgroundColor = "transparent";
                    (e.currentTarget as HTMLButtonElement).style.color = "var(--muted)";
                  }}
                >
                  <LogOut size={14} />
                  Sign out
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}
