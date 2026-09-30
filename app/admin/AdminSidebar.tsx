"use client";

import React, { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import {
  LayoutDashboard,
  FileText,
  FolderOpen,
  Compass,
  Image as ImageIcon,
  FileCode,
  Users,
  Megaphone,
  DownloadCloud,
  Settings,
  LogOut,
  Menu,
  X,
  ChevronRight,
} from "lucide-react";

const navItems = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard },
  { href: "/admin/posts", label: "Articles", icon: FileText },
  { href: "/admin/categories", label: "Categories", icon: FolderOpen },
  { href: "/admin/menu", label: "Navigation Menu", icon: Compass },
  { href: "/admin/media", label: "Media Library", icon: ImageIcon },
  { href: "/admin/sponsors", label: "Sponsors", icon: Megaphone },
  { href: "/admin/pages", label: "Footer Pages", icon: FileCode },
  { href: "/admin/import", label: "Import Data", icon: DownloadCloud },
  { href: "/admin/settings", label: "Site Settings", icon: Settings },
  { href: "/admin/users", label: "Users & Roles", icon: Users },
];

export default function AdminSidebar({
  user,
}: {
  user: { name: string; email: string; role: string };
}) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  const isActive = (href: string) => {
    if (href === "/admin") return pathname === "/admin";
    return pathname.startsWith(href);
  };

  const handleSignOut = async () => {
    await authClient.signOut();
    window.location.href = "/admin/login";
  };

  return (
    <>
      {/* Mobile hamburger button */}
      <button
        onClick={() => setMobileOpen(true)}
        className="admin-sidebar-toggle"
        aria-label="Open sidebar"
      >
        <Menu className="w-5 h-5" />
      </button>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="admin-sidebar-overlay"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`admin-sidebar ${mobileOpen ? "admin-sidebar--open" : ""}`}
      >
        {/* Logo */}
        <div className="admin-sidebar__logo">
          <Link href="/admin" className="flex items-center gap-3">
            <Image
              src="/logo.png"
              width={140}
              height={40}
              alt="KTM Post"
              className="h-8 w-auto object-contain brightness-0 invert"
              priority
            />
          </Link>
          <button
            onClick={() => setMobileOpen(false)}
            className="admin-sidebar__close"
            aria-label="Close sidebar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation */}
        <nav className="admin-sidebar__nav">
          <ul>
            {navItems.map((item) => {
              const Icon = item.icon;
              const active = isActive(item.href);
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={() => setMobileOpen(false)}
                    className={`admin-sidebar__link ${
                      active ? "admin-sidebar__link--active" : ""
                    }`}
                  >
                    <Icon className="w-[18px] h-[18px]" />
                    <span>{item.label}</span>
                    {active && (
                      <ChevronRight className="w-4 h-4 ml-auto opacity-60" />
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        {/* User footer */}
        <div className="admin-sidebar__footer">
          <div className="admin-sidebar__user">
            <div className="admin-sidebar__avatar">
              {user.name?.charAt(0)?.toUpperCase() || "A"}
            </div>
            <div className="admin-sidebar__user-info">
              <p className="admin-sidebar__user-name">{user.name}</p>
              <p className="admin-sidebar__user-role">{user.role}</p>
            </div>
          </div>
          <button
            onClick={handleSignOut}
            className="admin-sidebar__signout"
            title="Sign Out"
          >
            <LogOut className="w-4 h-4" />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>
    </>
  );
}
