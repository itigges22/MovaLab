'use client';

import { GitBranch, Users, UserCheck, Play, Flag, FileText, GitMerge } from 'lucide-react';
import { WorkflowNodeType } from './workflow-node';

interface NodeTypeConfig {
  type: WorkflowNodeType;
  label: string;
  icon: any;
  description: string;
  bgColor: string;
  borderColor: string;
}

const nodeTypes: NodeTypeConfig[] = [
  {
    type: 'start',
    label: 'Start',
    icon: Play,
    description: 'Entry point: Where every workflow begins. Only one per workflow.',
    bgColor: 'bg-green-50',
    borderColor: 'border-green-500',
  },
  {
    type: 'department',
    label: 'Department',
    icon: GitBranch,
    description: 'Route work to an entire department. All members can see it.',
    bgColor: 'bg-blue-50',
    borderColor: 'border-blue-500',
  },
  {
    type: 'role',
    label: 'Role',
    icon: Users,
    description: 'Assign to specific role (e.g., Video Editor, Designer). Requires selecting a team member.',
    bgColor: 'bg-purple-50',
    borderColor: 'border-purple-500',
  },
  {
    type: 'approval',
    label: 'Approval',
    icon: UserCheck,
    description: 'Approval gate: Requires Approve/Reject/Needs Changes decision before proceeding.',
    bgColor: 'bg-amber-50',
    borderColor: 'border-amber-500',
  },
  {
    type: 'form',
    label: 'Form',
    icon: FileText,
    description: 'Collect structured data via form. User fills out fields before continuing.',
    bgColor: 'bg-cyan-50',
    borderColor: 'border-cyan-500',
  },
  {
    type: 'conditional',
    label: 'Conditional',
    icon: GitMerge,
    description: 'Smart routing: Different paths based on previous decision (e.g., if approved → delivery, if rejected → revisions).',
    bgColor: 'bg-pink-50',
    borderColor: 'border-pink-500',
  },
  {
    type: 'end',
    label: 'End',
    icon: Flag,
    description: 'Completion point: Marks workflow as done. Every workflow needs at least one.',
    bgColor: 'bg-gray-50',
    borderColor: 'border-gray-500',
  },
];

export function NodeSidebar() {
  const onDragStart = (event: React.DragEvent, nodeType: WorkflowNodeType) => {
    event.dataTransfer.setData('application/reactflow', nodeType);
    event.dataTransfer.effectAllowed = 'move';
  };

  return (
    <div className="w-64 bg-white border-r border-gray-200 p-4 overflow-y-auto h-full">
      <h3 className="font-semibold text-sm text-gray-700 mb-3">Workflow Nodes</h3>
      <div className="space-y-2">
        {nodeTypes.map((nodeType) => {
          const Icon = nodeType.icon;
          return (
            <div
              key={nodeType.type}
              draggable
              onDragStart={(e) => onDragStart(e, nodeType.type)}
              className={`
                p-3 rounded-lg border-2 cursor-move
                ${nodeType.bgColor} ${nodeType.borderColor}
                hover:shadow-md transition-shadow duration-200
              `}
            >
              <div className="flex items-center gap-2 mb-1">
                <Icon className="w-4 h-4" />
                <span className="font-medium text-sm">{nodeType.label}</span>
              </div>
              <p className="text-xs text-gray-600">{nodeType.description}</p>
            </div>
          );
        })}
      </div>

      {/* Tutorial Section */}
      <div className="mt-6 space-y-3">
        <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
          <p className="text-xs font-semibold text-blue-900 mb-2">Getting Started</p>
          <ul className="text-xs text-blue-800 space-y-1">
            <li>1. Drag <strong>Start</strong> node first</li>
            <li>2. Add <strong>Role</strong> or <strong>Approval</strong> nodes</li>
            <li>3. Connect nodes by dragging handles</li>
            <li>4. Double-click to configure each node</li>
            <li>5. Add <strong>End</strong> node to finish</li>
          </ul>
        </div>

        <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
          <p className="text-xs font-semibold text-amber-900 mb-2">Common Patterns</p>
          <ul className="text-xs text-amber-800 space-y-1">
            <li><strong>Review Loop:</strong> Role → Approval → Conditional (if rejected, back to Role)</li>
            <li><strong>Sequential Steps:</strong> Role → Role → Role → End</li>
            <li><strong>Quality Gate:</strong> Role → Approval → End</li>
          </ul>
        </div>

        <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
          <p className="text-xs font-semibold text-green-900 mb-2">Best Practices</p>
          <ul className="text-xs text-green-800 space-y-1">
            <li>✓ Every workflow needs Start + End</li>
            <li>✓ All nodes must be connected</li>
            <li>✓ Configure nodes after adding them</li>
            <li>✓ Use Conditional after Approval for smart routing</li>
            <li>✗ Avoid circular loops (infinite cycles)</li>
          </ul>
        </div>

        <div className="p-3 bg-purple-50 border border-purple-200 rounded-lg">
          <p className="text-xs font-semibold text-purple-900 mb-2">Example: Video Project</p>
          <p className="text-xs text-purple-800">
            Start → Pre-Production (Role: Creative Director) → Approval (PM) → Production (Role: Producer) → Post-Production (Role: Editor) → Review (Approval: Creative Director) → End
          </p>
        </div>
      </div>
    </div>
  );
}
