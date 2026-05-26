import { useEffect, useState } from "react";
import { Outlet, Link, useLocation } from "react-router";
import { BookOpen, FileText, Home, Menu, Settings, Sparkles, X } from "lucide-react";
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
  { icon: Sparkles,  label: "Paper Models",     href: "/models"   },
  { icon: Settings,  label: "Settings",         href: "/settings" },
];

const PROFILE_KEY = "qpg_profile";

export function Layout() {
  const location = useLocation();
  const [profile, setProfile] = useState({ name: "Jane Doe", role: "Teacher Account" });
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    try {
      const stored = JSON.parse(localStorage.getItem(PROFILE_KEY) || "{}");
      setProfile({
        name: stored.name || "Jane Doe",
        role: stored.role || "Teacher Account",
      });
    } catch { /* use defaults */ }
    setSidebarOpen(false); // Close sidebar on route change
  }, [location.pathname]);

  const initials = profile.name
    .split(" ")
    .map(w => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <div className="flex h-screen fm-bg overflow-hidden">
      <div className="pointer-events-none fixed inset-0 z-0" aria-hidden />

      {/* ── Mobile Sidebar Backdrop ── */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden transition-opacity duration-300"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* ── Sidebar ── */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 w-64 flex flex-col shrink-0 transition-transform duration-300 ease-in-out lg:static lg:translate-x-0 lg:z-10",
          sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        )}
        style={{
          background: "rgba(25, 36, 41, 0.95)",
          backdropFilter: "blur(16px)",
          borderRight: "1px solid rgba(148,180,156,0.12)",
        }}
      >
        {/* Logo */}
        <div className="h-16 flex items-center justify-between px-6 gap-3 shrink-0"
          style={{ borderBottom: "1px solid rgba(148,180,156,0.1)" }}>
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center fm-float"
              style={{ background: "linear-gradient(135deg,#527D6F,#94B49C)" }}>
              <Sparkles className="w-4 h-4 text-[#2F3E46]" />
            </div>
            <span className="text-base font-bold tracking-tight text-[#D5E2D6]"
              style={{ fontFamily: "'Playfair Display', serif" }}>
              QPaper Gen
            </span>
          </div>
          <button
            onClick={() => setSidebarOpen(false)}
            className="lg:hidden p-1.5 rounded-lg text-[#94B49C] hover:text-[#D5E2D6] hover:bg-[rgba(82,125,111,0.12)] transition-colors"
            aria-label="Close sidebar"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-6 space-y-1 overflow-y-auto">
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
          className="p-4 flex items-center gap-3 transition-colors hover:bg-[rgba(82,125,111,0.08)] shrink-0"
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
      <main className="relative z-10 flex-1 flex flex-col overflow-hidden w-full">
        {/* Top bar — responsive header */}
        <div
          className="h-16 flex items-center justify-between px-4 sm:px-6 shrink-0 z-20"
          style={{
            background: "rgba(25,36,41,0.6)",
            backdropFilter: "blur(12px)",
            borderBottom: "1px solid rgba(148,180,156,0.1)",
          }}
        >
          {/* Mobile hamburger & title */}
          <div className="flex items-center gap-3 lg:hidden">
            <button
              onClick={() => setSidebarOpen(true)}
              className="p-2 rounded-lg text-[#94B49C] hover:text-[#D5E2D6] hover:bg-[rgba(82,125,111,0.12)] transition-colors"
              aria-label="Open menu"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-md flex items-center justify-center"
                style={{ background: "linear-gradient(135deg,#527D6F,#94B49C)" }}>
                <Sparkles className="w-3.5 h-3.5 text-[#2F3E46]" />
              </div>
              <span className="text-sm font-bold text-[#D5E2D6]" style={{ fontFamily: "'Playfair Display', serif" }}>
                QPaper Gen
              </span>
            </div>
          </div>

          <div className="hidden lg:block" />

          {/* User initials bubble on mobile (since sidebar is drawer), clean/empty on desktop */}
          <Link to="/settings"
            className="flex lg:hidden items-center justify-center h-8 w-8 rounded-full text-xs font-bold shrink-0 transition-all hover:scale-105 active:scale-95 ml-auto"
            style={{ background: "linear-gradient(135deg,#527D6F,#94B49C)", color: "#2F3E46" }}
            title="Settings"
          >
            {initials}
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
