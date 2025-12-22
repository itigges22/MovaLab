'use client';

import { useState, useEffect, useCallback } from 'react';
import { Node } from '@xyflow/react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  X,
  Users,
  Shield,
  Building2,
  Edit,
  UserPlus,
  ArrowUpRight
} from 'lucide-react';
import { RoleEditDialog } from './role-edit-dialog';
import { roleManagementService, RoleWithDetails } from '@/lib/role-management-service';
import { ErrorBoundary } from '@/components/ui/error-boundary';
import { logger, componentRender, componentError } from '@/lib/debug-logger';

interface RoleDetailPanelProps {
  node: Node;
  onClose: () => void;
  onUserAssign?: (userId: string, roleId: string) => void;
  onRoleUpdate?: (roleId: string) => void;
  isReadOnly?: boolean;
}

// Define the expected node data structure
interface NodeData {
  type?: 'department' | 'role' | 'user';
  role?: Record<string, unknown>;
  name?: string;
  description?: string;
  userCount?: number;
  user?: {
    name?: string;
    email?: string;
    image?: string | null;
  };
}

export function RoleDetailPanel({
  node,
  onClose,
  onUserAssign,
  onRoleUpdate,
  isReadOnly = false,
}: RoleDetailPanelProps) {
  const [roleDetails, setRoleDetails] = useState<RoleWithDetails | null>(null);
  const [roleUsers, setRoleUsers] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Cast node.data to our expected type
  const nodeData = node.data as NodeData;
  const isDepartment = nodeData.type === 'department';
  const isUser = nodeData.type === 'user';
  const role = nodeData.role;

  const loadRoleDetails = useCallback(async () => {
    if (!role?.id) return;

    setLoading(true);
    setError(null);

    try {
      componentRender('RoleDetailPanel', { action: 'loadRoleDetails', roleId: role.id as string });

      const [details, users] = await Promise.all([
        roleManagementService.getRoleById(role.id as string),
        roleManagementService.getRoleUsers(role.id as string),
      ]);

      if (details) {
        setRoleDetails(details);
        logger.debug('Role details loaded', {
          action: 'loadRoleDetails',
          roleId: role.id as string,
          userCount: users.length
        });
      }
      setRoleUsers(users || []);
    } catch (error: unknown) {
      componentError('RoleDetailPanel', error as Error, {
        action: 'loadRoleDetails',
        roleId: role.id as string
      });
      logger.error('Error loading role details', {
        action: 'loadRoleDetails',
        roleId: role.id as string
      }, error as Error);
      setError('Failed to load role details');
    } finally {
      setLoading(false);
    }
  }, [role?.id]);

  useEffect(() => {
    if (role?.id) {
      void loadRoleDetails();
    } else {
      // Reset state when no role
      setRoleDetails(null);
      setRoleUsers([]);
      setError(null);
    }
  }, [role?.id, loadRoleDetails]);

  const _handleUserAssign = async (userId: string) => {
    if (role?.id && onUserAssign) {
      onUserAssign(userId, role.id as string);
      // Reload role details to show updated user count
      await loadRoleDetails();
    }
  };

  const handleRoleUpdate = async () => {
    if (onRoleUpdate) {
      onRoleUpdate((role?.id as string) || '');
      // Reload role details
      await loadRoleDetails();
    }
  };

  const handleRemoveUser = async (userRoleId: string) => {
    if (!role?.id) return;

    try {
      const success = await roleManagementService.removeUserFromRole(
        (roleUsers.find((u: any) => u.user_id === userRoleId)?.user_id as string) || '',
        role.id as string
      );

      if (success) {
        await loadRoleDetails();
      }
    } catch (error: unknown) {
      console.error('Error removing user from role:', error);
    }
  };

  if (isDepartment) {
    return (
      <ErrorBoundary component="RoleDetailPanel">
        <div className="fixed right-0 top-0 h-full w-80 bg-background border-l shadow-lg z-50 overflow-y-auto">
          <div className="p-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">Department Details</h2>
              <Button variant="ghost" size="sm" onClick={onClose}>
                <X className="h-4 w-4" />
              </Button>
            </div>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="h-5 w-5 text-blue-500" />
                {nodeData.name}
              </CardTitle>
              <CardDescription>{nodeData.description}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">{nodeData.userCount} users</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
      </ErrorBoundary>
    );
  }

  if (isUser) {
    return (
      <ErrorBoundary component="RoleDetailPanel">
        <div className="fixed right-0 top-0 h-full w-80 bg-background border-l shadow-lg z-50 overflow-y-auto">
          <div className="p-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">User Details</h2>
              <Button variant="ghost" size="sm" onClick={onClose}>
                <X className="h-4 w-4" />
              </Button>
            </div>

            <Card>
              <CardHeader>
                <div className="flex items-center gap-3">
                  <Avatar className="h-12 w-12">
                    <AvatarImage src={nodeData.user?.image ?? undefined} />
                    <AvatarFallback>
                      {nodeData.user?.name?.split(' ').map((n: string) => n[0]).join('').toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <CardTitle className="text-base">{nodeData.user?.name}</CardTitle>
                    <CardDescription>{nodeData.user?.email}</CardDescription>
                  </div>
                </div>
              </CardHeader>
            </Card>
          </div>
        </div>
      </ErrorBoundary>
    );
  }

  if (!role) {
    return null;
  }

  return (
    <ErrorBoundary component="RoleDetailPanel">
      <div className="fixed right-0 top-0 h-full w-80 bg-background border-l shadow-lg z-50 overflow-y-auto">
      <div className="p-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Role Details</h2>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        ) : error ? (
          <div className="flex items-center justify-center py-8">
            <div className="text-center">
              <p className="text-red-500 mb-2">Error loading role details</p>
              <Button variant="outline" onClick={loadRoleDetails}>
                Retry
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Role Info */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    {role.is_system_role ? (
                      <Shield className="h-5 w-5 text-red-500" />
                    ) : (
                      <Users className="h-5 w-5 text-blue-500" />
                    )}
                    {String(role.name)}
                  </CardTitle>
                  {!isReadOnly && (
                    <RoleEditDialog
                      open={false}
                      onOpenChange={() => {}}
                      role={roleDetails || (role as unknown as RoleWithDetails)}
                      onSuccess={handleRoleUpdate}
                    >
                      <Button variant="outline" size="sm">
                        <Edit className="h-4 w-4 mr-2" />
                        Edit
                      </Button>
                    </RoleEditDialog>
                  )}
                </div>
                <CardDescription>
                  {String(role.department_name)} • Level {String(role.hierarchy_level)}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Badge variant={role.is_system_role ? 'destructive' : 'secondary'}>
                      {role.is_system_role ? 'System Role' : 'Custom Role'}
                    </Badge>
                    <Badge variant="outline">
                      {String(role.user_count)} users
                    </Badge>
                  </div>
                  
                  {roleDetails?.description && (
                    <p className="text-sm text-muted-foreground">
                      {roleDetails.description}
                    </p>
                  )}

                  {roleDetails?.reporting_role && (
                    <div className="flex items-center gap-2 text-sm">
                      <ArrowUpRight className="h-4 w-4 text-muted-foreground" />
                      <span>Reports to: {roleDetails.reporting_role.name}</span>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Permissions */}
            {roleDetails && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Permissions</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {Object.entries(roleDetails.permissions)
                      .filter(([_, hasPermission]) => hasPermission)
                      .slice(0, 5)
                      .map(([permission, _]) => (
                        <Badge key={permission} variant="outline" className="text-xs">
                          {permission.replace(/_/g, ' ')}
                        </Badge>
                      ))}
                    {Object.values(roleDetails.permissions).filter(Boolean).length > 5 && (
                      <p className="text-xs text-muted-foreground">
                        +{Object.values(roleDetails.permissions).filter(Boolean).length - 5} more permissions
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Users */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">Assigned Users</CardTitle>
                  {!isReadOnly && onUserAssign && (
                    <Button variant="outline" size="sm">
                      <UserPlus className="h-4 w-4 mr-2" />
                      Assign User
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                {roleUsers.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    No users assigned to this role
                  </p>
                ) : (
                  <div className="space-y-3">
                    {roleUsers.map((userRole) => {
                      const user = userRole.user as Record<string, unknown> | undefined;
                      return (
                      <div key={userRole.user_id as string} className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <Avatar className="h-8 w-8">
                            <AvatarImage src={((user as any)?.image as string | null) || undefined} />
                            <AvatarFallback>
                              {((user as any)?.name as string | undefined)?.split(' ').map((n: string) => n[0]).join('').toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="text-sm font-medium">{String((user as any)?.name)}</p>
                            <p className="text-xs text-muted-foreground">{String((user as any)?.email)}</p>
                          </div>
                        </div>
                        {!isReadOnly && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleRemoveUser(userRole.user_id as string)}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
    </ErrorBoundary>
  );
}
