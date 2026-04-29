"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  LayoutDashboard,
  Users,
  Briefcase,
  BarChart3,
  Settings,
  Shield,
  ScrollText,
  MessageSquare,
  BookOpen,
  GraduationCap,
  DollarSign,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { LogoutButton } from "@/components/logout-button"

// Import the dedicated admin CSS
import "@/app/(admin)/admin.css"

const adminNavItems = [
  { href: "/admin/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/admin/users", label: "User Management", icon: Users },
  { href: "/admin/challenges", label: "Challenge Management", icon: Briefcase },
  { href: "/admin/universities", label: "Universities", icon: GraduationCap },
  { href: "/admin/logs", label: "Activity Logs", icon: ScrollText },
  { href: "/admin/analytics", label: "Analytics", icon: BarChart3 },
  { href: "/admin/finances", label: "Finances", icon: DollarSign },
  { href: "/admin/help",    label: "Help & FAQ", icon: BookOpen },
  { href: "/admin/support", label: "Support", icon: MessageSquare },
  { href: "/admin/settings", label: "Platform Settings", icon: Settings },
]

export const AdminSidebar = () => {
  const pathname = usePathname()

  return (
    <div className="admin-sidebar">
      {/* Brand Header */}
      <div className="admin-sidebar-brand">
        <div className="admin-sidebar-brand-icon">
          <Shield />
        </div>
        <div className="admin-sidebar-brand-text">
          <span className="admin-sidebar-brand-title">ZamHack</span>
          <span className="admin-sidebar-brand-subtitle">Admin Portal</span>
        </div>
      </div>

      {/* Navigation */}
      <nav className="admin-sidebar-nav">
        <span className="admin-nav-section-label">Management</span>
        {adminNavItems.map((item) => {
          const Icon = item.icon
          const isActive = pathname === item.href
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn("admin-nav-link", isActive && "active")}
            >
              <Icon />
              {item.label}
            </Link>
          )
        })}
      </nav>

      {/* Footer */}
      <div className="admin-sidebar-footer">
        <LogoutButton />
      </div>
    </div>
  )
}