'use client';

import { memo } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { User, FolderKanban, Building2 } from 'lucide-react';

interface NetworkNodeData {
  label: string;
  type: 'user' | 'project' | 'account';
  hoursLogged?: number;
  status?: string;
  projectCount?: number;
  serviceTier?: string;
  email?: string;
  role?: string;
}

const statusColors: Record<string, string> = {
  planning: '#787878',
  in_progress: '#007EE5',
  review: '#647878',
  complete: '#4A5D3A',
  on_hold: '#3D464D',
  active: '#4A5D3A',
  inactive: '#787878',
};

const typeStyles: Record<string, { bg: string; border: string; icon: React.ComponentType<{ className?: string }> }> = {
  user: {
    bg: 'bg-[#007EE5]/10 dark:bg-[#007EE5]/20',
    border: 'border-[#007EE5]/40 dark:border-[#007EE5]/60',
    icon: User,
  },
  project: {
    bg: 'bg-[#4A5D3A]/10 dark:bg-[#4A5D3A]/20',
    border: 'border-[#4A5D3A]/40 dark:border-[#4A5D3A]/60',
    icon: FolderKanban,
  },
  account: {
    bg: 'bg-[#647878]/10 dark:bg-[#647878]/20',
    border: 'border-[#647878]/40 dark:border-[#647878]/60',
    icon: Building2,
  },
};

function NetworkNodeComponent({ data, selected }: NodeProps) {
  const nodeData = data as unknown as NetworkNodeData;
  const style = typeStyles[nodeData.type] || typeStyles.user;
  const Icon = style.icon;
  const statusColor = nodeData.status ? statusColors[nodeData.status] || '#94a3b8' : undefined;

  return (
    <>
      {/* Input handle for incoming connections */}
      <Handle
        type="target"
        position={Position.Top}
        className="!bg-slate-400 !w-2 !h-2"
      />

      <div
        className={`
          px-3 py-2 rounded-lg border-2 shadow-md
          transition-all duration-200
          ${style.bg} ${style.border}
          ${selected ? 'ring-2 ring-primary ring-offset-2' : ''}
          hover:shadow-lg cursor-pointer
        `}
      >
        <div className="flex items-center gap-2">
          <div className={`p-1.5 rounded-full ${style.bg}`}>
            <Icon className="h-4 w-4" />
          </div>
          <div className="flex flex-col">
            <span className="text-sm font-medium leading-tight">
              {nodeData.label}
            </span>
            {nodeData.type === 'user' && nodeData.hoursLogged !== undefined && (
              <span className="text-xs text-muted-foreground">
                {nodeData.hoursLogged}h logged
              </span>
            )}
            {nodeData.type === 'user' && nodeData.role && (
              <span className="text-xs text-muted-foreground">
                {nodeData.role}
              </span>
            )}
            {nodeData.type === 'project' && nodeData.status && (
              <div className="flex items-center gap-1">
                <div
                  className="w-2 h-2 rounded-full"
                  style={{ backgroundColor: statusColor }}
                />
                <span className="text-xs text-muted-foreground capitalize">
                  {nodeData.status.replace('_', ' ')}
                </span>
              </div>
            )}
            {nodeData.type === 'account' && nodeData.projectCount !== undefined && (
              <span className="text-xs text-muted-foreground">
                {nodeData.projectCount} project{nodeData.projectCount !== 1 ? 's' : ''}
              </span>
            )}
            {nodeData.type === 'account' && nodeData.serviceTier && (
              <span className="text-xs text-muted-foreground capitalize">
                {nodeData.serviceTier}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Output handle for outgoing connections */}
      <Handle
        type="source"
        position={Position.Bottom}
        className="!bg-slate-400 !w-2 !h-2"
      />
    </>
  );
}

export const NetworkNode = memo(NetworkNodeComponent);
