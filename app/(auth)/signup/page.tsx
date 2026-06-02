'use client'

import { useActionState } from 'react'
import Link from 'next/link'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { signUp } from '@/lib/actions/auth'

export default function SignupPage() {
  const [state, action, pending] = useActionState(signUp, null)

  if (state === null && typeof window !== 'undefined') {
    const params = new URLSearchParams(window.location.search)
    if (params.get('message') === 'check-email') {
      return (
        <Card className="w-full max-w-sm">
          <CardHeader>
            <CardTitle className="text-xl">Check your email</CardTitle>
            <CardDescription>
              We sent a confirmation link to your inbox. Click it to activate your account.
            </CardDescription>
          </CardHeader>
          <CardFooter className="justify-center">
            <Link href="/login" className="text-sm font-medium text-primary hover:underline">
              Back to sign in
            </Link>
          </CardFooter>
        </Card>
      )
    }
  }

  return (
    <Card className="w-full max-w-sm">
      <CardHeader className="space-y-1">
        <CardTitle className="text-xl">Create account</CardTitle>
        <CardDescription>Enter your email and choose a password</CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        {state?.error && (
          <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {state.error}
          </p>
        )}

        <form action={action} className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="email">Email</Label>
            <Input id="email" name="email" type="email" placeholder="you@example.com" required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              name="password"
              type="password"
              placeholder="Min. 8 characters"
              required
            />
          </div>
          <Button type="submit" className="w-full" disabled={pending}>
            {pending ? 'Creating account…' : 'Create account'}
          </Button>
        </form>
      </CardContent>

      <CardFooter className="justify-center">
        <p className="text-sm text-muted-foreground">
          Already have an account?{' '}
          <Link href="/login" className="font-medium text-primary hover:underline">
            Sign in
          </Link>
        </p>
      </CardFooter>
    </Card>
  )
}
