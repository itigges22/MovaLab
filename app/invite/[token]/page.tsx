'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Mail, User, Briefcase, Building2, Loader2, CheckCircle, AlertCircle, ArrowRight } from 'lucide-react';

interface InvitationDetails {
  email: string;
  name: string;
  roleName: string;
  departmentName: string | null;
  inviterName: string;
}

type PageState = 'loading' | 'form' | 'success' | 'error';

export default function InviteAcceptPage() {
  const params = useParams();
  const router = useRouter();
  const token = params.token as string;

  const [pageState, setPageState] = useState<PageState>('loading');
  const [invitation, setInvitation] = useState<InvitationDetails | null>(null);
  const [errorMessage, setErrorMessage] = useState('');

  // Form state
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  // Load invitation details
  const loadInvitation = useCallback(async () => {
    try {
      const res = await fetch(`/api/invitations/accept/${token}`);
      const data = await res.json();

      if (res.ok && data.invitation) {
        setInvitation(data.invitation);
        setPageState('form');
      } else {
        setErrorMessage(data.error || 'This invitation is no longer valid.');
        setPageState('error');
      }
    } catch {
      setErrorMessage('Failed to load invitation details. Please try again.');
      setPageState('error');
    }
  }, [token]);

  useEffect(() => {
    if (token) {
      loadInvitation();
    }
  }, [token, loadInvitation]);

  function validateForm(): boolean {
    const errors: Record<string, string> = {};

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

  async function handleAcceptInvitation() {
    if (!validateForm()) return;

    setSubmitting(true);
    setFormErrors({});

    try {
      const res = await fetch(`/api/invitations/accept/${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });

      const data = await res.json();

      if (res.ok && data.success) {
        setPageState('success');
      } else {
        setFormErrors({ general: data.error || 'Failed to create account. Please try again.' });
      }
    } catch {
      setFormErrors({ general: 'Network error. Please try again.' });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <div className="w-full max-w-lg">

        {/* Loading State */}
        {pageState === 'loading' && (
          <div className="text-center">
            <Loader2 className="h-8 w-8 animate-spin text-blue-600 mx-auto" />
            <p className="mt-3 text-sm text-gray-600">Loading invitation details...</p>
          </div>
        )}

        {/* Error State */}
        {pageState === 'error' && (
          <Card>
            <CardHeader className="text-center">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-red-100">
                <AlertCircle className="h-8 w-8 text-red-600" />
              </div>
              <CardTitle className="text-2xl">Invalid Invitation</CardTitle>
              <CardDescription className="text-base">
                {errorMessage}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="rounded-lg bg-gray-50 border p-4 text-sm text-gray-600">
                <p>This can happen if:</p>
                <ul className="list-disc list-inside mt-2 space-y-1">
                  <li>The invitation link has expired (7-day limit)</li>
                  <li>The invitation was revoked by an administrator</li>
                  <li>The invitation has already been accepted</li>
                  <li>The link was copied incorrectly</li>
                </ul>
              </div>
            </CardContent>
            <CardFooter className="justify-center">
              <Button onClick={() => router.push('/login')}>
                Return to Login
              </Button>
            </CardFooter>
          </Card>
        )}

        {/* Invitation Form */}
        {pageState === 'form' && invitation && (
          <Card>
            <CardHeader className="text-center">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-blue-100">
                <Mail className="h-8 w-8 text-blue-600" />
              </div>
              <CardTitle className="text-2xl">You&apos;re Invited!</CardTitle>
              <CardDescription className="text-base">
                Create your account to get started with MovaLab.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Invitation Details */}
              <div className="rounded-lg bg-blue-50 border border-blue-200 p-4 space-y-3">
                <div className="flex items-center gap-2 text-sm">
                  <User className="h-4 w-4 text-blue-600 shrink-0" />
                  <span className="text-gray-600">Invited by:</span>
                  <span className="font-medium text-gray-900">{invitation.inviterName}</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Briefcase className="h-4 w-4 text-blue-600 shrink-0" />
                  <span className="text-gray-600">Role:</span>
                  <span className="font-medium text-gray-900">{invitation.roleName}</span>
                </div>
                {invitation.departmentName && (
                  <div className="flex items-center gap-2 text-sm">
                    <Building2 className="h-4 w-4 text-blue-600 shrink-0" />
                    <span className="text-gray-600">Department:</span>
                    <span className="font-medium text-gray-900">{invitation.departmentName}</span>
                  </div>
                )}
              </div>

              {/* Account info (read-only) */}
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Name</Label>
                  <Input value={invitation.name} disabled className="bg-gray-50" />
                </div>
                <div className="space-y-2">
                  <Label>Email</Label>
                  <Input value={invitation.email} disabled className="bg-gray-50" />
                </div>
              </div>

              {/* Password fields */}
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="invite-password">Password</Label>
                  <Input
                    id="invite-password"
                    type="password"
                    placeholder="Minimum 8 characters"
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      setFormErrors((prev) => {
                        const next = { ...prev };
                        delete next.password;
                        delete next.general;
                        return next;
                      });
                    }}
                    className={formErrors.password ? 'border-red-500' : ''}
                  />
                  {formErrors.password && (
                    <p className="text-sm text-red-600">{formErrors.password}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="invite-confirm-password">Confirm Password</Label>
                  <Input
                    id="invite-confirm-password"
                    type="password"
                    placeholder="Re-enter your password"
                    value={confirmPassword}
                    onChange={(e) => {
                      setConfirmPassword(e.target.value);
                      setFormErrors((prev) => {
                        const next = { ...prev };
                        delete next.confirmPassword;
                        delete next.general;
                        return next;
                      });
                    }}
                    className={formErrors.confirmPassword ? 'border-red-500' : ''}
                  />
                  {formErrors.confirmPassword && (
                    <p className="text-sm text-red-600">{formErrors.confirmPassword}</p>
                  )}
                </div>
              </div>

              {/* General error */}
              {formErrors.general && (
                <div className="rounded-lg bg-red-50 border border-red-200 p-3 flex items-start gap-2">
                  <AlertCircle className="h-4 w-4 text-red-600 shrink-0 mt-0.5" />
                  <p className="text-sm text-red-700">{formErrors.general}</p>
                </div>
              )}
            </CardContent>
            <CardFooter>
              <Button
                className="w-full"
                size="lg"
                onClick={handleAcceptInvitation}
                disabled={submitting}
              >
                {submitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Creating Account...
                  </>
                ) : (
                  'Create Account'
                )}
              </Button>
            </CardFooter>
          </Card>
        )}

        {/* Success State */}
        {pageState === 'success' && (
          <Card>
            <CardHeader className="text-center">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
                <CheckCircle className="h-8 w-8 text-green-600" />
              </div>
              <CardTitle className="text-2xl">Account Created!</CardTitle>
              <CardDescription className="text-base">
                Your account has been set up successfully. You can now log in to start using MovaLab.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {invitation && (
                <div className="rounded-lg bg-green-50 border border-green-200 p-4 text-sm text-green-800 space-y-1">
                  <p><span className="text-green-600">Name:</span> {invitation.name}</p>
                  <p><span className="text-green-600">Email:</span> {invitation.email}</p>
                  <p><span className="text-green-600">Role:</span> {invitation.roleName}</p>
                </div>
              )}
            </CardContent>
            <CardFooter>
              <Button
                className="w-full"
                size="lg"
                onClick={() => router.push('/login')}
              >
                Go to Login
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </CardFooter>
          </Card>
        )}

      </div>
    </div>
  );
}
