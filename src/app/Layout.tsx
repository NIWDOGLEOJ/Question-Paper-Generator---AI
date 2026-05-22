import { useEffect, useState } from "react";
import { Outlet, Link, useLocation } from "react-router";
import { BookOpen, FileText, Home, Settings, Sparkles } from "lucide-react";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { Toaster } from "./components/ui/sonner";

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const navItems = [
  { icon: Home,      label: "Dashboard",       href: "/"         },
  { icon: FileText,  label: "Question Papers",  href: "/papers"   },
  { icon: BookOpen,  label: "Source Material",  href: "/sources"  },
  { icon: Settings,  label: "Settings",         href: "/settings" },
];

const PROFILE_KEY = "qpg_profile";

export function Layout() {
  const location = useLocation();
  const [profile, setProfile] = useState({ name: "Jane Doe", role: "Teacher Account" });

  useEffect(() => {
    try {
      const stored = JSON.parse(localStorage.getItem(PROFILE_KEY) || "{}");
      setProfile({
        name: stored.name || "Jane Doe",
        role: stored.role || "Teacher Account",
      });
    } catch { /* use defaults */ }
  }, [location.pathname]); // re-read whenever route changes (e.g. after saving settings)

  const initials = profile.name
    .split(" ")
    .map(w => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <div className="flex h-screen fm-bg overflow-hidden">
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
            const isActive = item.href === "/"
              ? location.pathname === "/"
              : location.pathname === item.href || location.pathname.startsWith(item.href + "/");
            return (
              <Link
                key={item.label}
                to={item.href}
                className={cn(
                  "fm-nav-item flex items-center px-3 py-2.5 text-sm font-medium rounded-lg group",
                  isActive ? "fm-nav-active" : "text-[#94B49C]"
                )}
              >
                <item.icon className={cn(
                  "mr-3 h-4 w-4 shrink-0 transition-colors",
                  isActive ? "text-[#D5E2D6]" : "text-[#527D6F] group-hover:text-[#94B49C]"
                )} />
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* User — links to settings */}
        <Link to="/settings"
          className="p-4 flex items-center gap-3 transition-colors hover:bg-[rgba(82,125,111,0.08)]"
          style={{ borderTop: "1px solid rgba(148,180,156,0.1)" }}>
          <div className="h-8 w-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
            style={{ background: "linear-gradient(135deg,#527D6F,#94B49C)", color: "#2F3E46" }}>
            {initials}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium text-[#D5E2D6] truncate">{profile.name}</p>
            <p className="text-xs text-[#527D6F] truncate">{profile.role}</p>
          </div>
        </Link>
      </aside>

      {/* ── Main content ── */}
      <main className="relative z-10 flex-1 flex flex-col overflow-hidden">
        {/* Top bar — clean, no LM Studio button (moved to Settings) */}
        <div
          className="h-16 flex items-center justify-end px-6 shrink-0"
          style={{
            background: "rgba(25,36,41,0.6)",
            backdropFilter: "blur(12px)",
            borderBottom: "1px solid rgba(148,180,156,0.1)",
          }}
        >
          <Link to="/settings"
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium
              text-[#527D6F] hover:text-[#94B49C] hover:bg-[rgba(82,125,111,0.1)] transition-all">
            <Settings className="w-4 h-4" />
            Settings
          </Link>
        </div>

        <div className="flex-1 overflow-auto">
          <Outlet />
        </div>
      </main>

      <Toaster />
    </div>
  );
}
