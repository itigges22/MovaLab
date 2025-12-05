'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Loader2 } from 'lucide-react';
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

  useEffect(() => {
    loadData();
  }, [templateId]);

  const loadData = async () => {
    try {
      setLoading(true);

      // Load template details
      const templateRes = await fetch(`/api/admin/workflows/templates`);
      const templateData = await templateRes.json();
      if (templateData.success) {
        const foundTemplate = templateData.templates.find((t: WorkflowTemplate) => t.id === templateId);
        setTemplate(foundTemplate || null);
      }

      // Load departments
      const deptRes = await fetch('/api/org-structure/departments');
      const deptData = await deptRes.json();
      console.log('Workflow Editor - Loaded departments:', deptData);
      if (deptData.success) {
        setDepartments(deptData.departments || []);
        console.log('Workflow Editor - Set departments:', deptData.departments?.length || 0);
      }

      // Load roles
      const roleRes = await fetch('/api/org-structure/roles');
      const roleData = await roleRes.json();
      console.log('Workflow Editor - Loaded roles:', roleData);
      if (roleData.success) {
        setRoles(roleData.roles || []);
        console.log('Workflow Editor - Set roles:', roleData.roles?.length || 0);
      }

      // Load existing workflow nodes and connections
      const workflowRes = await fetch(`/api/admin/workflows/templates/${templateId}`);
      const workflowData = await workflowRes.json();

      if (workflowData.success && workflowData.template?.nodes && workflowData.template.nodes.length > 0) {
        // Convert workflow_nodes to React Flow nodes
        const nodes: Node<WorkflowNodeData>[] = workflowData.template.nodes.map((node: any) => {
          const config: any = {};

          // Handle department nodes
          if (node.settings?.department_id) {
            config.departmentId = node.settings.department_id;
            config.departmentName = departments.find(d => d.id === node.settings.department_id)?.name;
          }

          // Handle role and approval nodes with entity_id
          if (node.entity_id) {
            if (node.node_type === 'role') {
              config.roleId = node.entity_id;
              config.roleName = roles.find(r => r.id === node.entity_id)?.name;
            } else if (node.node_type === 'approval') {
              config.approverRoleId = node.entity_id;
              config.approverRoleName = roles.find(r => r.id === node.entity_id)?.name;
              config.requiredApprovals = node.settings?.required_approvals || 1;
              config.allowFeedback = node.settings?.allow_feedback !== undefined ? node.settings.allow_feedback : true;
              config.allowSendBack = node.settings?.allow_send_back !== undefined ? node.settings.allow_send_back : true;
            }
          }

          // Handle form nodes
          if (node.node_type === 'form') {
            config.formTemplateId = node.form_template_id;
            config.formTemplateName = 'Form Template'; // TODO: Load from form_templates
            config.allowAttachments = node.settings?.allow_attachments || false;
            config.formFields = node.settings?.formFields || [];
            config.formName = node.settings?.formName || '';
            config.formDescription = node.settings?.formDescription || '';
            config.isDraftForm = node.settings?.isDraftForm || false;
          }

          // Handle conditional nodes
          if (node.node_type === 'conditional') {
            config.conditionType = node.settings?.condition_type || 'approval_decision';
            config.conditions = node.settings?.conditions || [];
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
            id: `${conn.from_node_id}-${conn.to_node_id}`,
            source: conn.from_node_id,
            target: conn.to_node_id,
            type: conn.condition ? 'labeled' : 'smoothstep',
          };

          // Add condition data if present (for decision-based routing)
          if (conn.condition) {
            edge.data = {
              label: conn.condition.label,
              conditionValue: conn.condition.conditionValue,
              conditionType: conn.condition.conditionType,
              decision: conn.condition.decision,  // For approval node routing
            };
          }

          return edge;
        });

        setInitialNodes(nodes);
        setInitialEdges(edges);
      }
    } catch (error) {
      console.error('Error loading workflow editor data:', error);
      toast.error('Failed to load workflow editor');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (nodes: Node<WorkflowNodeData>[], edges: Edge[]) => {
    try {
      const response = await fetch(`/api/admin/workflows/templates/${templateId}/steps`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nodes, edges }),
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to save workflow');
      }
    } catch (error) {
      console.error('Error saving workflow:', error);
      throw error;
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
              <h1 className="text-2xl font-bold">{template.name}</h1>
              {template.description && (
                <p className="text-sm text-gray-600 mt-1">{template.description}</p>
              )}
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
