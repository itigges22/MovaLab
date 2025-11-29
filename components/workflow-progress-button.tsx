'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { ArrowRight, CheckCircle2, XCircle, AlertCircle, Send, Loader2, FileText } from 'lucide-react';
import { toast } from 'sonner';
import { createClientSupabase } from '@/lib/supabase';
import { useAuth } from '@/lib/hooks/useAuth';
import { hasPermission } from '@/lib/rbac';
import { Permission } from '@/lib/permissions';

interface WorkflowProgressButtonProps {
  projectId: string;
  workflowInstanceId: string | null;
  onProgress?: () => void;
}

interface WorkflowInstance {
  id: string;
  workflow_template_id: string;
  current_node_id: string | null;
  project_id: string | null;
  status: string;
  workflow_nodes?: {
    id: string;
    node_type: 'start' | 'department' | 'role' | 'approval' | 'form' | 'conditional' | 'end';
    label: string;
    settings: any;
    entity_id: string | null;
  };
  workflow_templates?: {
    id: string;
    name: string;
  };
}

interface NextNodePreview {
  id: string;
  label: string;
  node_type: string;
  entity_id: string | null;
}

interface User {
  id: string;
  name: string;
  email: string;
}

interface FormField {
  id: string;
  type: 'text' | 'number' | 'date' | 'dropdown' | 'multiselect' | 'file' | 'textarea' | 'email' | 'checkbox';
  label: string;
  required: boolean;
  placeholder?: string;
  options?: string[];
  defaultValue?: any;
  validation?: {
    min?: number;
    max?: number;
    pattern?: string;
    message?: string;
  };
  conditional?: {
    show_if: string;
    equals: any;
  };
}

interface FormTemplate {
  id: string;
  name: string;
  description: string | null;
  fields: FormField[];
}

export function WorkflowProgressButton({
  projectId,
  workflowInstanceId,
  onProgress,
}: WorkflowProgressButtonProps) {
  const router = useRouter();
  const { userProfile } = useAuth();
  const [loading, setLoading] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [workflowInstance, setWorkflowInstance] = useState<WorkflowInstance | null>(null);
  const [nextNode, setNextNode] = useState<NextNodePreview | null>(null);
  const [decision, setDecision] = useState<'approved' | 'rejected' | 'needs_changes' | undefined>();
  const [feedback, setFeedback] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [availableUsers, setAvailableUsers] = useState<User[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string>('');

  // Permission state
  const [canExecuteWorkflows, setCanExecuteWorkflows] = useState<boolean | null>(null);
  const [checkingPermissions, setCheckingPermissions] = useState(true);
  const [hasRequiredRole, setHasRequiredRole] = useState<boolean>(false); // Default false - only show after check passes
  const [requiredRoleName, setRequiredRoleName] = useState<string | null>(null);
  const [isAssignedToProject, setIsAssignedToProject] = useState<boolean>(false); // Default false - only show after check passes
  const [checkingAccessPermissions, setCheckingAccessPermissions] = useState(true); // Track access permission loading

  // Form state
  const [formTemplate, setFormTemplate] = useState<FormTemplate | null>(null);
  const [formData, setFormData] = useState<Record<string, any>>({});

  // Check permission when component mounts or user changes
  useEffect(() => {
    async function checkPermissions() {
      if (!userProfile) {
        setCanExecuteWorkflows(false);
        setCheckingPermissions(false);
        return;
      }

      try {
        const canExecute = await hasPermission(userProfile, Permission.EXECUTE_WORKFLOWS, { projectId });
        setCanExecuteWorkflows(canExecute);
      } catch (error) {
        console.error('Error checking workflow permissions:', error);
        setCanExecuteWorkflows(false);
      } finally {
        setCheckingPermissions(false);
      }
    }

    checkPermissions();
  }, [userProfile, projectId]);

  // Check role access AND project assignment when component mounts or workflow instance changes
  useEffect(() => {
    async function checkAccessPermissions() {
      setCheckingAccessPermissions(true);

      if (!workflowInstanceId || !userProfile) {
        // No workflow instance - don't show button at all (handled by render)
        setHasRequiredRole(false);
        setIsAssignedToProject(false);
        setCheckingAccessPermissions(false);
        return;
      }

      try {
        const supabase = createClientSupabase();
        if (!supabase) return;

        // Get workflow instance with current node and project_id
        const { data: instance, error } = await supabase
          .from('workflow_instances')
          .select(`
            *,
            workflow_nodes!workflow_instances_current_node_id_fkey(id, entity_id, node_type)
          `)
          .eq('id', workflowInstanceId)
          .single();

        if (error || !instance) {
          console.error('Error loading workflow instance for access check:', {
            error,
            errorCode: error?.code,
            errorMessage: error?.message,
            errorDetails: error?.details,
            workflowInstanceId,
            instanceData: instance
          });
          return;
        }

        // Check if user is superadmin (bypasses all checks)
        const isSuperadmin = userProfile.is_superadmin ||
          userProfile.user_roles?.some((ur: any) => ur.roles?.name?.toLowerCase() === 'superadmin');

        if (isSuperadmin) {
          setHasRequiredRole(true);
          setIsAssignedToProject(true);
          return;
        }

        // 1. CHECK PROJECT ASSIGNMENT (via project_assignments table only)
        // NOTE: created_by and assigned_user_id on the project do NOT grant workflow progression rights
        if (instance.project_id) {
          const { data: assignments } = await supabase
            .from('project_assignments')
            .select('id')
            .eq('user_id', userProfile.id)
            .eq('project_id', instance.project_id)
            .is('removed_at', null);

          setIsAssignedToProject((assignments?.length || 0) > 0);
        } else {
          setIsAssignedToProject(true); // No project restriction
        }

        // 2. CHECK ENTITY REQUIREMENT based on node type
        const currentNode = instance.workflow_nodes;

        // If the node has no entity_id, anyone assigned can progress
        if (!currentNode?.entity_id) {
          setHasRequiredRole(true);
          setRequiredRoleName(null);
          return;
        }

        // Handle different node types
        if (currentNode.node_type === 'role' || currentNode.node_type === 'approval') {
          // For role and approval nodes, entity_id is a role_id
          const userRoleIds = userProfile.user_roles?.map((ur: any) => ur.role_id) || [];
          const hasRole = userRoleIds.includes(currentNode.entity_id);
          setHasRequiredRole(hasRole);

          // Get the role name for display if user doesn't have it
          if (!hasRole) {
            const { data: roleData } = await supabase
              .from('roles')
              .select('name')
              .eq('id', currentNode.entity_id)
              .single();

            setRequiredRoleName(roleData?.name || null);
          } else {
            setRequiredRoleName(null);
          }
        } else if (currentNode.node_type === 'department') {
          // For department nodes, entity_id is a department_id
          // Check if user has any role in this department
          const userDeptIds = userProfile.user_roles
            ?.map((ur: any) => ur.roles?.department_id)
            .filter(Boolean) || [];
          const hasAccess = userDeptIds.includes(currentNode.entity_id);
          setHasRequiredRole(hasAccess);

          // Get department name for display if user doesn't have access
          if (!hasAccess) {
            const { data: deptData } = await supabase
              .from('departments')
              .select('name')
              .eq('id', currentNode.entity_id)
              .single();

            setRequiredRoleName(deptData?.name ? `${deptData.name} department` : null);
          } else {
            setRequiredRoleName(null);
          }
        } else {
          // For form, conditional, start, end nodes - no entity validation needed
          setHasRequiredRole(true);
          setRequiredRoleName(null);
        }
      } catch (error) {
        console.error('Error checking access permissions:', error);
        // On error, default to hiding the button for safety
        setHasRequiredRole(false);
        setIsAssignedToProject(false);
      } finally {
        setCheckingAccessPermissions(false);
      }
    }

    checkAccessPermissions();
  }, [workflowInstanceId, userProfile]);

  useEffect(() => {
    if (workflowInstanceId && dialogOpen) {
      loadWorkflowData();
    }
  }, [workflowInstanceId, dialogOpen]);

  const loadWorkflowData = async () => {
    try {
      setLoading(true);
      const supabase = createClientSupabase();
      if (!supabase) return;

      // Get workflow instance with current node
      const { data: instance, error: instanceError } = await supabase
        .from('workflow_instances')
        .select(`
          *,
          workflow_nodes!workflow_instances_current_node_id_fkey(*),
          workflow_templates(*)
        `)
        .eq('id', workflowInstanceId)
        .single();

      if (instanceError || !instance) {
        console.error('Error loading workflow instance:', instanceError);
        return;
      }

      setWorkflowInstance(instance);

      // Check for form data - either from form_template_id or inline in settings
      const currentNodeData = instance.workflow_nodes;
      let formLoaded = false;

      // First, check if there's an inline form in the node settings (workflow builder stores forms here)
      if (currentNodeData?.settings?.formFields && currentNodeData.settings.formFields.length > 0) {
        // Build a form template from the inline settings
        const inlineTemplate: FormTemplate = {
          id: `inline-${currentNodeData.id}`,
          name: currentNodeData.settings.formName || currentNodeData.label || 'Form',
          description: currentNodeData.settings.formDescription || null,
          fields: currentNodeData.settings.formFields.map((field: any) => ({
            id: field.id,
            type: field.type === 'select' ? 'dropdown' : field.type, // Map 'select' to 'dropdown'
            label: field.label,
            required: field.required || false,
            placeholder: field.placeholder || '',
            options: field.options || [],
            defaultValue: field.defaultValue,
            validation: field.validation,
            conditional: field.conditional,
          })),
        };

        setFormTemplate(inlineTemplate);
        formLoaded = true;

        // Initialize form data with default values
        const initialData: Record<string, any> = {};
        for (const field of inlineTemplate.fields) {
          if (field.defaultValue !== undefined) {
            initialData[field.id] = field.defaultValue;
          } else if (field.type === 'checkbox') {
            initialData[field.id] = false;
          } else if (field.type === 'multiselect') {
            initialData[field.id] = [];
          } else {
            initialData[field.id] = '';
          }
        }
        setFormData(initialData);
      }
      // If no inline form, check for a linked form template
      else if (currentNodeData?.form_template_id) {
        const { data: template, error: templateError } = await supabase
          .from('form_templates')
          .select('*')
          .eq('id', currentNodeData.form_template_id)
          .single();

        if (template && !templateError) {
          setFormTemplate(template);
          formLoaded = true;

          // Initialize form data with default values
          const initialData: Record<string, any> = {};
          for (const field of (template.fields as FormField[]) || []) {
            if (field.defaultValue !== undefined) {
              initialData[field.id] = field.defaultValue;
            } else if (field.type === 'checkbox') {
              initialData[field.id] = false;
            } else if (field.type === 'multiselect') {
              initialData[field.id] = [];
            } else {
              initialData[field.id] = '';
            }
          }
          setFormData(initialData);
        }
      }

      // Clear form state if no form found
      if (!formLoaded) {
        setFormTemplate(null);
        setFormData({});
      }

      // Get next node preview
      if (instance.current_node_id) {
        const { data: connections } = await supabase
          .from('workflow_connections')
          .select('to_node_id')
          .eq('workflow_template_id', instance.workflow_template_id)
          .eq('from_node_id', instance.current_node_id);

        if (connections && connections.length > 0) {
          const { data: nextNodeData } = await supabase
            .from('workflow_nodes')
            .select('*')
            .eq('id', connections[0].to_node_id)
            .single();

          if (nextNodeData) {
            setNextNode(nextNodeData);

            // Fetch users for the next node's role/department
            if (nextNodeData.entity_id) {
              const { data: userRoles } = await supabase
                .from('user_roles')
                .select(`
                  user_id,
                  users!user_roles_user_id_fkey(id, name, email)
                `)
                .eq('role_id', nextNodeData.entity_id);

              if (userRoles) {
                const users = userRoles
                  .map((ur: any) => ur.users)
                  .filter((u: any) => u !== null);
                setAvailableUsers(users);
              }
            }
          }
        }
      }
    } catch (error) {
      console.error('Error loading workflow data:', error);
    } finally {
      setLoading(false);
    }
  };

  // Helper to check if a field should be visible based on conditional logic
  const isFieldVisible = (field: FormField): boolean => {
    if (!field.conditional) return true;
    const conditionalFieldValue = formData[field.conditional.show_if];
    return conditionalFieldValue === field.conditional.equals;
  };

  // Validate form data
  const validateFormData = (): string | null => {
    if (!formTemplate) return null;

    for (const field of formTemplate.fields) {
      // Skip hidden fields
      if (!isFieldVisible(field)) continue;

      const value = formData[field.id];

      // Check required fields
      if (field.required) {
        if (value === undefined || value === null || value === '' ||
            (Array.isArray(value) && value.length === 0)) {
          return `${field.label} is required`;
        }
      }

      // Type-specific validation
      if (value !== undefined && value !== null && value !== '') {
        switch (field.type) {
          case 'email':
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(String(value))) {
              return `${field.label} must be a valid email address`;
            }
            break;
          case 'number':
            if (isNaN(Number(value))) {
              return `${field.label} must be a number`;
            }
            if (field.validation?.min !== undefined && Number(value) < field.validation.min) {
              return `${field.label} must be at least ${field.validation.min}`;
            }
            if (field.validation?.max !== undefined && Number(value) > field.validation.max) {
              return `${field.label} must be at most ${field.validation.max}`;
            }
            break;
        }
      }
    }

    return null;
  };

  const handleProgressWorkflow = async () => {
    if (!workflowInstanceId) return;

    const currentNode = workflowInstance?.workflow_nodes;
    if (!currentNode) return;

    // For approval nodes, decision is required
    if (currentNode.node_type === 'approval' && !decision) {
      toast.error('Please select an approval decision');
      return;
    }

    // For form nodes, validate the form data
    if (formTemplate) {
      const validationError = validateFormData();
      if (validationError) {
        toast.error(validationError);
        return;
      }
    }

    // User assignment is required when there are available users
    if (availableUsers.length > 0 && !selectedUserId) {
      toast.error('Please select a user to assign this project to');
      return;
    }

    try {
      setSubmitting(true);

      let formResponseId: string | undefined;
      let inlineFormData: Record<string, any> | undefined;

      // If there's a form, handle it
      if (formTemplate) {
        // Check if this is an inline form (stored in node settings) or a linked form template
        const isInlineForm = formTemplate.id.startsWith('inline-');

        if (isInlineForm) {
          // For inline forms, pass the form data directly to the workflow progress endpoint
          inlineFormData = {
            formName: formTemplate.name,
            formDescription: formTemplate.description,
            fields: formTemplate.fields,
            responses: formData,
          };
        } else {
          // For linked form templates, submit to the form_responses table
          const formResponse = await fetch('/api/workflows/forms/responses', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              formTemplateId: formTemplate.id,
              responseData: formData,
            }),
          });

          const formResult = await formResponse.json();

          if (!formResponse.ok || formResult.error) {
            throw new Error(formResult.error || 'Failed to submit form');
          }

          formResponseId = formResult.id;
        }
      }

      const response = await fetch('/api/workflows/progress', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workflowInstanceId,
          decision,
          feedback,
          assignedUserId: selectedUserId || undefined,
          formResponseId,
          formData: inlineFormData, // Include inline form data if present
        }),
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to progress workflow');
      }

      toast.success('Project sent to next step successfully');
      setDialogOpen(false);
      setDecision(undefined);
      setFeedback('');
      setFormData({});
      setFormTemplate(null);
      setSelectedUserId('');

      // Reset workflow state to hide button immediately
      setWorkflowInstance(null);
      setNextNode(null);
      setAvailableUsers([]);

      // Call parent callback to trigger refresh
      onProgress?.();

      // Refresh server data
      router.refresh();
    } catch (error: any) {
      console.error('Error progressing workflow:', error);
      toast.error(error.message || 'Failed to progress workflow');
    } finally {
      setSubmitting(false);
    }
  };

  // Don't show button if no workflow instance
  if (!workflowInstanceId) {
    return null;
  }

  // Don't show button while checking permissions (either EXECUTE_WORKFLOWS or role/assignment)
  if (checkingPermissions || checkingAccessPermissions) {
    return (
      <Button disabled className="gap-2" size="lg">
        <Loader2 className="w-4 h-4 animate-spin" />
        Loading...
      </Button>
    );
  }

  // Don't show button if user doesn't have permission
  if (!canExecuteWorkflows) {
    return null;
  }

  // Don't show button if user is not assigned to the project
  if (!isAssignedToProject) {
    return null;
  }

  // Don't show button if user doesn't have the required role for this workflow step
  if (!hasRequiredRole) {
    return null;
  }

  const currentNode = workflowInstance?.workflow_nodes;
  const isApprovalNode = currentNode?.node_type === 'approval';
  const isFormNode = currentNode?.node_type === 'form';
  // formTemplate is loaded from either inline settings or linked form_template_id
  const hasFormTemplate = formTemplate !== null;

  return (
    <>
      <Button
        onClick={() => setDialogOpen(true)}
        className="gap-2"
        size="lg"
      >
        <Send className="w-4 h-4" />
        Send to Next Step
      </Button>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
          <DialogHeader className="flex-shrink-0">
            <DialogTitle className="flex items-center gap-2">
              <ArrowRight className="w-5 h-5" />
              Progress Workflow
            </DialogTitle>
            <DialogDescription>
              {isApprovalNode
                ? 'Review and approve or reject this project'
                : isFormNode
                ? 'Complete the required form before progressing'
                : 'Send this project to the next workflow step'}
            </DialogDescription>
          </DialogHeader>

          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
            </div>
          ) : (
            <div className="space-y-4 py-4 overflow-y-auto flex-1 min-h-0">
              {/* Current Step */}
              <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <Label className="text-sm font-medium text-blue-900">Current Step</Label>
                <div className="flex items-center gap-2 mt-1">
                  <Badge className="bg-blue-100 text-blue-800">
                    {currentNode?.node_type}
                  </Badge>
                  <span className="font-medium">{currentNode?.label}</span>
                </div>
                {workflowInstance?.workflow_templates && (
                  <p className="text-xs text-blue-700 mt-1">
                    Workflow: {workflowInstance.workflow_templates.name}
                  </p>
                )}
              </div>

              {/* Next Step Preview */}
              {nextNode && (
                <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                  <Label className="text-sm font-medium text-green-900">Next Step</Label>
                  <div className="flex items-center gap-2 mt-1">
                    <ArrowRight className="w-4 h-4 text-green-600" />
                    <Badge className="bg-green-100 text-green-800">
                      {nextNode.node_type}
                    </Badge>
                    <span className="font-medium">{nextNode.label}</span>
                  </div>
                </div>
              )}

              {/* User Assignment Selection */}
              {availableUsers.length > 0 && (
                <div className="space-y-2">
                  <Label htmlFor="assign-user">Assign To *</Label>
                  <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a user to assign" />
                    </SelectTrigger>
                    <SelectContent>
                      {availableUsers.map((user) => (
                        <SelectItem key={user.id} value={user.id}>
                          {nextNode?.label} - {user.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-gray-500">
                    Select the user who will handle this project at the next step
                  </p>
                </div>
              )}

              {/* Approval Decision (for approval nodes) */}
              {isApprovalNode && (
                <div className="space-y-3">
                  <Label>Decision *</Label>
                  <div className="grid grid-cols-3 gap-2">
                    <Button
                      type="button"
                      variant={decision === 'approved' ? 'default' : 'outline'}
                      onClick={() => setDecision('approved')}
                      className="flex items-center gap-2"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      Approve
                    </Button>
                    <Button
                      type="button"
                      variant={decision === 'needs_changes' ? 'default' : 'outline'}
                      onClick={() => setDecision('needs_changes')}
                      className="flex items-center gap-2"
                    >
                      <AlertCircle className="w-4 h-4" />
                      Needs Changes
                    </Button>
                    <Button
                      type="button"
                      variant={decision === 'rejected' ? 'destructive' : 'outline'}
                      onClick={() => setDecision('rejected')}
                      className="flex items-center gap-2"
                    >
                      <XCircle className="w-4 h-4" />
                      Reject
                    </Button>
                  </div>
                </div>
              )}

              {/* Feedback/Notes */}
              {(isApprovalNode || currentNode?.settings?.allow_feedback) && (
                <div className="space-y-2">
                  <Label htmlFor="feedback">
                    {isApprovalNode ? 'Feedback (Optional)' : 'Notes (Optional)'}
                  </Label>
                  <Textarea
                    id="feedback"
                    value={feedback}
                    onChange={(e) => setFeedback(e.target.value)}
                    placeholder={
                      isApprovalNode
                        ? 'Provide feedback or comments...'
                        : 'Add any notes about the handoff...'
                    }
                    rows={4}
                  />
                </div>
              )}

              {/* Form Fields (for nodes with form templates) */}
              {formTemplate && (
                <div className="space-y-4">
                  <div className="flex items-center gap-2 pb-2 border-b">
                    <FileText className="w-5 h-5 text-purple-600" />
                    <div>
                      <h4 className="font-medium text-purple-900">{formTemplate.name}</h4>
                      {formTemplate.description && (
                        <p className="text-xs text-purple-700">{formTemplate.description}</p>
                      )}
                    </div>
                  </div>

                  {formTemplate.fields.map((field) => {
                    // Check conditional visibility
                    if (!isFieldVisible(field)) return null;

                    return (
                      <div key={field.id} className="space-y-2">
                        <Label htmlFor={`form-${field.id}`}>
                          {field.label}
                          {field.required && <span className="text-red-500 ml-1">*</span>}
                        </Label>

                        {/* Text Input */}
                        {field.type === 'text' && (
                          <Input
                            id={`form-${field.id}`}
                            type="text"
                            placeholder={field.placeholder}
                            value={formData[field.id] || ''}
                            onChange={(e) => setFormData({ ...formData, [field.id]: e.target.value })}
                          />
                        )}

                        {/* Email Input */}
                        {field.type === 'email' && (
                          <Input
                            id={`form-${field.id}`}
                            type="email"
                            placeholder={field.placeholder || 'email@example.com'}
                            value={formData[field.id] || ''}
                            onChange={(e) => setFormData({ ...formData, [field.id]: e.target.value })}
                          />
                        )}

                        {/* Number Input */}
                        {field.type === 'number' && (
                          <Input
                            id={`form-${field.id}`}
                            type="number"
                            placeholder={field.placeholder}
                            min={field.validation?.min}
                            max={field.validation?.max}
                            value={formData[field.id] || ''}
                            onChange={(e) => setFormData({ ...formData, [field.id]: e.target.value })}
                          />
                        )}

                        {/* Date Input */}
                        {field.type === 'date' && (
                          <Input
                            id={`form-${field.id}`}
                            type="date"
                            value={formData[field.id] || ''}
                            onChange={(e) => setFormData({ ...formData, [field.id]: e.target.value })}
                          />
                        )}

                        {/* Textarea */}
                        {field.type === 'textarea' && (
                          <Textarea
                            id={`form-${field.id}`}
                            placeholder={field.placeholder}
                            value={formData[field.id] || ''}
                            onChange={(e) => setFormData({ ...formData, [field.id]: e.target.value })}
                            rows={4}
                          />
                        )}

                        {/* Dropdown Select */}
                        {field.type === 'dropdown' && field.options && (
                          <Select
                            value={formData[field.id] || ''}
                            onValueChange={(value) => setFormData({ ...formData, [field.id]: value })}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder={field.placeholder || 'Select an option'} />
                            </SelectTrigger>
                            <SelectContent>
                              {field.options.map((option) => (
                                <SelectItem key={option} value={option}>
                                  {option}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        )}

                        {/* Checkbox */}
                        {field.type === 'checkbox' && (
                          <div className="flex items-center space-x-2">
                            <Checkbox
                              id={`form-${field.id}`}
                              checked={formData[field.id] || false}
                              onCheckedChange={(checked) => setFormData({ ...formData, [field.id]: checked })}
                            />
                            <label
                              htmlFor={`form-${field.id}`}
                              className="text-sm text-gray-600 cursor-pointer"
                            >
                              {field.placeholder || 'Yes'}
                            </label>
                          </div>
                        )}

                        {/* Multiselect (as multiple checkboxes) */}
                        {field.type === 'multiselect' && field.options && (
                          <div className="space-y-2">
                            {field.options.map((option) => (
                              <div key={option} className="flex items-center space-x-2">
                                <Checkbox
                                  id={`form-${field.id}-${option}`}
                                  checked={(formData[field.id] || []).includes(option)}
                                  onCheckedChange={(checked) => {
                                    const currentValues = formData[field.id] || [];
                                    const newValues = checked
                                      ? [...currentValues, option]
                                      : currentValues.filter((v: string) => v !== option);
                                    setFormData({ ...formData, [field.id]: newValues });
                                  }}
                                />
                                <label
                                  htmlFor={`form-${field.id}-${option}`}
                                  className="text-sm text-gray-600 cursor-pointer"
                                >
                                  {option}
                                </label>
                              </div>
                            ))}
                          </div>
                        )}

                        {/* File Input (placeholder - requires backend file handling) */}
                        {field.type === 'file' && (
                          <div className="p-4 bg-gray-50 border border-dashed border-gray-300 rounded-lg text-center">
                            <p className="text-sm text-gray-500">
                              File upload coming soon
                            </p>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Show message if form node but form template not found */}
              {isFormNode && !formTemplate && !loading && (
                <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <p className="text-sm text-yellow-800">
                    This step requires a form, but no form template has been configured for this workflow node.
                  </p>
                </div>
              )}
            </div>
          )}

          <DialogFooter className="flex-shrink-0 border-t pt-4 mt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => setDialogOpen(false)}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button
              onClick={handleProgressWorkflow}
              disabled={submitting || loading || (isApprovalNode && !decision)}
            >
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <Send className="w-4 h-4 mr-2" />
                  {isApprovalNode
                    ? `${decision === 'approved' ? 'Approve' : decision === 'rejected' ? 'Reject' : 'Request Changes'} & Send`
                    : 'Send to Next Step'}
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
