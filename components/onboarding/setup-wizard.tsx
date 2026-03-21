'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Shield, CheckCircle, User, ArrowRight, KeyRound, Loader2 } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

type Step = 'welcome' | 'verify' | 'create' | 'success';

export function SetupWizard() {
  const router = useRouter();
  const [step, setStep] = useState<Step>('welcome');
  const [loading, setLoading] = useState(false);

  // Step 2 state
  const [token, setToken] = useState('');
  const [tokenError, setTokenError] = useState('');

  // Step 3 state
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  // Step 1 -> Step 2: Generate token and move to verify step
  async function handleBeginSetup() {
    setLoading(true);
    try {
      await fetch('/api/onboarding/setup-token');
      // Token is printed to server console — user reads it from there
    } catch {
      // Non-fatal — token may already exist
    }
    setLoading(false);
    setStep('verify');
  }

  // Step 2: Verify token
  async function handleVerifyToken() {
    setTokenError('');
    const trimmed = token.trim();
    if (!trimmed) {
      setTokenError('Please enter the setup token.');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/onboarding/setup-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: trimmed }),
      });
      const data = await res.json();

      if (data.valid) {
        setStep('create');
      } else {
        setTokenError('Invalid or expired token. Check your server console for the latest token.');
        toast.error('Token verification failed');
      }
    } catch {
      setTokenError('Failed to verify token. Please try again.');
      toast.error('Network error during verification');
    } finally {
      setLoading(false);
    }
  }

  // Step 3: Validate form client-side
  function validateForm(): boolean {
    const errors: Record<string, string> = {};

    if (!name.trim()) {
      errors.name = 'Name is required.';
    }

    if (!email.trim()) {
      errors.email = 'Email is required.';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      errors.email = 'Please enter a valid email address.';
    }

    if (!password) {
      errors.password = 'Password is required.';
    } else if (password.length < 8) {
      errors.password = 'Password must be at least 8 characters.';
    }

    if (!confirmPassword) {
      errors.confirmPassword = 'Please confirm your password.';
    } else if (password !== confirmPassword) {
      errors.confirmPassword = 'Passwords do not match.';
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  }

  // Step 3: Create superadmin account
  async function handleCreateAccount() {
    if (!validateForm()) return;

    setLoading(true);
    try {
      const res = await fetch('/api/onboarding/complete-setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: token.trim(),
          email: email.trim(),
          password,
          name: name.trim(),
        }),
      });
      const data = await res.json();

      if (data.success) {
        setStep('success');
      } else {
        toast.error(data.error || 'Failed to create account');
      }
    } catch {
      toast.error('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  // Step indicators
  const steps: { key: Step; label: string }[] = [
    { key: 'welcome', label: 'Welcome' },
    { key: 'verify', label: 'Verify' },
    { key: 'create', label: 'Account' },
    { key: 'success', label: 'Done' },
  ];

  const stepIndex = steps.findIndex((s) => s.key === step);

  return (
    <div className="w-full max-w-lg">
      {/* Step indicator */}
      <div className="flex items-center justify-center gap-2 mb-8">
        {steps.map((s, i) => (
          <div key={s.key} className="flex items-center gap-2">
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors ${
                i <= stepIndex
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-200 text-gray-500'
              }`}
            >
              {i < stepIndex ? (
                <CheckCircle className="h-4 w-4" />
              ) : (
                i + 1
              )}
            </div>
            {i < steps.length - 1 && (
              <div
                className={`w-8 h-0.5 transition-colors ${
                  i < stepIndex ? 'bg-blue-600' : 'bg-gray-200'
                }`}
              />
            )}
          </div>
        ))}
      </div>

      {/* Step 1: Welcome */}
      {step === 'welcome' && (
        <Card>
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-blue-100">
              <Shield className="h-8 w-8 text-blue-600" />
            </div>
            <CardTitle className="text-2xl">Welcome to MovaLab</CardTitle>
            <CardDescription className="text-base">
              This is first-time setup. You will create the initial superadmin account
              to manage your platform.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="rounded-lg bg-blue-50 p-4 text-sm text-blue-800 space-y-2">
              <p className="font-medium">What happens next:</p>
              <ol className="list-decimal list-inside space-y-1 text-blue-700">
                <li>A setup token has been printed to your server console</li>
                <li>You will enter that token to verify you own this server</li>
                <li>Then create your superadmin account</li>
              </ol>
            </div>
          </CardContent>
          <CardFooter className="justify-center">
            <Button size="lg" onClick={handleBeginSetup}>
              Begin Setup
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </CardFooter>
        </Card>
      )}

      {/* Step 2: Verify Token */}
      {step === 'verify' && (
        <Card>
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-amber-100">
              <KeyRound className="h-8 w-8 text-amber-600" />
            </div>
            <CardTitle className="text-2xl">Verify Your Identity</CardTitle>
            <CardDescription className="text-base">
              Check your server terminal or logs for the setup token, then paste it below.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-lg bg-gray-50 border p-4 text-sm text-gray-700">
              <p className="font-medium mb-1">Where to find the token:</p>
              <p>
                Look in the terminal where your Next.js server is running. The token
                was printed between &quot;========&quot; lines when this page loaded.
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="setup-token">Setup Token</Label>
              <Input
                id="setup-token"
                type="text"
                placeholder="Paste your setup token here"
                value={token}
                onChange={(e) => {
                  setToken(e.target.value);
                  setTokenError('');
                }}
                className={tokenError ? 'border-red-500' : ''}
              />
              {tokenError && (
                <p className="text-sm text-red-600">{tokenError}</p>
              )}
            </div>
          </CardContent>
          <CardFooter className="justify-between">
            <Button variant="ghost" onClick={() => setStep('welcome')}>
              Back
            </Button>
            <Button onClick={handleVerifyToken} disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Verifying...
                </>
              ) : (
                <>
                  Verify
                  <ArrowRight className="ml-2 h-4 w-4" />
                </>
              )}
            </Button>
          </CardFooter>
        </Card>
      )}

      {/* Step 3: Create Account */}
      {step === 'create' && (
        <Card>
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
              <User className="h-8 w-8 text-green-600" />
            </div>
            <CardTitle className="text-2xl">Create Superadmin Account</CardTitle>
            <CardDescription className="text-base">
              This account will have full administrative access to your MovaLab instance.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="admin-name">Full Name</Label>
              <Input
                id="admin-name"
                type="text"
                placeholder="Jane Smith"
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  setFormErrors((prev) => ({ ...prev, name: '' }));
                }}
                className={formErrors.name ? 'border-red-500' : ''}
              />
              {formErrors.name && (
                <p className="text-sm text-red-600">{formErrors.name}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="admin-email">Email Address</Label>
              <Input
                id="admin-email"
                type="email"
                placeholder="admin@yourcompany.com"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  setFormErrors((prev) => ({ ...prev, email: '' }));
                }}
                className={formErrors.email ? 'border-red-500' : ''}
              />
              {formErrors.email && (
                <p className="text-sm text-red-600">{formErrors.email}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="admin-password">Password</Label>
              <Input
                id="admin-password"
                type="password"
                placeholder="Minimum 8 characters"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setFormErrors((prev) => ({ ...prev, password: '' }));
                }}
                className={formErrors.password ? 'border-red-500' : ''}
              />
              {formErrors.password && (
                <p className="text-sm text-red-600">{formErrors.password}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="admin-confirm-password">Confirm Password</Label>
              <Input
                id="admin-confirm-password"
                type="password"
                placeholder="Re-enter your password"
                value={confirmPassword}
                onChange={(e) => {
                  setConfirmPassword(e.target.value);
                  setFormErrors((prev) => ({ ...prev, confirmPassword: '' }));
                }}
                className={formErrors.confirmPassword ? 'border-red-500' : ''}
              />
              {formErrors.confirmPassword && (
                <p className="text-sm text-red-600">{formErrors.confirmPassword}</p>
              )}
            </div>
          </CardContent>
          <CardFooter className="justify-between">
            <Button variant="ghost" onClick={() => setStep('verify')}>
              Back
            </Button>
            <Button onClick={handleCreateAccount} disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating Account...
                </>
              ) : (
                'Create Superadmin Account'
              )}
            </Button>
          </CardFooter>
        </Card>
      )}

      {/* Step 4: Success */}
      {step === 'success' && (
        <Card>
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
              <CheckCircle className="h-8 w-8 text-green-600" />
            </div>
            <CardTitle className="text-2xl">Setup Complete!</CardTitle>
            <CardDescription className="text-base">
              Your superadmin account has been created successfully.
              You can now log in and start configuring MovaLab.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="rounded-lg bg-green-50 border border-green-200 p-4 text-sm text-green-800">
              <p className="font-medium">Account Details:</p>
              <p className="mt-1">
                <span className="text-green-600">Email:</span> {email}
              </p>
              <p>
                <span className="text-green-600">Role:</span> Superadmin
              </p>
            </div>
          </CardContent>
          <CardFooter className="flex-col gap-3">
            <Button
              size="lg"
              className="w-full"
              onClick={() => router.push('/login')}
            >
              Start Tutorial
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              className="w-full"
              onClick={() => router.push('/login')}
            >
              Skip Tutorial
            </Button>
          </CardFooter>
        </Card>
      )}
    </div>
  );
}
