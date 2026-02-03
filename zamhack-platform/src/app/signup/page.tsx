"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import * as z from "zod"

import { signup } from "./actions"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { ArrowLeft } from "lucide-react" // ADDED: Icon for the back button

// --- FIX: Define the shape first (without refinement) ---
const baseSchemaShape = z.object({
  firstName: z.string().min(2, "First name required"),
  lastName: z.string().min(2, "Last name required"),
  email: z.string().email("Invalid email"),
  password: z.string().min(6, "Password must be at least 6 chars"),
  confirmPassword: z.string().min(6, "Confirm password required"),
})

// --- Extend first, THEN refine ---
const studentSchema = baseSchemaShape.extend({
  role: z.literal("student"),
  university: z.string().min(2, "University name required"),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
})

const companySchema = baseSchemaShape.extend({
  role: z.literal("company_admin"),
  company: z.string().min(2, "Company name required"),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
})

export default function SignupPage() {
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const router = useRouter()

  // Student Form
  const studentForm = useForm<z.infer<typeof studentSchema>>({
    resolver: zodResolver(studentSchema),
    defaultValues: { role: "student" },
  })

  // Company Form
  const companyForm = useForm<z.infer<typeof companySchema>>({
    resolver: zodResolver(companySchema),
    defaultValues: { role: "company_admin" },
  })

  // Unified Submit Handler
  const onSubmit = async (data: any) => {
    setError(null)
    setIsSubmitting(true)

    try {
      const formData = new FormData()
      Object.entries(data).forEach(([key, value]) => {
        formData.append(key, value as string)
      })

      const result = await signup(formData)

      if (result?.error) {
        setError(result.error)
      } else if (result?.success) {
        setSuccess(true)
        // Optional: Redirect immediately or show success message
        // router.push("/login") 
      }
    } catch (err) {
      setError("Something went wrong.")
    } finally {
      setIsSubmitting(false)
    }
  }

  if (success) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-50 p-4 relative">
        {/* ADDED: "Go back" Button for success screen */}
        <div className="absolute top-4 left-4 md:top-8 md:left-8">
          <Button variant="ghost" asChild className="gap-2">
            <Link href="https://zamhack.com/">
              <ArrowLeft className="h-4 w-4" />
              Go back
            </Link>
          </Button>
        </div>

        <Card className="w-full max-w-md text-center">
          <CardHeader>
            <CardTitle>Check your email</CardTitle>
            <CardDescription>We've sent you a confirmation link.</CardDescription>
          </CardHeader>
          <CardFooter className="justify-center">
            <Link href="/login"><Button>Back to Login</Button></Link>
          </CardFooter>
        </Card>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 p-4 dark:bg-black relative">
      {/* ADDED: "Go back" Button for main form */}
      <div className="absolute top-4 left-4 md:top-8 md:left-8">
        <Button variant="ghost" asChild className="gap-2">
          <Link href="https://zamhack.com/">
            <ArrowLeft className="h-4 w-4" />
            Go back
          </Link>
        </Button>
      </div>

      <Card className="w-full max-w-lg">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-bold">Create an account</CardTitle>
          <CardDescription>Choose your account type to get started</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="student" className="w-full">
            <TabsList className="grid w-full grid-cols-2 mb-4">
              <TabsTrigger value="student">Student</TabsTrigger>
              <TabsTrigger value="company">Company</TabsTrigger>
            </TabsList>

            {error && (
              <Alert variant="destructive" className="mb-4">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {/* STUDENT FORM */}
            <TabsContent value="student">
              <form onSubmit={studentForm.handleSubmit(onSubmit)} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>First Name</Label>
                    <Input {...studentForm.register("firstName")} disabled={isSubmitting} />
                    {studentForm.formState.errors.firstName && <p className="text-xs text-red-500">{studentForm.formState.errors.firstName.message}</p>}
                  </div>
                  <div className="space-y-2">
                    <Label>Last Name</Label>
                    <Input {...studentForm.register("lastName")} disabled={isSubmitting} />
                    {studentForm.formState.errors.lastName && <p className="text-xs text-red-500">{studentForm.formState.errors.lastName.message}</p>}
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>University</Label>
                  <Input {...studentForm.register("university")} placeholder="University/College Name" disabled={isSubmitting} />
                  {studentForm.formState.errors.university && <p className="text-xs text-red-500">{studentForm.formState.errors.university.message}</p>}
                </div>
                <div className="space-y-2">
                  <Label>Email</Label>
                  <Input {...studentForm.register("email")} type="email" disabled={isSubmitting} />
                  {studentForm.formState.errors.email && <p className="text-xs text-red-500">{studentForm.formState.errors.email.message}</p>}
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Password</Label>
                    <Input {...studentForm.register("password")} type="password" disabled={isSubmitting} />
                    {studentForm.formState.errors.password && <p className="text-xs text-red-500">{studentForm.formState.errors.password.message}</p>}
                  </div>
                  <div className="space-y-2">
                    <Label>Confirm Password</Label>
                    <Input {...studentForm.register("confirmPassword")} type="password" disabled={isSubmitting} />
                    {studentForm.formState.errors.confirmPassword && <p className="text-xs text-red-500">{studentForm.formState.errors.confirmPassword.message}</p>}
                  </div>
                </div>
                <Button type="submit" className="w-full" disabled={isSubmitting}>
                  {isSubmitting ? "Creating account..." : "Sign Up as Student"}
                </Button>
              </form>
            </TabsContent>

            {/* COMPANY FORM */}
            <TabsContent value="company">
              <form onSubmit={companyForm.handleSubmit(onSubmit)} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>First Name</Label>
                    <Input {...companyForm.register("firstName")} disabled={isSubmitting} />
                    {companyForm.formState.errors.firstName && <p className="text-xs text-red-500">{companyForm.formState.errors.firstName.message}</p>}
                  </div>
                  <div className="space-y-2">
                    <Label>Last Name</Label>
                    <Input {...companyForm.register("lastName")} disabled={isSubmitting} />
                    {companyForm.formState.errors.lastName && <p className="text-xs text-red-500">{companyForm.formState.errors.lastName.message}</p>}
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Company Name</Label>
                  <Input {...companyForm.register("company")} placeholder="Your Company Name" disabled={isSubmitting} />
                  {companyForm.formState.errors.company && <p className="text-xs text-red-500">{companyForm.formState.errors.company.message}</p>}
                </div>
                <div className="space-y-2">
                  <Label>Work Email</Label>
                  <Input {...companyForm.register("email")} type="email" disabled={isSubmitting} />
                  {companyForm.formState.errors.email && <p className="text-xs text-red-500">{companyForm.formState.errors.email.message}</p>}
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Password</Label>
                    <Input {...companyForm.register("password")} type="password" disabled={isSubmitting} />
                    {companyForm.formState.errors.password && <p className="text-xs text-red-500">{companyForm.formState.errors.password.message}</p>}
                  </div>
                  <div className="space-y-2">
                    <Label>Confirm Password</Label>
                    <Input {...companyForm.register("confirmPassword")} type="password" disabled={isSubmitting} />
                    {companyForm.formState.errors.confirmPassword && <p className="text-xs text-red-500">{companyForm.formState.errors.confirmPassword.message}</p>}
                  </div>
                </div>
                <Button type="submit" className="w-full" disabled={isSubmitting}>
                  {isSubmitting ? "Creating account..." : "Sign Up as Company"}
                </Button>
              </form>
            </TabsContent>
          </Tabs>
        </CardContent>
        <CardFooter className="justify-center">
          <div className="text-sm text-muted-foreground">
            Already have an account?{" "}
            <Link href="/login" className="text-primary hover:underline">
              Log in
            </Link>
          </div>
        </CardFooter>
      </Card>
    </div>
  )
}