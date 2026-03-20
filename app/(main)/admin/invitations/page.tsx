'use client';

import { RoleGuard } from '@/components/role-guard';
import { Permission } from '@/lib/permissions';
import { InvitationDialog } from '@/components/onboarding/invitation-dialog';
import { InvitationList } from '@/components/onboarding/invitation-list';
import { Button } from '@/components/ui/button';
import { UserPlus } from 'lucide-react';
import { useState } from 'react';

export default function InvitationsPage() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  return (
    <RoleGuard requirePermission={Permission.MANAGE_USER_ROLES}>
      <div className="container mx-auto p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Invite Users</h1>
            <p className="text-gray-600 mt-1">Invite team members and manage pending invitations</p>
          </div>
          <Button onClick={() => setDialogOpen(true)}>
            <UserPlus className="w-4 h-4 mr-2" />
            Send Invitation
          </Button>
        </div>

        <InvitationList key={refreshKey} />

        <InvitationDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          onInvited={() => setRefreshKey(k => k + 1)}
        />
      </div>
    </RoleGuard>
  );
}
