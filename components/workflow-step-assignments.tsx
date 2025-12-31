'use client';

import { useState } from 'react';
import useSWR, { mutate } from 'swr';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { UserPlus, Users, X, Loader2, Check } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface Assignment {
  id: string;
  node_id: string;
  user_id: string;
  assigned_at: string;
  user_profiles: {
    id: string;
    name: string;
    email: string;
  };
}

interface NodeWithAssignments {
  id: string;
  label: string;
  node_type: string;
  entity_id: string | null;
  assignments: Assignment[];
  required_entity_name: string | null;
  user_eligible: boolean;
  user_already_assigned: boolean;
}

interface WorkflowStepAssignmentsProps {
  workflowInstanceId: string;
  nodeId?: string;
  currentUserId?: string;
  canManageAssignments?: boolean;
  compact?: boolean;
}

const fetcher = (url: string) => fetch(url).then(res => res.json());

export function WorkflowStepAssignments({
  workflowInstanceId,
  nodeId,
  currentUserId,
  canManageAssignments = false,
  compact = false
}: WorkflowStepAssignmentsProps) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [selectedUserId, setSelectedUserId] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [removingAssignment, setRemovingAssignment] = useState<string | null>(null);

  // Fetch assignments data
  const { data, error, isLoading } = useSWR<{ success: boolean; nodes: NodeWithAssignments[] }>(
    workflowInstanceId
      ? `/api/workflows/steps/assignments?workflowInstanceId=${workflowInstanceId}${currentUserId ? `&userId=${currentUserId}` : ''}`
      : null,
    fetcher,
    { revalidateOnFocus: false }
  );

  // Fetch available users for assignment
  const { data: usersData } = useSWR<{ id: string; name: string; email: string }[]>(
    isDialogOpen ? '/api/users' : null,
    fetcher
  );

  const nodes = data?.nodes || [];

  // Filter to specific node if nodeId provided
  const displayNodes = nodeId ? nodes.filter(n => n.id === nodeId) : nodes;

  const handleAssign = async () => {
    if (!selectedNodeId || !selectedUserId) return;

    setIsSubmitting(true);
    try {
      const response = await fetch('/api/workflows/steps/assignments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workflowInstanceId,
          nodeId: selectedNodeId,
          userId: selectedUserId,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to assign user');
      }

      toast.success('User assigned successfully');
      mutate(`/api/workflows/steps/assignments?workflowInstanceId=${workflowInstanceId}${currentUserId ? `&userId=${currentUserId}` : ''}`);
      setIsDialogOpen(false);
      setSelectedNodeId(null);
      setSelectedUserId('');
    } catch (err: any) {
      toast.error(err.message || 'Failed to assign user');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRemove = async (nodeId: string, userId: string) => {
    setRemovingAssignment(`${nodeId}-${userId}`);
    try {
      const response = await fetch(
        `/api/workflows/steps/assignments?workflowInstanceId=${workflowInstanceId}&nodeId=${nodeId}&userId=${userId}`,
        { method: 'DELETE' }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to remove assignment');
      }

      toast.success('Assignment removed');
      mutate(`/api/workflows/steps/assignments?workflowInstanceId=${workflowInstanceId}${currentUserId ? `&userId=${currentUserId}` : ''}`);
    } catch (err: any) {
      toast.error(err.message || 'Failed to remove assignment');
    } finally {
      setRemovingAssignment(null);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-sm text-gray-500">
        <Loader2 className="w-4 h-4 animate-spin" />
        Loading assignments...
      </div>
    );
  }

  if (error || !data?.success) {
    return null;
  }

  if (displayNodes.length === 0) {
    return null;
  }

  // Get users who can be assigned (not already assigned to this node)
  const getAvailableUsers = (node: NodeWithAssignments) => {
    if (!usersData) return [];
    const assignedUserIds = node.assignments.map(a => a.user_id);
    return usersData.filter(u => !assignedUserIds.includes(u.id));
  };

  // Compact view - just show badges inline
  if (compact) {
    const node = displayNodes[0];
    if (!node) return null;

    return (
      <div className="flex items-center gap-1 flex-wrap">
        {node.assignments.map(a => (
          <Badge
            key={a.id}
            variant="secondary"
            className="text-xs flex items-center gap-1"
          >
            {a.user_profiles.name}
            {canManageAssignments && (
              <button
                onClick={() => handleRemove(node.id, a.user_id)}
                disabled={removingAssignment === `${node.id}-${a.user_id}`}
                className="ml-1 hover:text-red-500 transition-colors"
              >
                {removingAssignment === `${node.id}-${a.user_id}` ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : (
                  <X className="w-3 h-3" />
                )}
              </button>
            )}
          </Badge>
        ))}
        {canManageAssignments && (
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 px-2"
                onClick={() => setSelectedNodeId(node.id)}
              >
                <UserPlus className="w-3 h-3" />
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Assign User to {node.label}</DialogTitle>
                <DialogDescription>
                  Select a user to assign to this workflow step.
                </DialogDescription>
              </DialogHeader>
              <div className="py-4">
                <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a user" />
                  </SelectTrigger>
                  <SelectContent>
                    {getAvailableUsers(node).map(user => (
                      <SelectItem key={user.id} value={user.id}>
                        {user.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleAssign} disabled={!selectedUserId || isSubmitting}>
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Assigning...
                    </>
                  ) : (
                    <>
                      <Check className="w-4 h-4 mr-2" />
                      Assign
                    </>
                  )}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </div>
    );
  }

  // Full view - show all nodes with assignments
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-medium flex items-center gap-2">
          <Users className="w-4 h-4" />
          Step Assignments
        </h4>
        {canManageAssignments && (
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm" className="h-7">
                <UserPlus className="w-3 h-3 mr-1" />
                Assign User
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Assign User to Step</DialogTitle>
                <DialogDescription>
                  Select a workflow step and user to create an assignment.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Workflow Step</label>
                  <Select value={selectedNodeId || ''} onValueChange={setSelectedNodeId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a step" />
                    </SelectTrigger>
                    <SelectContent>
                      {displayNodes.map(node => (
                        <SelectItem key={node.id} value={node.id}>
                          {node.label} ({node.node_type})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {selectedNodeId && (
                  <div className="space-y-2">
                    <label className="text-sm font-medium">User</label>
                    <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a user" />
                      </SelectTrigger>
                      <SelectContent>
                        {getAvailableUsers(displayNodes.find(n => n.id === selectedNodeId)!).map(user => (
                          <SelectItem key={user.id} value={user.id}>
                            {user.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleAssign} disabled={!selectedNodeId || !selectedUserId || isSubmitting}>
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Assigning...
                    </>
                  ) : (
                    <>
                      <Check className="w-4 h-4 mr-2" />
                      Assign
                    </>
                  )}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <div className="space-y-2">
        {displayNodes.map(node => (
          <div
            key={node.id}
            className={cn(
              "p-3 rounded-lg border",
              node.assignments.length > 0 ? "bg-green-50 border-green-200" : "bg-gray-50 border-gray-200"
            )}
          >
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-xs">
                  {node.node_type}
                </Badge>
                <span className="text-sm font-medium">{node.label}</span>
              </div>
              {node.required_entity_name && (
                <span className="text-xs text-gray-500">
                  Requires: {node.required_entity_name}
                </span>
              )}
            </div>

            {node.assignments.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {node.assignments.map(a => (
                  <Badge
                    key={a.id}
                    className="bg-green-100 text-green-800 border-green-200 flex items-center gap-1"
                  >
                    {a.user_profiles.name}
                    {canManageAssignments && (
                      <button
                        onClick={() => handleRemove(node.id, a.user_id)}
                        disabled={removingAssignment === `${node.id}-${a.user_id}`}
                        className="ml-1 hover:text-red-600 transition-colors"
                      >
                        {removingAssignment === `${node.id}-${a.user_id}` ? (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        ) : (
                          <X className="w-3 h-3" />
                        )}
                      </button>
                    )}
                  </Badge>
                ))}
              </div>
            ) : (
              <span className="text-xs text-gray-500">No users assigned</span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
