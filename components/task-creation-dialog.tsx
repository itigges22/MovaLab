'use client';

import { useState, useEffect } from 'react';
import { addDays } from 'date-fns';
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
import { PlusIcon, X } from 'lucide-react';
import { accountService } from '@/lib/account-service';
import { createClientSupabase } from '@/lib/supabase';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/lib/hooks/useAuth';
import { hasPermission } from '@/lib/rbac';
import { Permission } from '@/lib/permissions';

interface TaskCreationDialogProps {
  children?: React.ReactNode;
  onTaskCreated?: (task: any, assignedUser?: any) => void;
  accountId?: string;
  account?: any; // Full account object with contact and manager info
  defaultStatus?: string;
  userProfile?: any;
  statusOptions?: Array<{ value: string; label: string; color: string; originalValue?: string }>;
  initialStartDate?: Date;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  editMode?: boolean;
  existingProject?: any;
}

export default function TaskCreationDialog({ 
  children, 
  onTaskCreated,
  accountId,
  account,
  defaultStatus = 'planning',
  userProfile,
  statusOptions,
  initialStartDate,
  open: controlledOpen,
  onOpenChange: controlledOnOpenChange,
  editMode = false,
  existingProject
}: TaskCreationDialogProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const auth = useAuth();
  const effectiveUserProfile = userProfile || auth.userProfile;
  const [canCreateProject, setCanCreateProject] = useState(false);
  const [canEditProject, setCanEditProject] = useState(false);
  
  // Use controlled open state if provided, otherwise use internal state
  const open = controlledOpen !== undefined ? controlledOpen : internalOpen;
  const setOpen = controlledOnOpenChange || setInternalOpen;

  // Check permissions
  useEffect(() => {
    if (!effectiveUserProfile || !accountId) return;
    
    async function checkPermissions() {
      if (editMode && existingProject) {
        // Edit mode - check EDIT_PROJECT permission
        const canEdit = await hasPermission(effectiveUserProfile, Permission.EDIT_PROJECT, { projectId: existingProject.id, accountId });
        setCanEditProject(canEdit);
      } else {
        // Create mode - check CREATE_PROJECT permission
        const canCreate = await hasPermission(effectiveUserProfile, Permission.CREATE_PROJECT, { accountId });
        setCanCreateProject(canCreate);
      }
    }
    
    checkPermissions();
  }, [effectiveUserProfile, accountId, editMode, existingProject]);

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    assigned_user_id: '',
    priority: 'medium' as 'low' | 'medium' | 'high' | 'urgent' | 'idea',
    status: defaultStatus,
    start_date: initialStartDate ? initialStartDate.toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
    end_date: initialStartDate ? addDays(initialStartDate, 7).toISOString().split('T')[0] : addDays(new Date(), 7).toISOString().split('T')[0],
  });

  // Multi-select states
  const [selectedStakeholders, setSelectedStakeholders] = useState<string[]>([]);
  const [selectedDepartments, setSelectedDepartments] = useState<string[]>([]);

  // Data states
  const [users, setUsers] = useState<any[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const [userRoles, setUserRoles] = useState<Map<string, string[]>>(new Map()); // userId -> role names
  const [loadingData, setLoadingData] = useState(false);

  // Update dates when initialStartDate prop changes
  useEffect(() => {
    if (initialStartDate) {
      setFormData(prev => ({
        ...prev,
        start_date: initialStartDate.toISOString().split('T')[0],
        end_date: addDays(initialStartDate, 7).toISOString().split('T')[0],
      }));
    }
  }, [initialStartDate]);

  // Load data when dialog opens
  useEffect(() => {
    if (open) {
      loadData();
    }
  }, [open, accountId, account]);

  // Populate form data when in edit mode
  useEffect(() => {
    if (open && editMode && existingProject) {
      console.log('=== EDIT MODE: Populating form with existing project ===');
      console.log('Full existing project data:', existingProject);
      console.log('Existing stakeholders:', existingProject.stakeholders);
      console.log('Stakeholders is array?', Array.isArray(existingProject.stakeholders));
      console.log('Stakeholders length:', existingProject.stakeholders?.length);
      
      setFormData({
        name: existingProject.name || '',
        assigned_user_id: existingProject.assigned_user_id || '',
        priority: existingProject.priority || 'medium',
        status: existingProject.status || defaultStatus,
        start_date: existingProject.start_date ? new Date(existingProject.start_date).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
        end_date: existingProject.end_date ? new Date(existingProject.end_date).toISOString().split('T')[0] : addDays(new Date(), 7).toISOString().split('T')[0],
      });

      // Set stakeholders
      if (existingProject.stakeholders && Array.isArray(existingProject.stakeholders)) {
        console.log('Setting stakeholders from existing project:', existingProject.stakeholders);
        const stakeholderIds = existingProject.stakeholders.map((s: any) => {
          console.log('Mapping stakeholder:', s, 'user_id:', s.user_id);
          return s.user_id;
        });
        console.log('Extracted stakeholder IDs:', stakeholderIds);
        setSelectedStakeholders(stakeholderIds);
        console.log('selectedStakeholders state should now be:', stakeholderIds);
      } else {
        console.log('No stakeholders found in existing project - setting to empty array');
        console.log('existingProject.stakeholders value:', existingProject.stakeholders);
        setSelectedStakeholders([]);
      }

      // Set departments
      if (existingProject.departments && Array.isArray(existingProject.departments)) {
        console.log('Setting departments:', existingProject.departments.map((d: any) => d.id));
        setSelectedDepartments(existingProject.departments.map((d: any) => d.id));
      }
      
      console.log('=== END EDIT MODE POPULATION ===');
    }
  }, [open, editMode, existingProject]);

  const loadData = async () => {
    setLoadingData(true);
    try {
      const supabase = createClientSupabase();
      
      // Load all users
      const usersData = await accountService.getAllUsers();
      console.log('Loaded users:', usersData);
      setUsers(usersData || []);

      // Load departments
      const { data: deptData, error: deptError } = await supabase
        .from('departments')
        .select('*')
        .order('name');
      
      if (deptError) {
        console.error('Error loading departments:', deptError);
      } else {
        setDepartments(deptData || []);
      }

      // Load user roles for all users
      const { data: userRolesData, error: rolesError } = await supabase
        .from('user_roles')
        .select(`
          user_id,
          roles:role_id (
            name,
            departments:department_id (
              name
            )
          )
        `);

      if (rolesError) {
        console.error('Error loading user roles:', rolesError);
      } else {
        console.log('Loaded user roles data:', userRolesData);
        // Create a map of userId -> array of role names
        const rolesMap = new Map<string, string[]>();
        userRolesData?.forEach((ur: any) => {
          const userId = ur.user_id;
          const roleName = ur.roles?.name || 'Team Member';
          const deptName = ur.roles?.departments?.name;
          
          // Format: "Role Name (Department)" or just "Role Name" if no department
          const displayRole = deptName ? `${roleName} (${deptName})` : roleName;
          
          if (!rolesMap.has(userId)) {
            rolesMap.set(userId, []);
          }
          rolesMap.get(userId)?.push(displayRole);
        });
        setUserRoles(rolesMap);
      }

      // Auto-select stakeholders ONLY in create mode (not edit mode)
      // In edit mode, stakeholders are set by the separate useEffect
      if (!editMode) {
        const autoStakeholders: string[] = [];
        if (account?.account_manager_id) {
          autoStakeholders.push(account.account_manager_id);
        }
        setSelectedStakeholders(autoStakeholders);
      }

    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoadingData(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    console.log('=== FORM SUBMIT STARTED ===');
    console.log('Form data:', formData);
    console.log('Selected stakeholders at submit:', selectedStakeholders);
    console.log('Selected stakeholders length:', selectedStakeholders.length);
    console.log('Selected departments at submit:', selectedDepartments);
    console.log('Edit mode:', editMode);
    console.log('Existing project ID:', existingProject?.id);
    
    // Check permissions
    if (editMode && existingProject) {
      if (!canEditProject) {
        alert('You do not have permission to edit this project.');
        return;
      }
    } else {
      if (!canCreateProject) {
        alert('You do not have permission to create projects for this account.');
        return;
      }
    }
    
    // Validation
    if (!formData.name.trim()) {
      alert('Project name is required');
      return;
    }
    if (!formData.assigned_user_id) {
      alert('Please assign the project to someone');
      return;
    }
    if (selectedDepartments.length === 0) {
      alert('Please select at least one department');
      return;
    }

    setLoading(true);

    try {
      const supabase = createClientSupabase();
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        alert('You must be logged in to create or edit a project.');
        return;
      }

      let project: any;

      if (editMode && existingProject) {
        // UPDATE MODE
        const { data: updatedProject, error: projectError } = await supabase
          .from('projects')
          .update({
            name: formData.name,
            status: statusOptions?.find(s => s.value === formData.status)?.originalValue || formData.status,
            priority: formData.priority,
            start_date: formData.start_date,
            end_date: formData.end_date,
            assigned_user_id: formData.assigned_user_id === 'none' ? null : formData.assigned_user_id,
            updated_at: new Date().toISOString(),
          })
          .eq('id', existingProject.id)
          .select()
          .single();

        if (projectError) {
          console.error('Error updating project:', projectError);
          alert('Failed to update project: ' + projectError.message);
          return;
        }

        project = updatedProject;

        // Update departments - delete old, insert new
        await supabase
          .from('project_departments')
          .delete()
          .eq('project_id', project.id);

        if (selectedDepartments.length > 0) {
          const departmentLinks = selectedDepartments.map(deptId => ({
            project_id: project.id,
            department_id: deptId,
            assigned_at: new Date().toISOString(),
          }));

          await supabase
            .from('project_departments')
            .insert(departmentLinks);
        }

        // Update stakeholders - delete old, insert new
        console.log('[UPDATE MODE] Starting stakeholder update for project:', project.id);
        console.log('[UPDATE MODE] Selected stakeholders:', selectedStakeholders);
        console.log('[UPDATE MODE] Account manager ID:', account?.account_manager_id);
        console.log('[UPDATE MODE] Current user (session):', session.user.id, session.user.email);
        
        // FIRST: Check what stakeholders exist BEFORE delete
        const { data: beforeData } = await supabase
          .from('project_stakeholders')
          .select('*')
          .eq('project_id', project.id);
        console.log('[VERIFY] BEFORE DELETE: Stakeholders in database:', beforeData);
        
        // Delete existing stakeholders
        console.log('[DELETE] Attempting to DELETE stakeholders...');
        const { data: deleteData, error: deleteError } = await supabase
          .from('project_stakeholders')
          .delete()
          .eq('project_id', project.id)
          .select();
        
        if (deleteError) {
          console.error('[ERROR] DELETE ERROR:', deleteError);
          alert(`Failed to delete old stakeholders: ${deleteError.message}\n\nDetails: ${JSON.stringify(deleteError, null, 2)}`);
          throw new Error(`Failed to delete stakeholders: ${deleteError.message}`);
        } else {
          console.log('[SUCCESS] DELETE SUCCESS: Deleted', deleteData?.length || 0, 'stakeholders');
          console.log('[SUCCESS] Deleted rows:', deleteData);
        }
        
        // VERIFY deletion worked
        const { data: afterDeleteData } = await supabase
          .from('project_stakeholders')
          .select('*')
          .eq('project_id', project.id);
        console.log('[VERIFY] AFTER DELETE: Stakeholders remaining:', afterDeleteData);

        if (selectedStakeholders.length > 0) {
          console.log('[INSERT] Creating stakeholder links for', selectedStakeholders.length, 'users');
          const stakeholderLinks = selectedStakeholders.map(userId => {
            let role = 'team_member';
            if (userId === account?.account_manager_id) {
              role = 'account_manager';
              console.log('[INSERT]   User', userId, 'is account manager');
            } else {
              const userRolesList = userRoles.get(userId);
              if (userRolesList && userRolesList.length > 0) {
                role = userRolesList[0].split(' (')[0].toLowerCase().replace(/\s+/g, '_');
                console.log('[INSERT]   User', userId, 'has role:', role, '(from', userRolesList[0] + ')');
              } else {
                console.log('[INSERT]   User', userId, 'has no specific role, using team_member');
              }
            }
            
            const link = {
              project_id: project.id,
              user_id: userId,
              role: role,
              added_by: session.user.id,
              added_at: new Date().toISOString(),
            };
            console.log('[INSERT]   Created stakeholder link:', link);
            return link;
          });

          console.log('[INSERT] Attempting to INSERT', stakeholderLinks.length, 'stakeholder links');
          console.log('[INSERT] Links to insert:', stakeholderLinks);
          const { data: insertData, error: stakeError } = await supabase
            .from('project_stakeholders')
            .insert(stakeholderLinks)
            .select();

          if (stakeError) {
            console.error('[ERROR] INSERT ERROR:', stakeError);
            alert(`Failed to insert new stakeholders: ${stakeError.message}\n\nDetails: ${JSON.stringify(stakeError, null, 2)}\n\nAttempted to insert: ${JSON.stringify(stakeholderLinks, null, 2)}`);
            throw new Error(`Failed to insert stakeholders: ${stakeError.message}`);
          } else {
            console.log('[SUCCESS] INSERT SUCCESS: Inserted', insertData?.length, 'stakeholders');
            console.log('[SUCCESS] Inserted rows:', insertData);
            
            // VERIFY: Read back the stakeholders to confirm they were written
            const { data: verifyData, error: verifyError } = await supabase
              .from('project_stakeholders')
              .select('*')
              .eq('project_id', project.id);
            
            console.log('[VERIFY] FINAL VERIFICATION: Stakeholders in database after insert:', verifyData);
            console.log('[VERIFY] FINAL COUNT:', verifyData?.length);
            if (verifyError) {
              console.error('[ERROR] VERIFICATION ERROR:', verifyError);
            }
            
            if (verifyData?.length !== selectedStakeholders.length) {
              alert(`WARNING: Expected ${selectedStakeholders.length} stakeholders but found ${verifyData?.length} in database!\n\nThis may indicate an RLS or permission issue.`);
            }
          }
        } else {
          console.log('[SKIP] No stakeholders selected, skipping insert');
        }
      } else {
        // CREATE MODE
        const { data: newProject, error: projectError} = await supabase
          .from('projects')
          .insert({
            name: formData.name,
            account_id: accountId,
            status: statusOptions?.find(s => s.value === formData.status)?.originalValue || formData.status,
            priority: formData.priority,
            start_date: formData.start_date,
            end_date: formData.end_date,
            assigned_user_id: formData.assigned_user_id === 'none' ? null : formData.assigned_user_id,
            created_by: session.user.id,
            actual_hours: 0,
          })
          .select()
          .single();

        if (projectError) {
          console.error('Error creating project:', projectError);
          alert('Failed to create project: ' + projectError.message);
          return;
        }

        project = newProject;

        // Link project to departments
        if (selectedDepartments.length > 0) {
          const departmentLinks = selectedDepartments.map(deptId => ({
            project_id: project.id,
            department_id: deptId,
            assigned_at: new Date().toISOString(),
          }));

          const { error: deptError } = await supabase
            .from('project_departments')
            .insert(departmentLinks);

          if (deptError) {
            console.error('Error linking departments:', deptError);
          }
        }

        // Add stakeholders
        console.log('CREATE MODE: Adding stakeholders for project:', project.id);
        console.log('Selected stakeholders:', selectedStakeholders);
        
        if (selectedStakeholders.length > 0) {
          const stakeholderLinks = selectedStakeholders.map(userId => {
            let role = 'team_member';
            if (userId === account?.account_manager_id) {
              role = 'account_manager';
            } else {
              const userRolesList = userRoles.get(userId);
              if (userRolesList && userRolesList.length > 0) {
                role = userRolesList[0].split(' (')[0].toLowerCase().replace(/\s+/g, '_');
              }
            }
            
            return {
              project_id: project.id,
              user_id: userId,
              role: role,
              added_by: session.user.id,
              added_at: new Date().toISOString(),
            };
          });

          const { data: insertData, error: stakeError } = await supabase
            .from('project_stakeholders')
            .insert(stakeholderLinks)
            .select();

          if (stakeError) {
            console.error('Error adding stakeholders (CREATE):', stakeError);
            throw new Error(`Failed to add stakeholders: ${stakeError.message}`);
          } else {
            console.log('Successfully added stakeholders (CREATE):', insertData);
          }
        }
      }

      // Success!
      console.log('[SUCCESS] Project operation completed successfully');
      
      // In edit mode, we need to poll the database to ensure data is synced before reloading
      if (editMode) {
        console.log('[POLLING] Edit mode: Verifying data is fully synced before reload...');
        
        // Poll the database to ensure stakeholders are visible
        let attempts = 0;
        let dataVerified = false;
        while (attempts < 10 && !dataVerified) {
          await new Promise(resolve => setTimeout(resolve, 300));
          
          const { data: checkStakeholders } = await supabase
            .from('project_stakeholders')
            .select('id')
            .eq('project_id', project.id);
          
          const { data: checkDepartments } = await supabase
            .from('project_departments')
            .select('id')
            .eq('project_id', project.id);
          
          console.log(`[POLLING] Attempt ${attempts + 1}: Stakeholders=${checkStakeholders?.length || 0}, Departments=${checkDepartments?.length || 0}`);
          
          if (checkStakeholders?.length === selectedStakeholders.length && 
              checkDepartments?.length === selectedDepartments.length) {
            console.log('[SUCCESS] Data verified in database!');
            dataVerified = true;
          }
          attempts++;
        }
        
        if (!dataVerified) {
          console.warn('[WARNING] Could not verify all data after 10 attempts, reloading anyway');
        }
        
        // Close dialog
        setOpen(false);
        
        // Trigger reload
        console.log('[RELOAD] Triggering parent reload');
        onTaskCreated?.(project);
      } else {
        // Create mode - close and reset immediately
        setOpen(false);
        resetForm();
        console.log('[CREATE MODE] Calling callback');
        onTaskCreated?.(project);
      }

    } catch (error) {
      console.error('Error with project:', error);
      alert('An error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      assigned_user_id: '',
      priority: 'medium',
      status: defaultStatus,
      start_date: new Date().toISOString().split('T')[0],
      end_date: addDays(new Date(), 7).toISOString().split('T')[0],
    });
    setSelectedStakeholders([]);
    setSelectedDepartments([]);
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const toggleStakeholder = (userId: string) => {
    console.log('Toggling stakeholder:', userId);
    console.log('Current selectedStakeholders:', selectedStakeholders);
    setSelectedStakeholders(prev => {
      const newStakeholders = prev.includes(userId) 
        ? prev.filter(id => id !== userId)
        : [...prev, userId];
      console.log('Updated selectedStakeholders after toggle:', newStakeholders);
      return newStakeholders;
    });
  };

  const toggleDepartment = (deptId: string) => {
    setSelectedDepartments(prev => 
      prev.includes(deptId) 
        ? prev.filter(id => id !== deptId)
        : [...prev, deptId]
    );
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {!editMode && children && (
        <DialogTrigger asChild>
          {children}
        </DialogTrigger>
      )}
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editMode ? 'Edit Project' : 'Create New Project'}</DialogTitle>
          <DialogDescription>
            {editMode 
              ? 'Update project information. All fields are required.'
              : `Add a new project to ${account?.name || 'this account'}. All fields are required.`
            }
          </DialogDescription>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Project Name */}
          <div className="space-y-2">
            <Label htmlFor="name">
              Project Name <span className="text-destructive">*</span>
            </Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => handleInputChange('name', e.target.value)}
              placeholder="Enter project name"
              required
            />
          </div>

          {/* Assigned To */}
          <div className="space-y-2">
            <Label htmlFor="assigned_user">
              Assigned To <span className="text-destructive">*</span>
            </Label>
            <Select
              value={formData.assigned_user_id}
              onValueChange={(value) => handleInputChange('assigned_user_id', value)}
              required
            >
              <SelectTrigger>
                <SelectValue placeholder="Select person to assign" />
              </SelectTrigger>
              <SelectContent>
                {users.map((user) => (
                  <SelectItem key={user.id} value={user.id}>
                    {user.name} ({user.email})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Stakeholders (Multi-select Dropdown) */}
          <div className="space-y-2">
            <Label htmlFor="stakeholders">
              Stakeholders <span className="text-destructive">*</span>
            </Label>
            <p className="text-sm text-muted-foreground">
              Select team members involved in this project
            </p>
            <Select
              value="__placeholder__"
              onValueChange={(value) => {
                console.log('Stakeholder selected:', value);
                console.log('Current selectedStakeholders:', selectedStakeholders);
                if (value && value !== "__placeholder__" && !selectedStakeholders.includes(value)) {
                  setSelectedStakeholders(prev => {
                    const newStakeholders = [...prev, value];
                    console.log('Updated selectedStakeholders:', newStakeholders);
                    return newStakeholders;
                  });
                }
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Add stakeholders..." />
              </SelectTrigger>
              <SelectContent>
                {users
                  .filter(user => !selectedStakeholders.includes(user.id))
                  .map((user) => {
                    const roles = userRoles.get(user.id) || [];
                    const isAccountManager = user.id === account?.account_manager_id;
                    
                    // Debug logging
                    if (user.name === 'Isaac Tigges') {
                      console.log('Isaac Tigges check:', {
                        userId: user.id,
                        accountManagerId: account?.account_manager_id,
                        isAccountManager,
                        accountName: account?.name
                      });
                    }
                    
                    let displayText = user.name;
                    if (isAccountManager) {
                      displayText += ' (Account Manager)';
                    } else if (roles.length > 0) {
                      displayText += ` (${roles.join(', ')})`;
                    }
                    
                    return (
                      <SelectItem key={user.id} value={user.id}>
                        {displayText}
                      </SelectItem>
                    );
                  })}
              </SelectContent>
            </Select>
            {selectedStakeholders.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-2">
                {selectedStakeholders.map(userId => {
                  const user = users.find(u => u.id === userId);
                  const roles = userRoles.get(userId) || [];
                  const isAccountManager = userId === account?.account_manager_id;
                  
                  return user ? (
                    <Badge key={userId} variant="secondary" className="flex items-center gap-1">
                      {user.name}
                      {isAccountManager && <span className="text-xs">(AM)</span>}
                      {roles.length > 0 && !isAccountManager && (
                        <span className="text-xs">({roles[0].split(' (')[0]})</span>
                      )}
                      <button
                        type="button"
                        onClick={() => toggleStakeholder(userId)}
                        className="ml-1 hover:text-destructive"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ) : null;
                })}
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* Priority */}
            <div className="space-y-2">
              <Label htmlFor="priority">
                Priority <span className="text-destructive">*</span>
              </Label>
              <Select
                value={formData.priority}
                onValueChange={(value) => handleInputChange('priority', value)}
                required
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="urgent">Urgent</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="idea">Idea</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Status */}
            <div className="space-y-2">
              <Label htmlFor="status">
                Status <span className="text-destructive">*</span>
              </Label>
              <Select
                value={formData.status}
                onValueChange={(value) => handleInputChange('status', value)}
                required
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {statusOptions?.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* Start Date */}
            <div className="space-y-2">
              <Label htmlFor="start_date">
                Start Date <span className="text-destructive">*</span>
              </Label>
              <Input
                id="start_date"
                type="date"
                value={formData.start_date}
                onChange={(e) => handleInputChange('start_date', e.target.value)}
                required
              />
            </div>

            {/* End Date */}
            <div className="space-y-2">
              <Label htmlFor="end_date">
                End Date / Deadline <span className="text-destructive">*</span>
              </Label>
              <Input
                id="end_date"
                type="date"
                value={formData.end_date}
                onChange={(e) => handleInputChange('end_date', e.target.value)}
                required
              />
            </div>
          </div>

          {/* Department (Multi-select) */}
          <div className="space-y-2">
            <Label>
              Departments <span className="text-destructive">*</span>
            </Label>
            <p className="text-sm text-muted-foreground">
              Select one or more departments for this project
            </p>
            <div className="border rounded-md p-3 space-y-2 max-h-32 overflow-y-auto">
              {departments.map((dept) => (
                <div key={dept.id} className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id={`dept-${dept.id}`}
                    checked={selectedDepartments.includes(dept.id)}
                    onChange={() => toggleDepartment(dept.id)}
                    className="rounded"
                  />
                  <label htmlFor={`dept-${dept.id}`} className="text-sm cursor-pointer">
                    {dept.name}
                  </label>
                </div>
              ))}
            </div>
            {selectedDepartments.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-2">
                {selectedDepartments.map(deptId => {
                  const dept = departments.find(d => d.id === deptId);
                  return dept ? (
                    <Badge key={deptId} variant="secondary">
                      {dept.name}
                      <button
                        type="button"
                        onClick={() => toggleDepartment(deptId)}
                        className="ml-1 hover:text-destructive"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ) : null;
                })}
              </div>
            )}
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
            <Button 
              type="submit" 
              disabled={loading || !formData.name || !formData.assigned_user_id || selectedDepartments.length === 0}
            >
              {loading ? (editMode ? 'Updating...' : 'Creating...') : (editMode ? 'Update Project' : 'Create Project')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
