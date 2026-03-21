'use client';

import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { Loader2, RefreshCw, XCircle, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

interface Invitation {
  id: string;
  email: string;
  name: string;
  status: 'pending' | 'accepted' | 'expired' | 'revoked';
  created_at: string;
  expires_at: string;
  roles: { id: string; name: string } | null;
  departments: { id: string; name: string } | null;
  inviter: { id: string; name: string; email: string } | null;
}

const statusBadgeVariants: Record<string, { className: string; label: string }> = {
  pending: { className: 'bg-yellow-100 text-yellow-800 border-yellow-200', label: 'Pending' },
  accepted: { className: 'bg-green-100 text-green-800 border-green-200', label: 'Accepted' },
  expired: { className: 'bg-red-100 text-red-800 border-red-200', label: 'Expired' },
  revoked: { className: 'bg-gray-100 text-gray-600 border-gray-200', label: 'Revoked' },
};

export function InvitationList() {
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [revoking, setRevoking] = useState<string | null>(null);
  const [resending, setResending] = useState<string | null>(null);

  const fetchInvitations = useCallback(async () => {
    try {
      const res = await fetch('/api/invitations', { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setInvitations(data.invitations || []);
      } else {
        toast.error('Failed to load invitations');
      }
    } catch {
      toast.error('Network error loading invitations');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchInvitations();
  }, [fetchInvitations]);

  async function handleRevoke(id: string) {
    setRevoking(id);
    try {
      const res = await fetch(`/api/invitations/${id}`, {
        method: 'DELETE',
        credentials: 'include',
      });

      if (res.ok) {
        toast.success('Invitation revoked');
        // Update local state
        setInvitations((prev) =>
          prev.map((inv) => (inv.id === id ? { ...inv, status: 'revoked' as const } : inv))
        );
      } else {
        const data = await res.json();
        toast.error(data.error || 'Failed to revoke invitation');
      }
    } catch {
      toast.error('Network error. Please try again.');
    } finally {
      setRevoking(null);
    }
  }

  async function handleResend(id: string) {
    setResending(id);
    try {
      const res = await fetch(`/api/invitations/${id}/resend`, {
        method: 'POST',
        credentials: 'include',
      });

      if (res.ok) {
        toast.success('Invitation email resent');
      } else {
        const data = await res.json();
        toast.error(data.error || 'Failed to resend invitation');
      }
    } catch {
      toast.error('Network error. Please try again.');
    } finally {
      setResending(null);
    }
  }

  function formatDate(dateString: string): string {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
        <span className="ml-2 text-sm text-gray-500">Loading invitations...</span>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Invitations</h3>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            setLoading(true);
            fetchInvitations();
          }}
        >
          <RefreshCw className="mr-2 h-4 w-4" />
          Refresh
        </Button>
      </div>

      {invitations.length === 0 ? (
        <div className="rounded-lg border border-dashed p-8 text-center">
          <p className="text-sm text-gray-500">No invitations yet. Invite your first team member above.</p>
        </div>
      ) : (
        <div className="rounded-lg border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Sent</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {invitations.map((inv) => {
                const statusBadge = statusBadgeVariants[inv.status] || statusBadgeVariants.pending;
                return (
                  <TableRow key={inv.id}>
                    <TableCell className="font-medium">{inv.name}</TableCell>
                    <TableCell className="text-gray-600">{inv.email}</TableCell>
                    <TableCell>{inv.roles?.name || 'Unknown'}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={statusBadge.className}>
                        {statusBadge.label}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-gray-500 text-sm">
                      {formatDate(inv.created_at)}
                    </TableCell>
                    <TableCell className="text-right">
                      {inv.status === 'pending' && (
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                            onClick={() => handleResend(inv.id)}
                            disabled={resending === inv.id}
                          >
                            {resending === inv.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <>
                                <Send className="mr-1 h-4 w-4" />
                                Resend
                              </>
                            )}
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-red-600 hover:text-red-700 hover:bg-red-50"
                            onClick={() => handleRevoke(inv.id)}
                            disabled={revoking === inv.id}
                          >
                            {revoking === inv.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <>
                                <XCircle className="mr-1 h-4 w-4" />
                                Revoke
                              </>
                            )}
                          </Button>
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
