"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/utils/supabase/client"

export default function AuthConfirmPage() {
  const router = useRouter()

  useEffect(() => {
    const supabase = createClient()

    // Parse the hash fragment from the URL
    const hash = window.location.hash
    if (!hash) {
      router.replace("/login")
      return
    }

    const params = new URLSearchParams(hash.substring(1))
    const accessToken  = params.get("access_token")
    const refreshToken = params.get("refresh_token")
    const type         = params.get("type")

    if (!accessToken || !refreshToken) {
      router.replace("/login?error=Invalid+invite+link")
      return
    }

    // Set the session from the invite tokens
    supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken })
      .then(({ error }) => {
        if (error) {
          router.replace("/login?error=Could+not+validate+invite+link")
          return
        }
        // Invite or recovery → go to reset password
        if (type === "invite" || type === "recovery") {
          router.replace("/reset-password")
        } else {
          router.replace("/")
        }
      })
  }, [router])

  return (
    <div style={{
      minHeight: "100vh",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      fontFamily: "sans-serif",
      color: "#6b7280",
      fontSize: "0.875rem",
    }}>
      Verifying your invite link...
    </div>
  )
}