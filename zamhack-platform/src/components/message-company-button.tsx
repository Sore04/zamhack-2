"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { MessageSquare, Loader2 } from "lucide-react"
import { getOrCreateCompanyConversation } from "@/app/(student)/my-challenges/message-company-action"
import { toast } from "sonner"


interface MessageCompanyButtonProps {
  challengeId: string
}

export function MessageCompanyButton({ challengeId }: MessageCompanyButtonProps) {
  const [isLoading, setIsLoading] = useState(false)
  const router = useRouter()

  const handleClick = async () => {
    setIsLoading(true)
    const result = await getOrCreateCompanyConversation(challengeId)
    if (result.error) {
      toast.error(result.error)
      setIsLoading(false)
      return
    }
    router.push(`/messages?conversation=${result.conversationId}`)
  }

  return (
    <Button variant="outline" onClick={handleClick} disabled={isLoading}>
      {isLoading ? (
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
      ) : (
        <MessageSquare className="mr-2 h-4 w-4" />
      )}
      Message Company
    </Button>
  )
}