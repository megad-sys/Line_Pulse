"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Factory } from "lucide-react";
import { useDemoMode } from "@/lib/demo-context";

const links = [
  { href: "/dashboard",                label: "Dashboard",  exact: true },
  { href: "/dashboard/parts/new",      label: "New Batch"              },
  { href: "/dashboard/settings/lines", label: "Lines Setup"            },
];

export default function Nav({
  userName,
  userInitials,
}: {
  userName: string;
  userInitials: string;
}) {
  const pathname = usePathname();
  const { isDemo, toggle } = useDemoMode();

  return (
    <nav
      className="h-14 flex items-center px-6 gap-8 shrink-0 border-b"
      style={{ backgroundColor: "#0f0f0e", borderColor: "#2e2e2b" }}
    >
      <div className="flex items-center gap-2 font-bold text-lg tracking-tight" style={{ color: "#f0ede8" }}>
        <Factory size={20} style={{ color: "#e8ff47" }} />
        <span>FactoryOS</span>
      </div>

      <div className="flex items-center gap-1 flex-1">
        {links.map((link) => {
          const active = link.exact
            ? pathname === link.href
            : pathname.startsWith(link.href);
          return (
            <Link
              key={link.href}
              href={link.href}
              className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
                active
                  ? "text-[#f0ede8] bg-[#222220]"
                  : "text-[#7a7870] hover:text-[#f0ede8] hover:bg-[#222220]"
              }`}
            >
              {link.label}
            </Link>
          );
        })}
      </div>

      <div className="flex items-center gap-3">
        <button
          onClick={toggle}
          className={`text-xs font-semibold px-2.5 py-1 rounded-full border transition-colors ${
            isDemo
              ? "text-[#fbbf24] bg-[#fbbf24]/10 border-[#fbbf24]/20 hover:bg-[#fbbf24]/20"
              : "text-[#7a7870] bg-transparent border-[#2e2e2b] hover:border-[#7a7870] hover:text-[#f0ede8]"
          }`}
        >
          {isDemo ? "Demo Mode" : "Live Data"}
        </button>

        <div className="flex items-center gap-2">
          <span className="text-sm" style={{ color: "#f0ede8" }}>{userName}</span>
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
            style={{ backgroundColor: "#3730a3", color: "#f0ede8" }}
            title={userName}
          >
            {userInitials}
          </div>
        </div>
      </div>
    </nav>
  );
}
