import "./evaluator.css"
import EvaluatorSidebar from "@/components/layouts/evaluator-sidebar"
import { MobileNav } from "@/components/layouts/mobile-nav"
import { Zap } from "lucide-react"

export default function EvaluatorLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="evaluator-portal flex h-screen overflow-hidden">
      <aside className="hidden w-64 flex-shrink-0 md:block">
        <EvaluatorSidebar />
      </aside>

      <div className="flex flex-1 flex-col overflow-hidden">
        <header className="portal-header px-4 md:px-6">
          <div className="flex items-center gap-3">
            <div className="md:hidden">
              <MobileNav title="ZamHack">
                <EvaluatorSidebar />
              </MobileNav>
            </div>
            <div className="flex items-center gap-2 md:hidden">
              <div className="sidebar-brand-icon">
                <Zap size={14} strokeWidth={2.5} color="white" />
              </div>
              <span className="sidebar-brand-name">ZamHack</span>
            </div>
            <span className="hidden text-sm font-medium text-[#9CA3AF] md:block">
              Evaluator Portal
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="portal-header-badge hidden md:inline-flex">
              <span className="portal-header-badge-dot" />
              Evaluator
            </span>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-4 md:p-6">{children}</main>
      </div>
    </div>
  )
}