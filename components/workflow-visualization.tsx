'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import {
  ReactFlow,
  Node,
  Edge,
  Controls,
  Background,
  BackgroundVariant,
  ReactFlowProvider,
  NodeTypes,
  MarkerType,
  useReactFlow,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { createClientSupabase } from '@/lib/supabase';
import { WorkflowVisualizationNode, VisualizationNodeData } from './workflow-visualization-node';

interface WorkflowVisualizationProps {
  workflowInstanceId: string | null;
  onStepClick?: (stepId: string, nodeId: string) => void;
}

interface WorkflowNode {
  id: string;
  label: string;
  node_type: string;
  position_x: number;
  position_y: number;
  entity_id: string | null;
  settings: any;
}

interface WorkflowConnection {
  id: string;
  from_node_id: string;
  to_node_id: string;
  condition: any;
}

interface WorkflowInstance {
  id: string;
  workflow_template_id: string;
  current_node_id: string | null;
  status: string;
  has_parallel_paths: boolean;
  workflow_templates?: {
    name: string;
  };
  completed_snapshot?: {
    nodes: WorkflowNode[];
    connections: WorkflowConnection[];
    nodeAssignments?: Record<string, { userId: string; userName: string }>;
  } | null;
}

interface ActiveStep {
  id: string;
  node_id: string;
  branch_id: string;
  status: 'active' | 'completed' | 'waiting';
  assigned_user_id: string | null;
}

interface WorkflowHistory {
  id: string;
  from_node_id: string;
  to_node_id: string | null;
  handed_off_at: string;
}

const nodeTypes: NodeTypes = {
  visualizationNode: WorkflowVisualizationNode,
};

// Auto-layout constants for HORIZONTAL visualization (left to right)
const LAYOUT = {
  NODE_WIDTH: 140,
  NODE_HEIGHT: 45,
  HORIZONTAL_GAP: 80,  // Gap between levels (left-right) - increased for edge labels
  VERTICAL_GAP: 60,    // Gap between parallel branches (up-down) - increased to avoid edge overlap
  START_X: 20,
  CENTER_Y: 100,       // Center line for main path
};

/**
 * Calculate horizontal auto-layout positions for visualization
 * Flow goes left-to-right, with fork branches spread above/below the center line
 */
function calculateAutoLayout(
  nodes: WorkflowNode[],
  connections: WorkflowConnection[]
): Map<string, { x: number; y: number }> {
  const positions = new Map<string, { x: number; y: number }>();

  if (nodes.length === 0) return positions;

  // Build adjacency list
  const outgoing = new Map<string, string[]>();
  const incoming = new Map<string, string[]>();

  nodes.forEach(n => {
    outgoing.set(n.id, []);
    incoming.set(n.id, []);
  });

  connections.forEach(c => {
    outgoing.get(c.from_node_id)?.push(c.to_node_id);
    incoming.get(c.to_node_id)?.push(c.from_node_id);
  });

  // Find start node (or node with no incoming edges)
  let startNode = nodes.find(n => n.node_type === 'start');
  if (!startNode) {
    startNode = nodes.find(n => (incoming.get(n.id)?.length || 0) === 0) || nodes[0];
  }

  // BFS to assign levels (horizontal position = level)
  const levels = new Map<string, number>();
  const queue: { id: string; level: number }[] = [{ id: startNode.id, level: 0 }];
  const visited = new Set<string>();

  while (queue.length > 0) {
    const { id, level } = queue.shift()!;

    if (visited.has(id)) {
      // Update level if we found a longer path
      const existingLevel = levels.get(id) || 0;
      if (level > existingLevel) {
        levels.set(id, level);
      }
      continue;
    }

    visited.add(id);
    levels.set(id, level);

    const nextNodes = outgoing.get(id) || [];
    nextNodes.forEach(nextId => {
      if (!visited.has(nextId)) {
        queue.push({ id: nextId, level: level + 1 });
      }
    });
  }

  // Handle any disconnected nodes
  nodes.forEach(n => {
    if (!levels.has(n.id)) {
      levels.set(n.id, 0);
    }
  });

  // Group nodes by level
  const nodesByLevel = new Map<number, string[]>();
  levels.forEach((level, nodeId) => {
    if (!nodesByLevel.has(level)) {
      nodesByLevel.set(level, []);
    }
    nodesByLevel.get(level)!.push(nodeId);
  });

  // Calculate positions - HORIZONTAL layout
  // X = level (left to right)
  // Y = spread nodes at same level vertically, centered around CENTER_Y
  nodesByLevel.forEach((nodeIds, level) => {
    const nodesAtLevel = nodeIds.length;
    const totalHeight = nodesAtLevel * LAYOUT.NODE_HEIGHT + (nodesAtLevel - 1) * LAYOUT.VERTICAL_GAP;
    const startY = LAYOUT.CENTER_Y - totalHeight / 2;

    nodeIds.forEach((nodeId, index) => {
      positions.set(nodeId, {
        x: LAYOUT.START_X + level * (LAYOUT.NODE_WIDTH + LAYOUT.HORIZONTAL_GAP),
        y: startY + index * (LAYOUT.NODE_HEIGHT + LAYOUT.VERTICAL_GAP),
      });
    });
  });

  return positions;
}

function WorkflowVisualizationInner({
  workflowInstanceId,
  onStepClick,
}: WorkflowVisualizationProps) {
  const [loading, setLoading] = useState(true);
  const [workflowInstance, setWorkflowInstance] = useState<WorkflowInstance | null>(null);
  const [nodes, setNodes] = useState<Node<VisualizationNodeData>[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [activeSteps, setActiveSteps] = useState<ActiveStep[]>([]);
  const [completedNodeIds, setCompletedNodeIds] = useState<Set<string>>(new Set());
  const { fitView } = useReactFlow();

  useEffect(() => {
    if (workflowInstanceId) {
      loadWorkflowVisualization();
    } else {
      setLoading(false);
    }
  }, [workflowInstanceId]);

  // Fit view when nodes change - use compact settings
  useEffect(() => {
    if (nodes.length > 0) {
      setTimeout(() => fitView({ padding: 0.15, minZoom: 0.8, maxZoom: 1.2 }), 100);
    }
  }, [nodes, fitView]);

  const loadWorkflowVisualization = async () => {
    try {
      setLoading(true);
      const supabase = createClientSupabase();
      if (!supabase) return;

      // Get workflow instance
      const { data: instance, error: instanceError } = await supabase
        .from('workflow_instances')
        .select(`
          *,
          workflow_templates(name)
        `)
        .eq('id', workflowInstanceId)
        .single();

      if (instanceError || !instance) {
        console.error('Error loading workflow instance:', instanceError);
        return;
      }

      setWorkflowInstance(instance);

      // For completed workflows with a snapshot, use the snapshot data
      // This ensures the visualization remains unchanged even if the template is modified
      let workflowNodes: WorkflowNode[];
      let connections: WorkflowConnection[];

      if (instance.status === 'completed' && instance.completed_snapshot) {
        // Use snapshot data for completed workflows
        workflowNodes = instance.completed_snapshot.nodes;
        connections = instance.completed_snapshot.connections;
      } else {
        // Get live nodes for this workflow template
        const { data: liveNodes, error: nodesError } = await supabase
          .from('workflow_nodes')
          .select('*')
          .eq('workflow_template_id', instance.workflow_template_id);

        if (nodesError || !liveNodes) {
          console.error('Error loading workflow nodes:', nodesError);
          return;
        }

        // Get live connections
        const { data: liveConnections, error: connectionsError } = await supabase
          .from('workflow_connections')
          .select('*')
          .eq('workflow_template_id', instance.workflow_template_id);

        if (connectionsError) {
          console.error('Error loading connections:', connectionsError);
          return;
        }

        workflowNodes = liveNodes;
        connections = liveConnections || [];
      }

      // Get active steps for parallel workflow support
      const { data: steps } = await supabase
        .from('workflow_active_steps')
        .select('*')
        .eq('workflow_instance_id', workflowInstanceId)
        .in('status', ['active', 'waiting']);

      setActiveSteps(steps || []);

      // Get workflow history to determine completed nodes
      const { data: history } = await supabase
        .from('workflow_history')
        .select('from_node_id, to_node_id')
        .eq('workflow_instance_id', workflowInstanceId);

      // Build set of completed node IDs
      const completed = new Set<string>();
      if (history) {
        history.forEach((h: WorkflowHistory) => {
          if (h.from_node_id) completed.add(h.from_node_id);
        });
      }
      setCompletedNodeIds(completed);

      // Build React Flow nodes and edges
      buildVisualization(workflowNodes, connections || [], steps || [], completed, instance);

    } catch (error) {
      console.error('Error loading workflow visualization:', error);
    } finally {
      setLoading(false);
    }
  };

  const buildVisualization = (
    workflowNodes: WorkflowNode[],
    connections: WorkflowConnection[],
    steps: ActiveStep[],
    completed: Set<string>,
    instance: WorkflowInstance
  ) => {
    // Calculate auto-layout positions for compact visualization
    const autoPositions = calculateAutoLayout(workflowNodes, connections);

    // Check if the entire workflow is completed
    const isWorkflowCompleted = instance.status === 'completed';

    // Convert workflow nodes to React Flow nodes
    const flowNodes: Node<VisualizationNodeData>[] = workflowNodes.map((node) => {
      // Determine execution status
      let executionStatus: 'completed' | 'active' | 'waiting' | 'pending' = 'pending';

      // Find active step for this node (needed for both status and data)
      const activeStep = steps.find(s => s.node_id === node.id);

      // If workflow is completed, all nodes are completed
      if (isWorkflowCompleted) {
        executionStatus = 'completed';
      } else {
        // Check if there's an active step at this node
        if (activeStep) {
          if (activeStep.status === 'active') {
            executionStatus = 'active';
          } else if (activeStep.status === 'waiting') {
            executionStatus = 'waiting';
          }
        } else if (completed.has(node.id)) {
          executionStatus = 'completed';
        } else if (node.id === instance.current_node_id && !instance.has_parallel_paths) {
          // Legacy: single active node
          executionStatus = 'active';
        }
      }

      // Use auto-layout position for compact visualization
      const position = autoPositions.get(node.id) || { x: node.position_x, y: node.position_y };

      // Get assigned user from snapshot (for completed workflows)
      const nodeAssignment = instance.completed_snapshot?.nodeAssignments?.[node.id];

      return {
        id: node.id,
        type: 'visualizationNode',
        position,
        data: {
          label: node.label,
          type: node.node_type as any,
          executionStatus,
          activeStepId: activeStep?.id,
          branchId: activeStep?.branch_id,
          assignedUserName: nodeAssignment?.userName,
          isWorkflowCompleted,
        },
        selectable: executionStatus === 'active',
      };
    });

    // Convert connections to React Flow edges
    const flowEdges: Edge[] = connections.map((conn) => {
      // Determine edge status based on source node
      const sourceCompleted = isWorkflowCompleted || completed.has(conn.from_node_id);
      const sourceActive = !isWorkflowCompleted && steps.some(s => s.node_id === conn.from_node_id && s.status === 'active');

      // Get edge label from condition if exists
      const label = conn.condition?.label || conn.condition?.decision || '';

      // Check if this is a backward edge (rejection loop going back)
      const sourceLevel = autoPositions.get(conn.from_node_id)?.x || 0;
      const targetLevel = autoPositions.get(conn.to_node_id)?.x || 0;
      const isBackwardEdge = targetLevel < sourceLevel;

      return {
        id: conn.id,
        source: conn.from_node_id,
        target: conn.to_node_id,
        type: 'smoothstep',  // Better curves for horizontal layout
        animated: sourceActive,
        label: label || undefined,
        labelStyle: { fontSize: 8, fontWeight: 500 },
        labelBgStyle: { fill: 'white', fillOpacity: 0.9 },
        labelBgPadding: [4, 2] as [number, number],
        markerEnd: {
          type: MarkerType.ArrowClosed,
          width: 12,
          height: 12,
        },
        // Route backward edges (rejection loops) above or below nodes
        pathOptions: isBackwardEdge ? { offset: 50 } : undefined,
        style: {
          strokeWidth: 2,
          stroke: sourceCompleted ? '#22c55e' : sourceActive ? '#3b82f6' : '#94a3b8',
        },
        zIndex: isBackwardEdge ? 0 : 1, // Keep backward edges behind forward edges
      };
    });

    setNodes(flowNodes);
    setEdges(flowEdges);
  };

  const handleNodeClick = useCallback((event: React.MouseEvent, node: Node<VisualizationNodeData>) => {
    if (node.data.executionStatus === 'active' && node.data.activeStepId && onStepClick) {
      onStepClick(node.data.activeStepId, node.id);
    }
  }, [onStepClick]);

  // Calculate stats
  const stats = useMemo(() => {
    const total = nodes.length;
    const completed = nodes.filter(n => n.data.executionStatus === 'completed').length;
    const active = nodes.filter(n => n.data.executionStatus === 'active').length;
    const waiting = nodes.filter(n => n.data.executionStatus === 'waiting').length;
    return { total, completed, active, waiting };
  }, [nodes]);

  if (!workflowInstanceId) {
    return null;
  }

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Workflow Progress</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!workflowInstance || nodes.length === 0) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>Workflow Progress</span>
          <div className="flex items-center gap-2">
            {workflowInstance.has_parallel_paths && (
              <Badge variant="outline" className="bg-indigo-50 text-indigo-700 border-indigo-300">
                Parallel
              </Badge>
            )}
            {workflowInstance.workflow_templates && (
              <Badge variant="outline" className="font-normal">
                {workflowInstance.workflow_templates.name}
              </Badge>
            )}
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        {/* React Flow Canvas - shorter height for horizontal layout */}
        <div className="h-[200px] w-full border-t">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            nodeTypes={nodeTypes}
            onNodeClick={handleNodeClick}
            fitView
            fitViewOptions={{ padding: 0.1, minZoom: 0.6, maxZoom: 1.2 }}
            nodesDraggable={false}
            nodesConnectable={false}
            elementsSelectable={true}
            zoomOnScroll={true}
            panOnScroll={true}
            minZoom={0.4}
            maxZoom={1.5}
            defaultViewport={{ x: 0, y: 0, zoom: 1 }}
            attributionPosition="bottom-left"
          >
            <Background variant={BackgroundVariant.Dots} gap={16} size={1} color="#e5e7eb" />
            <Controls showInteractive={false} />
          </ReactFlow>
        </div>

        {/* Status Footer */}
        <div className="p-4 border-t bg-gray-50/50">
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded-full bg-green-500"></div>
                <span className="text-gray-600">Completed ({stats.completed})</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded-full bg-blue-500 animate-pulse"></div>
                <span className="text-gray-600">Active ({stats.active})</span>
              </div>
              {stats.waiting > 0 && (
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-3 rounded-full bg-amber-500"></div>
                  <span className="text-gray-600">Waiting ({stats.waiting})</span>
                </div>
              )}
            </div>
            <Badge variant={workflowInstance.status === 'active' ? 'default' : 'secondary'}>
              {workflowInstance.status}
            </Badge>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function WorkflowVisualization(props: WorkflowVisualizationProps) {
  return (
    <ReactFlowProvider>
      <WorkflowVisualizationInner {...props} />
    </ReactFlowProvider>
  );
}
