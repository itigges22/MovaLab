'use client';

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
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Plus, Loader2 } from 'lucide-react';
import { PermissionEditor } from './permission-editor';
import { Permission, getAllPermissions } from '@/lib/permissions';
import { roleManagementService, CreateRoleData } from '@/lib/role-management-service';
import { organizationService } from '@/lib/organization-service';
import { validateRole, ValidationResult } from '@/lib/validation';
import { logger, componentRender, componentError } from '@/lib/debug-logger';

interface Department {
  id: string;
  name: string;
}

interface Role {
  id: string;
  name: string;
  department_id: string;
}

interface RoleCreationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  departments?: Department[];
  children?: React.ReactNode;
}

export function RoleCreationDialog({ 
  open,
  onOpenChange,
  onSuccess,
  departments: externalDepartments,
  children
}: RoleCreationDialogProps) {
  const [loading, setLoading] = useState(false);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    department_id: '',
    reporting_role_id: '',
  });
  const [permissions, setPermissions] = useState<Record<Permission, boolean>>(() => {
    const initialPermissions = {} as Record<Permission, boolean>;
    getAllPermissions().forEach(permission => {
      initialPermissions[permission] = false;
    });
    return initialPermissions;
  });

  // Load departments and roles when dialog opens
  useEffect(() => {
    if (externalDepartments) {
      setDepartments(externalDepartments);
    }
  }, [externalDepartments]);

  useEffect(() => {
    if (open) {
      loadRoles();
    }
  }, [open]);

  const loadRoles = async () => {
    try {
      // Load roles for reporting structure
      const allRoles = await roleManagementService.getAllRoles();
      setRoles(allRoles);
    } catch (error) {
      console.error('Error loading roles:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      componentRender('RoleCreationDialog', { action: 'handleSubmit' });

      const roleData: CreateRoleData = {
        name: formData.name,
        description: formData.description || undefined,
        department_id: formData.department_id,
        permissions,
        reporting_role_id: formData.reporting_role_id === 'none' ? undefined : formData.reporting_role_id || undefined,
      };

      // Validate the role data
      const validation = validateRole(roleData);
      if (!validation.isValid) {
        logger.error('Role validation failed', { 
          action: 'handleSubmit',
          errors: validation.errors,
          warnings: validation.warnings
        });
        alert(`Validation failed: ${validation.errors.join(', ')}`);
        setLoading(false);
        return;
      }

      logger.info('Creating role', { 
        action: 'handleSubmit',
        name: roleData.name,
        departmentId: roleData.department_id
      });

      const response = await fetch('/api/roles', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(roleData),
      });

      if (response.ok) {
        const { role } = await response.json();
        logger.info('Role created successfully', { 
          action: 'handleSubmit',
          roleId: role.id,
          name: role.name
        });
        onSuccess();
        onOpenChange(false);
        resetForm();
      } else {
        const errorData = await response.json();
        componentError('RoleCreationDialog', new Error(errorData.error), { 
          action: 'handleSubmit',
          status: response.status
        });
        logger.error('Role creation failed', { 
          action: 'handleSubmit',
          status: response.status,
          error: errorData.error
        });
        alert(`Failed to create role: ${errorData.error || 'Please try again.'}`);
      }
    } catch (error) {
      componentError('RoleCreationDialog', error as Error, { 
        action: 'handleSubmit'
      });
      logger.error('Exception in role creation', { 
        action: 'handleSubmit' 
      }, error as Error);
      alert('An error occurred while creating the role.');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      department_id: '',
      reporting_role_id: '',
    });
    const resetPermissions = {} as Record<Permission, boolean>;
    getAllPermissions().forEach(permission => {
      resetPermissions[permission] = false;
    });
    setPermissions(resetPermissions);
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handlePermissionsChange = (newPermissions: Record<Permission, boolean>) => {
    setPermissions(newPermissions);
  };

  const handleSavePermissions = async (newPermissions: Record<Permission, boolean>) => {
    setPermissions(newPermissions);
    return true; // For creation dialog, we just update local state
  };

  const getFilteredRoles = () => {
    if (!formData.department_id) return roles;
    return roles.filter(role => role.department_id === formData.department_id);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create New Role</DialogTitle>
          <DialogDescription>
            Create a new role with specific permissions and reporting structure.
          </DialogDescription>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
            
            <div className="space-y-2">
              <Label htmlFor="department">Department *</Label>
              <Select
                value={formData.department_id}
                onValueChange={(value) => handleInputChange('department_id', value)}
                required
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select department" />
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

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => handleInputChange('description', e.target.value)}
              placeholder="Enter role description"
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="reporting_role">Reporting Role</Label>
            <Select
              value={formData.reporting_role_id}
              onValueChange={(value) => handleInputChange('reporting_role_id', value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select reporting role (optional)" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No reporting role</SelectItem>
                {getFilteredRoles().map((role) => (
                  <SelectItem key={role.id} value={role.id}>
                    {role.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-4">
            <Label className="text-base font-medium">Permissions</Label>
            <PermissionEditor
              roleId=""
              roleName={formData.name || 'New Role'}
              currentPermissions={permissions}
              onPermissionsChange={handlePermissionsChange}
              onSave={handleSavePermissions}
              disabled={loading}
            />
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button 
              type="submit" 
              disabled={loading || !formData.name || !formData.department_id}
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Creating...
                </>
              ) : (
                'Create Role'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
