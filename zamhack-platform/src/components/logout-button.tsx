"use client"

import { useState } from "react"
import { LogOut } from "lucide-react"
import { Button } from "@/components/ui/button"
// FIX: Import 'signOut' instead of 'logout'
import { signOut } from "@/app/logout/actions"

export const LogoutButton = () => {
  const [isLoading, setIsLoading] = useState(false)

  const handleLogout = async () => {
    setIsLoading(true)
    try {
      // FIX: Call 'signOut' here
      await signOut()
    } catch (error) {
      console.error("Logout failed", error)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Button
      variant="ghost"
      className="w-full justify-start gap-2 text-muted-foreground hover:text-foreground"
      onClick={handleLogout}
      disabled={isLoading}
    >
      <LogOut className="h-4 w-4" />
      <span>{isLoading ? "Logging out..." : "Log out"}</span>
    </Button>
  )
}