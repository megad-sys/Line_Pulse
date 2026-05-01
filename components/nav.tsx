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
    <nav className="bg-gray-900 text-white h-14 flex items-center px-6 gap-8 shrink-0">
      <div className="flex items-center gap-2 font-bold text-lg tracking-tight">
        <Factory size={20} className="text-amber-400" />
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
                  ? "bg-white/10 text-white"
                  : "text-gray-400 hover:text-white hover:bg-white/5"
              }`}
            >
              {link.label}
            </Link>
          );
        })}
      </div>

      <div className="flex items-center gap-3">
        {/* Demo toggle */}
        <button
          onClick={toggle}
          className={`text-xs font-semibold px-2.5 py-1 rounded-full border transition-colors ${
            isDemo
              ? "text-amber-400 bg-amber-400/10 border-amber-400/20 hover:bg-amber-400/20"
              : "text-gray-400 bg-transparent border-gray-600 hover:border-gray-400 hover:text-gray-200"
          }`}
        >
          {isDemo ? "Demo Mode" : "Live Data"}
        </button>

        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-300">{userName}</span>
          <div
            className="w-8 h-8 rounded-full bg-indigo-500 flex items-center justify-center text-xs font-bold shrink-0"
            title={userName}
          >
            {userInitials}
          </div>
        </div>
      </div>
    </nav>
  );
}
