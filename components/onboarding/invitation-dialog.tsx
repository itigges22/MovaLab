'use client';

import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { Loader2, Send } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface Role {
  id: string;
  name: string;
  department_id: string | null;
}

interface Department {
  id: string;
  name: string;
}

interface InvitationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onInvited?: () => void;
}

export function InvitationDialog({ open, onOpenChange, onInvited }: InvitationDialogProps) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [roleId, setRoleId] = useState('');
  const [departmentId, setDepartmentId] = useState('');
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  const [roles, setRoles] = useState<Role[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loadingData, setLoadingData] = useState(false);

  // Fetch roles and departments when dialog opens
  useEffect(() => {
    if (!open) return;

    async function fetchData() {
      setLoadingData(true);
      try {
        const [rolesRes, deptsRes] = await Promise.all([
          fetch('/api/roles', { credentials: 'include' }),
          fetch('/api/departments', { credentials: 'include' }),
        ]);

        if (rolesRes.ok) {
          const rolesData = await rolesRes.json();
          // Handle both array and { roles: [] } response shapes
          const rolesList = Array.isArray(rolesData) ? rolesData : (rolesData.roles || []);
          setRoles(rolesList.filter((r: Role) => !r.name?.toLowerCase().includes('superadmin')));
        }

        if (deptsRes.ok) {
          const deptsData = await deptsRes.json();
          const deptsList = Array.isArray(deptsData) ? deptsData : (deptsData.departments || []);
          setDepartments(deptsList);
        }
      } catch {
        toast.error('Failed to load roles and departments');
      } finally {
        setLoadingData(false);
      }
    }

    fetchData();
  }, [open]);

  // Reset form when dialog closes
  useEffect(() => {
    if (!open) {
      setName('');
      setEmail('');
      setRoleId('');
      setDepartmentId('');
      setFormErrors({});
    }
  }, [open]);

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

    if (!roleId) {
      errors.roleId = 'Please select a role.';
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  }

  async function handleSubmit() {
    if (!validateForm()) return;

    setSubmitting(true);
    try {
      const res = await fetch('/api/invitations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim(),
          roleId,
          departmentId: departmentId || undefined,
        }),
      });

      const data = await res.json();

      if (res.ok) {
        toast.success(`Invitation sent to ${email.trim()}`);
        onOpenChange(false);
        onInvited?.();
      } else {
        toast.error(data.error || 'Failed to send invitation');
      }
    } catch {
      toast.error('Network error. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Invite User</DialogTitle>
          <DialogDescription>
            Send an invitation email to add a new team member.
          </DialogDescription>
        </DialogHeader>

        {loadingData ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
            <span className="ml-2 text-sm text-gray-500">Loading...</span>
          </div>
        ) : (
          <div className="space-y-4 py-2">
            {/* Name */}
            <div className="space-y-2">
              <Label htmlFor="invite-name">Full Name</Label>
              <Input
                id="invite-name"
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

            {/* Email */}
            <div className="space-y-2">
              <Label htmlFor="invite-email">Email Address</Label>
              <Input
                id="invite-email"
                type="email"
                placeholder="jane@company.com"
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

            {/* Role */}
            <div className="space-y-2">
              <Label>Role</Label>
              <Select
                value={roleId}
                onValueChange={(value) => {
                  setRoleId(value);
                  setFormErrors((prev) => ({ ...prev, roleId: '' }));
                  // Auto-select department from role if available
                  const selectedRole = roles.find((r) => r.id === value);
                  if (selectedRole?.department_id) {
                    setDepartmentId(selectedRole.department_id);
                  }
                }}
              >
                <SelectTrigger className={`w-full ${formErrors.roleId ? 'border-red-500' : ''}`}>
                  <SelectValue placeholder="Select a role" />
                </SelectTrigger>
                <SelectContent>
                  {roles.map((role) => (
                    <SelectItem key={role.id} value={role.id}>
                      {role.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {formErrors.roleId && (
                <p className="text-sm text-red-600">{formErrors.roleId}</p>
              )}
            </div>

            {/* Department (optional) */}
            <div className="space-y-2">
              <Label>Department <span className="text-gray-400 font-normal">(optional)</span></Label>
              <Select
                value={departmentId}
                onValueChange={setDepartmentId}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select a department" />
                </SelectTrigger>
                <SelectContent>
                  {departments.map((dept) => (
                    <SelectItem key={dept.id} value={dept.id}>
                      {dept.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={submitting || loadingData}>
            {submitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Sending...
              </>
            ) : (
              <>
                <Send className="mr-2 h-4 w-4" />
                Send Invitation
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
