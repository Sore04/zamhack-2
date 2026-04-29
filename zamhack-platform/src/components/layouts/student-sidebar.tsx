"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Suspense } from "react"
import {
  LayoutDashboard, Search, Briefcase, Users,
  User, Settings, Zap, MessageCircle, HelpCircle, BookOpen, CreditCard,
} from "lucide-react"
import { LogoutButton } from "@/components/logout-button"
import { UnreadMessagesBadge } from "@/components/layouts/unread-badge"

const studentNavItems = [
  { href: "/dashboard",     label: "Dashboard",         icon: LayoutDashboard },
  { href: "/challenges",    label: "Browse Challenges", icon: Search },
  { href: "/my-challenges",       label: "My Challenges",     icon: Briefcase },
  { href: "/dashboard/finances", label: "Finances",          icon: CreditCard },
  { href: "/team",               label: "My Team",           icon: Users,          comingSoon: true },
  { href: "/messages",      label: "Messages",          icon: MessageCircle,  showBadge: true },
  { href: "/profile",       label: "Profile",           icon: User },
  { href: "/help",           label: "Help & FAQ",        icon: BookOpen },
  { href: "/support",       label: "Support",           icon: HelpCircle },
  { href: "/settings",      label: "Settings",          icon: Settings },
]

export const StudentSidebar = () => {
  const pathname = usePathname()

  return (
    <div className="sidebar-root">
      <div className="sidebar-brand">
        <div className="sidebar-brand-icon">
          <Zap size={16} strokeWidth={2.5} color="white" />
        </div>
        <span className="sidebar-brand-name">ZamHack</span>
      </div>

      <nav className="sidebar-nav">
        <p className="sidebar-section-label">Menu</p>
        {studentNavItems.map((item) => {
          const Icon = item.icon
          const isActive = pathname === item.href || pathname.startsWith(item.href + "?")

          if (item.comingSoon) {
            return (
              <span
                key={item.href}
                className="sidebar-link"
                style={{ opacity: 0.5, cursor: "not-allowed", pointerEvents: "none" }}
              >
                <span className="sidebar-link-icon">
                  <Icon size={16} />
                </span>
                {item.label}
                <span style={{
                  marginLeft: "auto",
                  fontSize: "10px",
                  fontWeight: 600,
                  background: "rgba(245,158,11,0.15)",
                  color: "#d97706",
                  borderRadius: "4px",
                  padding: "1px 5px",
                  lineHeight: 1.4,
                  whiteSpace: "nowrap",
                }}>
                  Soon
                </span>
              </span>
            )
          }

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`sidebar-link ${isActive ? "active" : ""}`}
            >
              <span className="sidebar-link-icon">
                <Icon size={16} />
              </span>
              {item.label}
              {item.showBadge && (
                <Suspense fallback={null}>
                  <UnreadMessagesBadge />
                </Suspense>
              )}
            </Link>
          )
        })}
      </nav>

      <div className="sidebar-footer">
        <LogoutButton />
      </div>
    </div>
  )
}