import { Outlet, Link, useLocation } from "react-router";
import { BookOpen, FileText, Home, Settings, Sparkles } from "lucide-react";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { Toaster } from "./components/ui/sonner";
import { LMStudioSettings } from "./components/LMStudioSettings";

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const navItems = [
  { icon: Home,      label: "Dashboard",       href: "/" },
  { icon: FileText,  label: "Question Papers",  href: "/" },
  { icon: BookOpen,  label: "Source Material",  href: "/" },
  { icon: Settings,  label: "Settings",         href: "/" },
];

export function Layout() {
  const location = useLocation();

  return (
    <div className="flex h-screen fm-bg overflow-hidden">
      {/* Ambient background layer */}
      <div className="pointer-events-none fixed inset-0 z-0" aria-hidden />

      {/* ── Sidebar ── */}
      <aside
        className="relative z-10 w-64 flex flex-col shrink-0"
        style={{
          background: "rgba(25, 36, 41, 0.85)",
          backdropFilter: "blur(16px)",
          borderRight: "1px solid rgba(148,180,156,0.12)",
        }}
      >
        {/* Logo */}
        <div className="h-16 flex items-center px-6 gap-3"
          style={{ borderBottom: "1px solid rgba(148,180,156,0.1)" }}>
          <div className="w-8 h-8 rounded-lg flex items-center justify-center fm-float"
            style={{ background: "linear-gradient(135deg,#527D6F,#94B49C)" }}>
            <Sparkles className="w-4 h-4 text-[#2F3E46]" />
          </div>
          <span className="text-base font-bold tracking-tight text-[#D5E2D6]"
            style={{ fontFamily: "'Playfair Display', serif" }}>
            QPaper Gen
          </span>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-6 space-y-1">
          {navItems.map((item) => {
            const isActive =
              location.pathname === item.href && item.label === "Dashboard";
            return (
              <Link
                key={item.label}
                to={item.href}
                className={cn(
                  "fm-nav-item flex items-center px-3 py-2.5 text-sm font-medium rounded-lg group",
                  isActive ? "fm-nav-active" : "text-[#94B49C]"
                )}
              >
                <item.icon
                  className={cn(
                    "mr-3 h-4 w-4 shrink-0 transition-colors",
                    isActive ? "text-[#D5E2D6]" : "text-[#527D6F] group-hover:text-[#94B49C]"
                  )}
                />
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* User */}
        <div className="p-4" style={{ borderTop: "1px solid rgba(148,180,156,0.1)" }}>
          <div className="flex items-center gap-3">
            <div
              className="h-8 w-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
              style={{ background: "linear-gradient(135deg,#527D6F,#94B49C)", color: "#2F3E46" }}
            >
              JD
            </div>
            <div>
              <p className="text-sm font-medium text-[#D5E2D6]">Jane Doe</p>
              <p className="text-xs text-[#527D6F]">Teacher Account</p>
            </div>
          </div>
        </div>
      </aside>

      {/* ── Main content ── */}
      <main className="relative z-10 flex-1 flex flex-col overflow-hidden">
        {/* Top bar */}
        <div
          className="h-16 flex items-center justify-end px-6 shrink-0"
          style={{
            background: "rgba(25,36,41,0.6)",
            backdropFilter: "blur(12px)",
            borderBottom: "1px solid rgba(148,180,156,0.1)",
          }}
        >
          <LMStudioSettings />
        </div>

        <div className="flex-1 overflow-auto">
          <Outlet />
        </div>
      </main>

      <Toaster />
    </div>
  );
}
