'use client';
import { toast } from 'sonner';

import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PlusIcon } from 'lucide-react';
import { createClientSupabase } from '@/lib/supabase';


interface Role {
  id: string;
  name: string;
  description: string | null;
  department_id: string;
  permissions: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

interface DepartmentRoleDialogProps {
  children?: React.ReactNode;
  onRoleCreated?: (role: Role) => void;
  onRoleUpdated?: (role: Role) => void;
  departmentId: string;
  existingRole?: Role | null;
  mode?: 'create' | 'edit';
}

export default function DepartmentRoleDialog({ 
  children, 
  onRoleCreated,
  onRoleUpdated,
  departmentId,
  existingRole = null,
  mode = 'create'
}: DepartmentRoleDialogProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  // Form state
  // Permission keys aligned with the system Permission enum (lib/permissions.ts)
  const [formData, setFormData] = useState({
    name: '',
    permissions: {
      view_projects: true,
      manage_projects: false,
      view_departments: true,
      execute_workflows: false,
      manage_time: true,
      view_team_capacity: false,
      edit_own_availability: true,
    }
  });

  // Reset form when dialog opens or mode changes
  useEffect(() => {
    if (open) {
      if (mode === 'edit' && existingRole) {
        const existingPermissions = existingRole.permissions as Record<string, boolean> || {};
        setFormData({
          name: existingRole.name,
          permissions: {
            view_projects: existingPermissions.view_projects ?? true,
            manage_projects: existingPermissions.manage_projects ?? false,
            view_departments: existingPermissions.view_departments ?? true,
            execute_workflows: existingPermissions.execute_workflows ?? false,
            manage_time: existingPermissions.manage_time ?? true,
            view_team_capacity: existingPermissions.view_team_capacity ?? false,
            edit_own_availability: existingPermissions.edit_own_availability ?? true,
          }
        });
      } else {
        setFormData({
          name: '',
          permissions: {
            view_projects: true,
            manage_projects: false,
            view_departments: true,
            execute_workflows: false,
            manage_time: true,
            view_team_capacity: false,
            edit_own_availability: true,
          }
        });
      }
    }
  }, [open, mode, existingRole]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const supabase = createClientSupabase();
      if (!supabase) {
        throw new Error('Failed to create Supabase client');
      }

      // Check current user and their permissions
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError) {
        toast.error('Authentication error. Please log in again.');
        return;
      }

      if (mode === 'create') {
        const insertData = {
          name: formData.name,
          department_id: departmentId,
          permissions: formData.permissions,
        };
        
        const { data, error } = await (supabase as any)
          .from('roles')
          .insert(insertData)
          .select()
          .single();

        if (error) {
          toast.error('Failed to create role. Please try again.');
          return;
        }

        onRoleCreated?.(data);
      } else if (mode === 'edit' && existingRole) {
        const updateData = {
          name: formData.name,
          permissions: formData.permissions,
        };
        
        const { data, error } = await (supabase as any)
          .from('roles')
          .update(updateData)
          .eq('id', existingRole.id)
          .select()
          .single();

        if (error) {
          toast.error('Failed to update role. Please try again.');
          return;
        }

        onRoleUpdated?.(data);
      }

      setOpen(false);
    } catch (error: unknown) {
      toast.error('An error occurred while saving the role. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (field: string, value: string | boolean) => {
    if (field.startsWith('permissions.')) {
      const permissionKey = field.replace('permissions.', '');
      setFormData(prev => ({
        ...prev,
        permissions: {
          ...prev.permissions,
          [permissionKey]: value
        }
      }));
    } else {
      setFormData(prev => ({ ...prev, [field]: value }));
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {children || (
          <Button>
            <PlusIcon className="h-4 w-4 mr-2" />
            Add Role
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {mode === 'create' ? 'Create New Role' : 'Edit Role'}
          </DialogTitle>
          <DialogDescription>
            {mode === 'create' 
              ? 'Add a new role to this department with specific permissions.'
              : 'Update the role details and permissions.'
            }
          </DialogDescription>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Role Name *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => handleInputChange('name', e.target.value)}
                placeholder="Enter role name"
                required
              />
            </div>

          </div>

          <div className="space-y-4">
            <Label className="text-base font-medium">Permissions</Label>
            <p className="text-xs text-muted-foreground">These permissions align with the system RBAC. For full permission management, use Admin &gt; Role Management.</p>
            <div className="space-y-3">
              <div className="flex items-center space-x-2">
                <input type="checkbox" id="view_projects" checked={formData.permissions.view_projects} onChange={(e) => handleInputChange('permissions.view_projects', e.target.checked)} className="rounded border-gray-300" />
                <Label htmlFor="view_projects" className="text-sm font-normal">View Projects</Label>
              </div>
              <div className="flex items-center space-x-2">
                <input type="checkbox" id="manage_projects" checked={formData.permissions.manage_projects} onChange={(e) => handleInputChange('permissions.manage_projects', e.target.checked)} className="rounded border-gray-300" />
                <Label htmlFor="manage_projects" className="text-sm font-normal">Manage Projects (create, edit, delete)</Label>
              </div>
              <div className="flex items-center space-x-2">
                <input type="checkbox" id="view_departments" checked={formData.permissions.view_departments} onChange={(e) => handleInputChange('permissions.view_departments', e.target.checked)} className="rounded border-gray-300" />
                <Label htmlFor="view_departments" className="text-sm font-normal">View Departments</Label>
              </div>
              <div className="flex items-center space-x-2">
                <input type="checkbox" id="execute_workflows" checked={formData.permissions.execute_workflows} onChange={(e) => handleInputChange('permissions.execute_workflows', e.target.checked)} className="rounded border-gray-300" />
                <Label htmlFor="execute_workflows" className="text-sm font-normal">Execute Workflows</Label>
              </div>
              <div className="flex items-center space-x-2">
                <input type="checkbox" id="manage_time" checked={formData.permissions.manage_time} onChange={(e) => handleInputChange('permissions.manage_time', e.target.checked)} className="rounded border-gray-300" />
                <Label htmlFor="manage_time" className="text-sm font-normal">Manage Time (log and edit entries)</Label>
              </div>
              <div className="flex items-center space-x-2">
                <input type="checkbox" id="view_team_capacity" checked={formData.permissions.view_team_capacity} onChange={(e) => handleInputChange('permissions.view_team_capacity', e.target.checked)} className="rounded border-gray-300" />
                <Label htmlFor="view_team_capacity" className="text-sm font-normal">View Team Capacity</Label>
              </div>
              <div className="flex items-center space-x-2">
                <input type="checkbox" id="edit_own_availability" checked={formData.permissions.edit_own_availability} onChange={(e) => handleInputChange('permissions.edit_own_availability', e.target.checked)} className="rounded border-gray-300" />
                <Label htmlFor="edit_own_availability" className="text-sm font-normal">Edit Own Availability</Label>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={loading || !formData.name}>
              {loading 
                ? (mode === 'create' ? 'Creating...' : 'Updating...') 
                : (mode === 'create' ? 'Create Role' : 'Update Role')
              }
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
