'use client'

import { Button } from "@/components/ui/button"
import { Card, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"

export default function ErrorPage() {
  return (
    <div className="flex h-screen w-full items-center justify-center bg-zinc-50 px-4">
      <Card className="w-full max-w-sm text-center">
        <CardHeader>
          <CardTitle>Something went wrong</CardTitle>
          <p className="text-sm text-zinc-500">Please try again later.</p>
        </CardHeader>
        <CardFooter className="flex justify-center">
          <Button onClick={() => window.location.href = '/login'}>
            Back to Login
          </Button>
        </CardFooter>
      </Card>
    </div>
  )
}