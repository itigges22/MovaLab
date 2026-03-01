'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Plus, 
  RefreshCw, 
  Building2,
  Network,
  Briefcase
} from 'lucide-react';
import { toast } from 'sonner';
import { RoleHierarchyDnd, RoleWithUsers } from '@/components/org-chart/role-hierarchy-dnd';
import { RoleCreationDialog } from '@/components/org-chart/role-creation-dialog';
import { RoleEditDialog } from '@/components/org-chart/role-edit-dialog';
import { UserAssignmentDialog } from '@/components/org-chart/user-assignment-dialog';
import { ReportingRoleDialog } from '@/components/org-chart/reporting-role-dialog';
import { DepartmentView } from '@/components/org-chart/department-view';
import { AccountView } from '@/components/org-chart/account-view';
import { RoleGuard } from '@/components/role-guard';
import { Permission } from '@/lib/permissions';
import { useAuth } from '@/lib/hooks/useAuth';
import { isUnassigned, hasPermission } from '@/lib/rbac';
import { isActionBlocked, getBlockedActionMessage } from '@/lib/demo-mode';

interface Department {
  id: string;
  name: string;
  description: string | null;
}

export default function RoleManagementPage() {
  const { userProfile, loading: authLoading } = useAuth();
  const router = useRouter();
  
  // State
  const [roles, setRoles] = useState<RoleWithUsers[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewType, setViewType] = useState<'hierarchy' | 'department' | 'accounts'>('hierarchy');
  
  
  // Dialogs
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [reportingDialogOpen, setReportingDialogOpen] = useState(false);
  const [selectedRole, setSelectedRole] = useState<RoleWithUsers | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [roleToDelete, setRoleToDelete] = useState<string | null>(null);
  
  // Permissions
  const [isReadOnly, setIsReadOnly] = useState(false);
  const [canCreateRole, setCanCreateRole] = useState(false);
  const [canEditRole, setCanEditRole] = useState(false);
  const [canDeleteRole, setCanDeleteRole] = useState(false);
  const [canAssignUsers, setCanAssignUsers] = useState(false);
  const [canViewAccountsTab, setCanViewAccountsTab] = useState(false);
  
  // Edit Mode (from RoleHierarchyDnd component)
  const [inEditMode, setInEditMode] = useState(false);
  const [, setHasUnsavedChanges] = useState(false);
  
  // Queued operations for Edit Mode (managed by parent, executed on save)
  const [pendingRoleEdits, setPendingRoleEdits] = useState<Map<string, Record<string, unknown>>>(new Map());
  const [pendingUserAssignments, setPendingUserAssignments] = useState<Array<{roleId: string, userId: string, userName: string}>>([])

  // Check if user is unassigned and redirect
  useEffect(() => {
    if (!authLoading && userProfile) {
      if (isUnassigned(userProfile)) {
        router.push('/welcome');
        return;
      }
    }
  }, [authLoading, userProfile, router]);

  // Redirect away from accounts tab if user doesn't have permission
  useEffect(() => {
    if (!authLoading && viewType === 'accounts' && !canViewAccountsTab) {
      setViewType('hierarchy');
    }
  }, [authLoading, viewType, canViewAccountsTab]);

  const checkPermissions = useCallback(async () => {
    if (!userProfile) return;

    try {
      // MANAGE_USER_ROLES consolidates create/edit/delete roles + assign/remove users
      const canManageRoles = await hasPermission(userProfile, Permission.MANAGE_USER_ROLES);
      const canManageAccountUsers = await hasPermission(userProfile, Permission.MANAGE_USERS_IN_ACCOUNTS);

      setCanCreateRole(canManageRoles);
      setCanEditRole(canManageRoles);
      setCanDeleteRole(canManageRoles);
      setCanAssignUsers(canManageRoles);
      setCanViewAccountsTab(canManageAccountUsers);

      // User is read-only if they can't manage roles
      setIsReadOnly(!canManageRoles);
    } catch {
      toast.error('Failed to check permissions. Please refresh the page.');
    }
  }, [userProfile]);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);

      // Add cache-busting headers to ensure fresh data
      const cacheHeaders = {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      };

      // Load roles with container data
      const rolesResponse = await fetch('/api/roles', {
        headers: cacheHeaders,
        cache: 'no-store',
        credentials: 'include'
      });

      const rolesApiData = await rolesResponse.json();

      if (!rolesResponse.ok) {
        // Handle permission errors gracefully (403) - these are expected for users without permissions
        if (rolesResponse.status === 403 || rolesApiData.code === 'PERMISSION_DENIED') {
          setRoles([]);
          setDepartments([]);
          setLoading(false);
          setTimeout(() => {
            router.push('/welcome');
          }, 100);
          return;
        }

        throw new Error(rolesApiData.error || 'Failed to load roles');
      }

      // Check if response contains an error
      if (rolesApiData.error) {
        if (rolesApiData.code === 'PERMISSION_DENIED') {
          setRoles([]);
          setDepartments([]);
          setLoading(false);
          setTimeout(() => {
            router.push('/welcome');
          }, 100);
          return;
        }

        throw new Error(rolesApiData.error || 'Failed to load roles');
      }

      // Extract roles from the new API response structure
      const rolesData = rolesApiData.roles || [];

      if (!Array.isArray(rolesData)) {
        throw new Error('Invalid roles data format received from API');
      }

      // Load departments
      const deptsResponse = await fetch('/api/departments', {
        headers: cacheHeaders,
        cache: 'no-store',
        credentials: 'include'
      });
      if (!deptsResponse.ok) throw new Error('Failed to load departments');
      const deptsData = await deptsResponse.json();

      setRoles(rolesData);
      setDepartments(deptsData);
    } catch (error: unknown) {
      const err = error as Error;
      // Check if this is a permission error (expected for users without permissions)
      const isPermissionError = err?.message?.includes('permission') ||
                                err?.message?.includes('Permission denied') ||
                                err?.message?.includes('You don\'t have permission');

      if (isPermissionError) {
        setRoles([]);
        setDepartments([]);
        setLoading(false);
        setTimeout(() => {
          router.push('/welcome');
        }, 100);
        return;
      }

      toast.error('Failed to load data. Please try again.');

      // Set empty arrays to prevent undefined errors
      setRoles([]);
      setDepartments([]);
    } finally {
      setLoading(false);
    }
  }, [router]);

  // Load data and check permissions when user is authenticated
  useEffect(() => {
    if (!authLoading && userProfile && !isUnassigned(userProfile)) {
      loadData();
      checkPermissions();
    }
  }, [authLoading, userProfile, loadData, checkPermissions]);

  function handleDeleteRole(roleId: string) {
    setRoleToDelete(roleId);
    setDeleteDialogOpen(true);
  }

  async function confirmDeleteRole() {
    if (!roleToDelete) return;

    // Block delete in demo mode
    if (isActionBlocked('delete_role')) {
      toast.error(getBlockedActionMessage('delete_role'));
      setDeleteDialogOpen(false);
      setRoleToDelete(null);
      return;
    }

    try {
      const response = await fetch(`/api/roles/${roleToDelete}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to delete role');
      }

      toast.success('Role deleted successfully');
      loadData();
    } catch {
      toast.error('Failed to delete role');
    } finally {
      setDeleteDialogOpen(false);
      setRoleToDelete(null);
    }
  }

  function handleEditRole(role: RoleWithUsers) {
    setSelectedRole(role);
    setEditDialogOpen(true);
  }

  function handleAssignUser(role: RoleWithUsers) {
    setSelectedRole(role);
    setAssignDialogOpen(true);
  }

  // Handler for queuing role edits in Edit Mode
  function handleLocalRoleUpdate(roleId: string, updates: any) {
    setPendingRoleEdits(prev => new Map(prev).set(roleId, updates));
    
    // Update local UI immediately for better UX
    setRoles(prevRoles => prevRoles.map((role: any) => {
      if (role.id === roleId) {
        return { ...role, ...updates };
      }
      return role;
    }));
  }

  // Handler for queuing user assignments in Edit Mode
  function handleLocalUserAssignment(roleId: string, userId: string, userName: string) {
    setPendingUserAssignments(prev => [...prev, { roleId, userId, userName }]);
    
    // Update local UI immediately for better UX
    setRoles(prevRoles => prevRoles.map((role: any) => {
      if (role.id === roleId) {
        // Check if user is already in the list to avoid duplicates
        const userExists = role.users.some((u: any) => u.id === userId);

        if (userExists) {
          return role; // User already exists, don't add again
        }
        
        return {
          ...role,
          user_count: role.user_count + 1,
          users: [...role.users, { id: userId, name: userName, email: '', image: null }]
        };
      }
      return role;
    }));
  }

  // Handler for Edit Mode changes - clear pending operations when exiting Edit Mode
  function handleEditModeChange(isEditMode: boolean) {
    setInEditMode(isEditMode);
    
    if (!isEditMode) {
      // Clear pending operations when exiting Edit Mode
      setPendingRoleEdits(new Map());
      setPendingUserAssignments([]);
      setHasUnsavedChanges(false);
    }
  }

  // Handler for unsaved changes notification from RoleHierarchyDnd
  function handleUnsavedChanges(hasChanges: boolean) {
    setHasUnsavedChanges(hasChanges);
  }

  // Handler for setting reporting role
  function handleSetReportingRole(role: RoleWithUsers) {
    setSelectedRole(role);
    setReportingDialogOpen(true);
  }

  // Handler for saving reporting role
  async function handleSaveReportingRole(roleId: string, reportingRoleId: string | null) {
    try {
      // Get current maximum hierarchy level to ensure Superadmin stays at top
      const maxLevel = Math.max(...roles.map((r: any) => r.hierarchy_level));
      
    // Calculate new hierarchy level
    let newHierarchyLevel: number;
    if (reportingRoleId) {
      const reportingRole = roles.find((r: any) => r.id === reportingRoleId);
      // Child role should be one level BELOW parent (lower number = deeper in hierarchy)
      newHierarchyLevel = (reportingRole?.hierarchy_level || 1) - 1;
    } else {
      // No reporting role - make it a top-level role (Level 1, or Level 0 for "No Assigned Role")
      const role = roles.find((r: any) => r.id === roleId);
      if (role?.name === 'No Assigned Role') {
        newHierarchyLevel = 0; // Special case for fallback role
      } else if (role?.name === 'Superadmin') {
        newHierarchyLevel = maxLevel + 1; // Superadmin is always at the highest level + 1
      } else {
        newHierarchyLevel = 1; // All other top-level roles
      }
    }
      
      const response = await fetch('/api/roles/reorder', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roleId,
          newReportingRoleId: reportingRoleId,
          newHierarchyLevel: newHierarchyLevel,
          newDisplayOrder: 1 // Will be recalculated
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update reporting role');
      }

      // Reload data to get updated hierarchy
      await loadData();
    } catch (error: unknown) {
      throw error;
    }
  }



  // Show loading or redirect if unassigned
  if (authLoading || !userProfile) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto"></div>
          <p className="mt-2 text-sm text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (isUnassigned(userProfile)) {
    return null; // Will redirect via useEffect
  }

  return (
    <RoleGuard requirePermission={Permission.MANAGE_USER_ROLES}>
      <div className="container mx-auto px-4 py-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Role Management</h1>
          <p className="text-gray-500 mt-1">
            Manage organizational roles and hierarchy
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={loadData} variant="outline" size="sm">
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          {canCreateRole && (
            <Button onClick={() => setCreateDialogOpen(true)} size="sm">
              <Plus className="h-4 w-4 mr-2" />
              Create Role
            </Button>
          )}
        </div>
      </div>

      {/* View Toggle */}
      <Tabs value={viewType} onValueChange={(v) => setViewType(v as 'hierarchy' | 'department' | 'accounts')} className="w-full">
        <TabsList>
          <TabsTrigger value="hierarchy" className="flex items-center gap-2">
            <Network className="h-4 w-4" />
            Hierarchy View
          </TabsTrigger>
          <TabsTrigger value="department" className="flex items-center gap-2">
            <Building2 className="h-4 w-4" />
            Department View
          </TabsTrigger>
          {canViewAccountsTab && (
            <TabsTrigger value="accounts" className="flex items-center gap-2">
              <Briefcase className="h-4 w-4" />
              Accounts View
            </TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="hierarchy" className="space-y-6 mt-6">
          {/* Role Hierarchy Card - Top of Page */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                Role Hierarchy
              </CardTitle>
              <CardDescription>
                Drag and drop roles to reorganize the hierarchy. Changes are saved automatically.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="text-center py-8 text-gray-500">Loading...</div>
              ) : roles.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  No roles found. Create your first role to get started.
                </div>
              ) : (
                <RoleHierarchyDnd
                  roles={roles}
                  onRoleUpdate={loadData}
                  onEdit={handleEditRole}
                  onDelete={handleDeleteRole}
                  onAssignUser={handleAssignUser}
                  onSetReportingRole={handleSetReportingRole}
                  isReadOnly={isReadOnly || (!canEditRole && !canDeleteRole && !canAssignUsers)}
                  onEditModeChange={handleEditModeChange}
                  pendingRoleEdits={pendingRoleEdits}
                  pendingUserAssignments={pendingUserAssignments}
                  onHasUnsavedChanges={handleUnsavedChanges}
                />
              )}
            </CardContent>
          </Card>


        </TabsContent>

        <TabsContent value="department" className="space-y-6 mt-6">
          <DepartmentView
            onRoleSelect={handleEditRole}
            isReadOnly={isReadOnly}
          />
        </TabsContent>

        {canViewAccountsTab && (
          <TabsContent value="accounts" className="space-y-6 mt-6">
            <AccountView
              isReadOnly={isReadOnly}
              userProfile={userProfile}
            />
          </TabsContent>
        )}
      </Tabs>

      {/* Dialogs */}
      <RoleCreationDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        onSuccess={loadData}
        departments={departments}
      />

      <RoleEditDialog
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        role={selectedRole}
        onSuccess={inEditMode ? () => {} : loadData} // Skip reload when in Edit Mode
        departments={departments}
        isEditMode={inEditMode}
        onLocalUpdate={handleLocalRoleUpdate}
      />

      <UserAssignmentDialog
        open={assignDialogOpen}
        onOpenChange={setAssignDialogOpen}
        role={selectedRole}
        onSuccess={inEditMode ? () => {} : loadData} // Skip reload when in Edit Mode
        isEditMode={inEditMode}
        onLocalAssign={handleLocalUserAssignment}
      />

      <ReportingRoleDialog
        open={reportingDialogOpen}
        onOpenChange={setReportingDialogOpen}
        role={selectedRole}
        allRoles={roles}
        onSave={handleSaveReportingRole}
      />

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Role</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this role? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDeleteRole} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
    </RoleGuard>
  );
}

