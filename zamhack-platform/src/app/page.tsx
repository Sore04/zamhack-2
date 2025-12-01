import { createClient } from "@/utils/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default async function Home() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // 1. Auto-redirect logged-in users to the dashboard
  if (user) {
    redirect("/dashboard");
  }

  // 2. Show a simple Landing Page for guests
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-zinc-50 p-4">
      <div className="max-w-md text-center space-y-6">
        <h1 className="text-4xl font-bold tracking-tight">
          Welcome to ZamHack
        </h1>
        <p className="text-lg text-zinc-600">
          The ultimate platform for student hackathons and challenges.
        </p>
        <div className="flex gap-4 justify-center">
          <Link href="/login">
            <Button size="lg">Log In</Button>
          </Link>
          <Link href="/signup">
            <Button variant="outline" size="lg">
              Sign Up
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}