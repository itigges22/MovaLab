'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { User, Mail, Building2, Briefcase, Save, Lock, AlertCircle, Loader2 } from 'lucide-react';
import { updatePassword } from '@/lib/auth';

interface ClientProfile {
  id: string;
  name: string;
  email: string;
  is_client: boolean;
  client_account_id: string | null;
  client_contact_name: string | null;
  client_company_position: string | null;
  created_at: string;
  updated_at: string;
}

export default function ClientProfilePage() {
  const [profile, setProfile] = useState<ClientProfile | null>(null);
  const [accountName, setAccountName] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Profile edit state
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    client_company_position: '',
  });

  // Password state
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [passwordData, setPasswordData] = useState({
    newPassword: '',
    confirmPassword: '',
  });
  const [passwordError, setPasswordError] = useState('');
  const [passwordSuccess, setPasswordSuccess] = useState(false);
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);

  // Load profile data
  useEffect(() => {
    async function loadProfile() {
      try {
        const res = await fetch('/api/profile');
        if (!res.ok) {
          throw new Error('Failed to load profile');
        }
        const data = await res.json();
        const p = data.profile as ClientProfile;
        setProfile(p);
        setFormData({
          name: p.name || '',
          client_company_position: p.client_company_position || '',
        });

        // Load account name if we have a client_account_id
        if (p.client_account_id) {
          const accountRes = await fetch(`/api/client/portal/projects`);
          if (accountRes.ok) {
            const accountData = await accountRes.json();
            // The projects endpoint returns projects with account_id;
            // We get the account name from the layout, but we can also
            // try fetching it. For simplicity, we show it from the profile.
          }
        }
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Failed to load profile');
      } finally {
        setLoading(false);
      }
    }
    loadProfile();
  }, []);

  // Load account name from DOM (it's in the sidebar already)
  // Instead, let's fetch it separately
  useEffect(() => {
    if (!profile?.client_account_id) return;

    async function loadAccountName() {
      try {
        // The client portal projects endpoint can give us project data with account info
        // But simpler: just read the sidebar's account name passed via layout
        // We'll make a lightweight call to get account info
        const res = await fetch('/api/client/portal/projects');
        if (res.ok) {
          const data = await res.json();
          if (data.accountName) {
            setAccountName(data.accountName);
          }
        }
      } catch {
        // Non-critical - account name is nice to have
      }
    }
    loadAccountName();
  }, [profile?.client_account_id]);

  const handleSave = async () => {
    try {
      setIsSaving(true);
      setSaveError('');
      setSaveSuccess(false);

      const res = await fetch('/api/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          name: formData.name.trim(),
          client_company_position: formData.client_company_position.trim() || null,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: 'Failed to update profile' }));
        throw new Error(data.error || 'Failed to update profile');
      }

      const data = await res.json();
      setProfile(data.profile);
      setSaveSuccess(true);
      setIsEditing(false);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err: unknown) {
      setSaveError(err instanceof Error ? err.message : 'Failed to save profile');
    } finally {
      setIsSaving(false);
    }
  };

  const handlePasswordChange = async () => {
    try {
      setIsUpdatingPassword(true);
      setPasswordError('');
      setPasswordSuccess(false);

      if (passwordData.newPassword !== passwordData.confirmPassword) {
        setPasswordError('Passwords do not match');
        return;
      }

      if (passwordData.newPassword.length < 6) {
        setPasswordError('Password must be at least 6 characters');
        return;
      }

      await updatePassword(passwordData.newPassword);

      setPasswordSuccess(true);
      setPasswordData({ newPassword: '', confirmPassword: '' });
      setIsChangingPassword(false);
      setTimeout(() => setPasswordSuccess(false), 3000);
    } catch (err: unknown) {
      setPasswordError(err instanceof Error ? err.message : 'Failed to change password');
    } finally {
      setIsUpdatingPassword(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="rounded-full bg-destructive/10 p-4 mb-4">
          <AlertCircle className="h-8 w-8 text-destructive" />
        </div>
        <h2 className="text-xl font-semibold mb-2">Unable to load profile</h2>
        <p className="text-muted-foreground mb-6">{error}</p>
        <Button variant="outline" onClick={() => window.location.reload()}>
          Try again
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Profile</h1>
        <p className="text-muted-foreground mt-1">
          Manage your account information.
        </p>
      </div>

      {/* Success/Error banners */}
      {saveSuccess && (
        <div className="rounded-md border border-emerald-500/30 bg-emerald-500/10 p-4">
          <p className="text-sm font-medium text-emerald-400">
            Profile updated successfully.
          </p>
        </div>
      )}
      {saveError && (
        <div className="rounded-md border border-destructive/30 bg-destructive/10 p-4">
          <p className="text-sm font-medium text-destructive">{saveError}</p>
        </div>
      )}

      {/* Profile Information Card */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <div>
            <CardTitle>Personal Information</CardTitle>
            <CardDescription>Your name, email, and company details.</CardDescription>
          </div>
          {!isEditing && (
            <Button variant="outline" size="sm" onClick={() => setIsEditing(true)}>
              Edit
            </Button>
          )}
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Name */}
          <div className="space-y-2">
            <Label htmlFor="name" className="flex items-center gap-2">
              <User className="h-4 w-4 text-muted-foreground" />
              Name
            </Label>
            {isEditing ? (
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
                placeholder="Your full name"
              />
            ) : (
              <p className="text-sm py-2 px-3 rounded-md bg-muted/50">{profile.name || 'Not set'}</p>
            )}
          </div>

          {/* Email (read-only) */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <Mail className="h-4 w-4 text-muted-foreground" />
              Email
            </Label>
            <p className="text-sm py-2 px-3 rounded-md bg-muted/50">{profile.email}</p>
            <p className="text-xs text-muted-foreground">Email address cannot be changed.</p>
          </div>

          {/* Account (read-only) */}
          {accountName && (
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Building2 className="h-4 w-4 text-muted-foreground" />
                Account
              </Label>
              <p className="text-sm py-2 px-3 rounded-md bg-muted/50">{accountName}</p>
            </div>
          )}

          {/* Company Position */}
          <div className="space-y-2">
            <Label htmlFor="position" className="flex items-center gap-2">
              <Briefcase className="h-4 w-4 text-muted-foreground" />
              Company Position
            </Label>
            {isEditing ? (
              <Input
                id="position"
                value={formData.client_company_position}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, client_company_position: e.target.value }))
                }
                placeholder="e.g. Marketing Director"
              />
            ) : (
              <p className="text-sm py-2 px-3 rounded-md bg-muted/50">
                {profile.client_company_position || 'Not set'}
              </p>
            )}
          </div>

          {/* Save / Cancel buttons */}
          {isEditing && (
            <div className="flex justify-end gap-2 pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setIsEditing(false);
                  setSaveError('');
                  setFormData({
                    name: profile.name || '',
                    client_company_position: profile.client_company_position || '',
                  });
                }}
                disabled={isSaving}
              >
                Cancel
              </Button>
              <Button size="sm" onClick={handleSave} disabled={isSaving}>
                {isSaving ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4 mr-2" />
                    Save Changes
                  </>
                )}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Change Password Card */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Lock className="h-5 w-5" />
              Password
            </CardTitle>
            <CardDescription>Update your account password.</CardDescription>
          </div>
          {!isChangingPassword && (
            <Button variant="outline" size="sm" onClick={() => setIsChangingPassword(true)}>
              Change Password
            </Button>
          )}
        </CardHeader>

        {passwordSuccess && (
          <div className="mx-6 mb-2 rounded-md border border-emerald-500/30 bg-emerald-500/10 p-4">
            <p className="text-sm font-medium text-emerald-400">
              Password updated successfully.
            </p>
          </div>
        )}
        {passwordError && (
          <div className="mx-6 mb-2 rounded-md border border-destructive/30 bg-destructive/10 p-4">
            <p className="text-sm font-medium text-destructive">{passwordError}</p>
          </div>
        )}

        {isChangingPassword && (
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="newPassword">New Password</Label>
                <Input
                  id="newPassword"
                  type="password"
                  value={passwordData.newPassword}
                  onChange={(e) =>
                    setPasswordData((prev) => ({ ...prev, newPassword: e.target.value }))
                  }
                  placeholder="Enter new password"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirm Password</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  value={passwordData.confirmPassword}
                  onChange={(e) =>
                    setPasswordData((prev) => ({ ...prev, confirmPassword: e.target.value }))
                  }
                  placeholder="Confirm new password"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setIsChangingPassword(false);
                  setPasswordError('');
                  setPasswordData({ newPassword: '', confirmPassword: '' });
                }}
                disabled={isUpdatingPassword}
              >
                Cancel
              </Button>
              <Button size="sm" onClick={handlePasswordChange} disabled={isUpdatingPassword}>
                {isUpdatingPassword ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Updating...
                  </>
                ) : (
                  <>
                    <Lock className="h-4 w-4 mr-2" />
                    Update Password
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        )}
      </Card>
    </div>
  );
}
