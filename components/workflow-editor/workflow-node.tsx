'use client';

import { memo } from 'react';
import { Handle, Position, NodeProps } from '@xyflow/react';
import { GitBranch, Users, UserCheck, CheckCircle, Play, Flag, FileText, GitMerge, HelpCircle } from 'lucide-react';
import { Tooltip } from '@/components/ui/tooltip';

export type WorkflowNodeType = 'start' | 'department' | 'role' | 'approval' | 'form' | 'conditional' | 'end';

export interface WorkflowNodeData {
  label: string;
  type: WorkflowNodeType;
  config?: {
    departmentId?: string;
    departmentName?: string;
    roleId?: string;
    roleName?: string;
    approverRoleId?: string;
    approverRoleName?: string;
    requiredApprovals?: number;
    // Form node config
    formTemplateId?: string;
    formTemplateName?: string;
    allowAttachments?: boolean;
    // Inline form config (stored directly in node, not in form_templates)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    formFields?: any[];
    formName?: string;
    formDescription?: string;
    isDraftForm?: boolean;
    // Conditional node config
    conditionType?: 'approval_decision' | 'form_value' | 'custom';
    conditions?: Array<{
      label: string;
      value: string;
      color?: string;
    }>;
    // Approval feedback
    allowFeedback?: boolean;
    allowSendBack?: boolean;
  };
  [key: string]: unknown;
}

const nodeStyles: Record<WorkflowNodeType, { bg: string; border: string; icon: any; description: string }> = {
  start: {
    bg: 'bg-green-50',
    border: 'border-green-500',
    icon: Play,
    description: 'Entry point: Where every workflow begins. Only one per workflow.',
  },
  department: {
    bg: 'bg-blue-50',
    border: 'border-blue-500',
    icon: GitBranch,
    description: 'Route work to an entire department. All members can see it.',
  },
  role: {
    bg: 'bg-purple-50',
    border: 'border-purple-500',
    icon: Users,
    description: 'Assign to specific role (e.g., Video Editor, Designer). Requires selecting a team member.',
  },
  approval: {
    bg: 'bg-amber-50',
    border: 'border-amber-500',
    icon: UserCheck,
    description: 'Approval gate: Requires Approve/Reject/Needs Changes decision before proceeding.',
  },
  form: {
    bg: 'bg-cyan-50',
    border: 'border-cyan-500',
    icon: FileText,
    description: 'Collect structured data via form. User fills out fields before continuing.',
  },
  conditional: {
    bg: 'bg-pink-50',
    border: 'border-pink-500',
    icon: GitMerge,
    description: 'Smart routing: Different paths based on previous decision (e.g., if approved → delivery, if rejected → revisions).',
  },
  end: {
    bg: 'bg-gray-50',
    border: 'border-gray-500',
    icon: Flag,
    description: 'Completion point: Marks workflow as done. Every workflow needs at least one.',
  },
};

export const WorkflowNode = memo(({ data, selected }: NodeProps) => {
  // Cast data to our expected type
  const nodeData = data as WorkflowNodeData;
  const style = nodeStyles[nodeData.type];
  const Icon = style.icon;

  return (
    <div
      className={`
        px-4 py-3 rounded-lg border-2 shadow-md min-w-[180px] relative
        ${style.bg} ${style.border}
        ${selected ? 'ring-2 ring-offset-2 ring-blue-500' : ''}
        transition-all duration-200 hover:shadow-lg
      `}
    >
      {/* Input Handle (except for start) */}
      {nodeData.type !== 'start' && (
        <Handle
          type="target"
          position={Position.Top}
          className="w-3 h-3 !bg-gray-400 border-2 border-white"
        />
      )}

      {/* Info Icon in top-right corner */}
      <Tooltip
        content={<p className="text-xs">{style.description}</p>}
        side="right"
        delayDuration={300}
      >
        <div className="absolute top-1 right-1 cursor-help">
          <HelpCircle className="w-3.5 h-3.5 text-gray-500 hover:text-gray-700" />
        </div>
      </Tooltip>

        {/* Node Content */}
        <div className="flex items-center gap-2">
          <Icon className="w-5 h-5 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="font-semibold text-sm truncate">{nodeData.label}</div>
            {nodeData.config?.departmentName && (
              <div className="text-xs text-gray-600 truncate">{nodeData.config.departmentName}</div>
            )}
            {nodeData.config?.roleName && (
              <div className="text-xs text-gray-600 truncate">{nodeData.config.roleName}</div>
            )}
            {nodeData.config?.approverRoleName && (
              <div className="text-xs text-gray-600 truncate">
                Approver: {nodeData.config.approverRoleName}
              </div>
            )}
            {nodeData.config?.requiredApprovals && (
              <div className="text-xs text-gray-600">
                {nodeData.config.requiredApprovals} approval{nodeData.config.requiredApprovals > 1 ? 's' : ''} required
              </div>
            )}
            {nodeData.config?.formTemplateName && (
              <div className="text-xs text-gray-600 truncate">Form: {nodeData.config.formTemplateName}</div>
            )}
            {nodeData.config?.conditionType && (
              <div className="text-xs text-gray-600 truncate">
                {nodeData.config.conditionType === 'approval_decision' && 'Routes by approval'}
                {nodeData.config.conditionType === 'form_value' && 'Routes by form value'}
                {nodeData.config.conditionType === 'custom' && 'Custom routing'}
              </div>
            )}
          </div>
        </div>

      {/* Output Handle (except for end) */}
      {nodeData.type !== 'end' && (
        <Handle
          type="source"
          position={Position.Bottom}
          className="w-3 h-3 !bg-gray-400 border-2 border-white"
        />
      )}
    </div>
  );
});

WorkflowNode.displayName = 'WorkflowNode';
