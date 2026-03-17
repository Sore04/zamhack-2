"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"

export function AuthRedirectHandler() {
  const router = useRouter()

  useEffect(() => {
    const hash = window.location.hash
    if (!hash) return

    const params = new URLSearchParams(hash.substring(1))
    const type = params.get("type")
    const accessToken = params.get("access_token")

    // If this is an invite or recovery link, forward to the confirm page
    if (accessToken && (type === "invite" || type === "recovery")) {
      router.replace(`/auth/confirm${hash}`)
    }
  }, [router])

  return null
}