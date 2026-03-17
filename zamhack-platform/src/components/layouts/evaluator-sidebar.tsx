"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  LayoutDashboard, ClipboardList, History, Settings, Zap,
} from "lucide-react"
import { LogoutButton } from "@/components/logout-button"

const evaluatorNavItems = [
  { href: "/evaluator/dashboard",   label: "Dashboard",    icon: LayoutDashboard },
  { href: "/evaluator/assignments", label: "Assignments",  icon: ClipboardList },
  { href: "/evaluator/history",     label: "Review History", icon: History },
  { href: "/evaluator/settings",    label: "Settings",     icon: Settings },
]

export default function EvaluatorSidebar() {
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
        {evaluatorNavItems.map((item) => {
          const Icon = item.icon
          const isActive =
            pathname === item.href ||
            (item.href !== "/evaluator/dashboard" && pathname.startsWith(item.href))
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