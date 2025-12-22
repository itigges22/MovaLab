'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { ArrowLeft, Loader2, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import type { Node, Edge } from '@xyflow/react';
import type { WorkflowNodeData } from '@/components/workflow-editor/workflow-node';

// Dynamically import WorkflowCanvas with SSR disabled
const WorkflowCanvas = dynamic(
  () => import('@/components/workflow-editor/workflow-canvas').then(mod => ({ default: mod.WorkflowCanvas })),
  {
    ssr: false,
    loading: () => (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-2" />
          <p className="text-sm text-gray-500">Loading workflow editor...</p>
        </div>
      </div>
    ),
  }
);

interface Department {
  id: string;
  name: string;
}

interface Role {
  id: string;
  name: string;
  department_id: string;
}

interface WorkflowTemplate {
  id: string;
  name: string;
  description: string | null;
  is_active: boolean;
}

export default function WorkflowEditorPage() {
  const params = useParams();
  const router = useRouter();
  const templateId = params.id as string;

  const [loading, setLoading] = useState(true);
  const [template, setTemplate] = useState<WorkflowTemplate | null>(null);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [initialNodes, setInitialNodes] = useState<Node<WorkflowNodeData>[]>([]);
  const [initialEdges, setInitialEdges] = useState<Edge[]>([]);
  const [isActive, setIsActive] = useState(true);
  const [togglingActive, setTogglingActive] = useState(false);
  const [hasNodes, setHasNodes] = useState(false);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);

      // Load template details (including inactive ones)
      const templateRes = await fetch(`/api/admin/workflows/templates?include_inactive=true`);
      const templateData = await templateRes.json();
      if (templateData.success) {
        const foundTemplate = templateData.templates.find((t: WorkflowTemplate) => t.id === templateId);
        setTemplate(foundTemplate || null);
        setIsActive(foundTemplate?.is_active ?? true);
      }

      // Load departments
      const deptRes = await fetch('/api/org-structure/departments');
      const deptData = await deptRes.json();
      console.log('Workflow Editor - Loaded departments:', deptData);
      const fetchedDepartments = deptData.success ? (deptData.departments || []) : [];
      setDepartments(fetchedDepartments);
      console.log('Workflow Editor - Set departments:', fetchedDepartments.length);

      // Load roles
      const roleRes = await fetch('/api/org-structure/roles');
      const roleData = await roleRes.json();
      console.log('Workflow Editor - Loaded roles:', roleData);
      const fetchedRoles = roleData.success ? (roleData.roles || []) : [];
      setRoles(fetchedRoles);
      console.log('Workflow Editor - Set roles:', fetchedRoles.length);

      // Load existing workflow nodes and connections
      const workflowRes = await fetch(`/api/admin/workflows/templates/${templateId}`);
      const workflowData = await workflowRes.json();

      if (workflowData.success && workflowData.template?.nodes && workflowData.template.nodes.length > 0) {
        setHasNodes(true);
        // Convert workflow_nodes to React Flow nodes
        const nodes: Node<WorkflowNodeData>[] = workflowData.template.nodes.map((node: any) => {
          const config: Record<string, unknown> = {};
          const settings = node.settings as Record<string, unknown> | undefined;

          // Handle department nodes
          if (settings?.department_id) {
            config.departmentId = settings.department_id;
            config.departmentName = fetchedDepartments.find((d: Department) => d.id === settings.department_id)?.name;
          }

          // Handle role and approval nodes with entity_id
          if (node.entity_id) {
            if (node.node_type === 'role') {
              config.roleId = node.entity_id;
              config.roleName = fetchedRoles.find((r: Role) => r.id === node.entity_id)?.name;
            } else if (node.node_type === 'approval') {
              config.approverRoleId = node.entity_id;
              config.approverRoleName = fetchedRoles.find((r: Role) => r.id === node.entity_id)?.name;
              config.requiredApprovals = settings?.required_approvals || 1;
              config.allowFeedback = settings?.allow_feedback !== undefined ? settings.allow_feedback : true;
              config.allowSendBack = settings?.allow_send_back !== undefined ? settings.allow_send_back : true;
            }
          }

          // Handle form nodes
          if (node.node_type === 'form') {
            config.formTemplateId = node.form_template_id;
            config.formTemplateName = 'Form Template'; // TODO: Load from form_templates
            config.allowAttachments = settings?.allow_attachments || false;
            config.formFields = settings?.formFields || [];
            config.formName = settings?.formName || '';
            config.formDescription = settings?.formDescription || '';
            config.isDraftForm = settings?.isDraftForm || false;
          }

          // Handle conditional nodes
          if (node.node_type === 'conditional') {
            config.conditionType = settings?.condition_type || 'form_value';
            config.conditions = settings?.conditions || [];
            // Critical: Load sourceFormFieldId for form-based conditional routing
            config.sourceFormFieldId = settings?.sourceFormFieldId;
            config.sourceFormNodeId = settings?.sourceFormNodeId;
          }

          return {
            id: node.id,
            type: 'workflowNode',
            position: { x: node.position_x || 0, y: node.position_y || 0 },
            data: {
              label: node.label,
              type: node.node_type,
              config: Object.keys(config).length > 0 ? config : undefined,
            },
          };
        });

        // Convert workflow_connections to React Flow edges
        const edges: Edge[] = (workflowData.template.connections || []).map((conn: any) => {
          const edge: Edge = {
            // Use the connection's actual UUID if available, otherwise create a composite ID
            id: (conn.id as string) || `${conn.from_node_id as string}-${conn.to_node_id as string}`,
            source: conn.from_node_id as string,
            target: conn.to_node_id as string,
            type: conn.condition ? 'labeled' : 'labeled', // Use labeled for all edges for consistent styling
            // Restore sourceHandle for conditional branch edges
            sourceHandle: (conn.condition as Record<string, unknown> | undefined)?.sourceHandle as string | undefined || undefined,
          };

          // Add condition data if present (for decision-based routing)
          if (conn.condition) {
            const condition = conn.condition as Record<string, unknown>;
            edge.data = {
              label: condition.label,
              conditionValue: condition.conditionValue,
              conditionType: condition.conditionType,
              decision: condition.decision,  // For approval node routing
              // Critical: Load form-based conditional routing fields
              sourceFormFieldId: condition.sourceFormFieldId,
              value: condition.value,
              value2: condition.value2,
            };
          }

          return edge;
        });

        setInitialNodes(nodes);
        setInitialEdges(edges);
      }
    } catch (error: unknown) {
      console.error('Error loading workflow editor data:', error);
      toast.error('Failed to load workflow editor');
    } finally {
      setLoading(false);
    }
  }, [templateId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleSave = async (nodes: Node<WorkflowNodeData>[], edges: Edge[]) => {
    try {
      const response = await fetch(`/api/admin/workflows/templates/${templateId}/steps`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nodes, edges }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        // Build a detailed error message
        let errorMessage = data.error || 'Failed to save workflow';
        if (data.details) {
          errorMessage += `\n${data.details}`;
        }
        throw new Error(errorMessage);
      }

      // Log success info
      console.log('Workflow saved:', {
        nodeCount: data.nodeCount,
        edgeCount: data.edgeCount
      });

      // Update hasNodes based on saved count
      setHasNodes(data.nodeCount > 0);

      // If nodes were saved and is_active was auto-set, refresh the template status
      if (data.is_active !== undefined) {
        setIsActive(data.is_active);
      }
    } catch (error: unknown) {
      console.error('Error saving workflow:', error);
      throw error;
    }
  };

  const handleToggleActive = async (newIsActive: boolean) => {
    // Prevent activating if workflow has no nodes
    if (newIsActive && !hasNodes) {
      toast.error('Cannot activate workflow: No nodes configured. Please add at least a Start and End node.');
      return;
    }

    setTogglingActive(true);
    try {
      const response = await fetch(`/api/admin/workflows/templates/${templateId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: newIsActive }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to update workflow status');
      }

      setIsActive(newIsActive);
      toast.success(newIsActive ? 'Workflow activated' : 'Workflow deactivated');
    } catch (error: unknown) {
      console.error('Error toggling workflow status:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to update workflow status');
    } finally {
      setTogglingActive(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-2" />
          <p className="text-sm text-gray-500">Loading workflow editor...</p>
        </div>
      </div>
    );
  }

  if (!template) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <p className="text-gray-500">Template not found</p>
          <Button onClick={() => router.push('/admin/workflows')} className="mt-4">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Workflows
          </Button>
        </div>
      </div>
    );
  }

  // Debug log before rendering
  console.log('Workflow Editor - Rendering with:', {
    departments: departments.length,
    roles: roles.length,
    template: template?.name
  });

  return (
    <div className="flex flex-col h-screen">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => router.push('/admin/workflows')}
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back
            </Button>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-bold">{template.name}</h1>
                {!isActive && (
                  <span className="px-2 py-0.5 text-xs font-medium bg-gray-100 text-gray-600 rounded">
                    Inactive
                  </span>
                )}
              </div>
              {template.description && (
                <p className="text-sm text-gray-600 mt-1">{template.description}</p>
              )}
            </div>
          </div>

          {/* Activation Toggle */}
          <div className="flex items-center gap-4">
            {!hasNodes && (
              <div className="flex items-center gap-2 text-amber-600 text-sm">
                <AlertTriangle className="w-4 h-4" />
                <span>No nodes configured</span>
              </div>
            )}
            <div className="flex items-center gap-2">
              <Switch
                id="workflow-active"
                checked={isActive}
                onCheckedChange={handleToggleActive}
                disabled={togglingActive || (!hasNodes && !isActive)}
              />
              <Label
                htmlFor="workflow-active"
                className={`text-sm cursor-pointer ${togglingActive ? 'opacity-50' : ''}`}
              >
                {togglingActive ? 'Updating...' : isActive ? 'Active' : 'Inactive'}
              </Label>
            </div>
          </div>
        </div>
      </div>

      {/* Workflow Canvas */}
      <div className="flex-1 overflow-hidden">
        <WorkflowCanvas
          templateId={templateId}
          initialNodes={initialNodes}
          initialEdges={initialEdges}
          departments={departments}
          roles={roles}
          onSave={handleSave}
        />
      </div>
    </div>
  );
}
