/**
 * Workflow Validation Module
 * Validates workflow templates before saving to prevent invalid configurations
 */

import type { Node, Edge } from '@xyflow/react';

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
}

export interface ValidationError {
  type: 'error';
  code: string;
  message: string;
  nodeId?: string;
  nodeLabel?: string;
}

export interface ValidationWarning {
  type: 'warning';
  code: string;
  message: string;
  nodeId?: string;
  nodeLabel?: string;
}

/**
 * Validate a workflow template
 * @param nodes - React Flow nodes
 * @param edges - React Flow edges
 * @returns ValidationResult with errors and warnings
 */
export function validateWorkflow(
  nodes: Node[],
  edges: Edge[]
): ValidationResult {
  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];

  // Basic checks
  if (nodes.length === 0) {
    errors.push({
      type: 'error',
      code: 'NO_NODES',
      message: 'Workflow must have at least one node'
    });
    return { valid: false, errors, warnings };
  }

  // Check for start node
  const startNodes = nodes.filter(n => n.data?.type === 'start');
  if (startNodes.length === 0) {
    errors.push({
      type: 'error',
      code: 'NO_START',
      message: 'Workflow must have a Start node'
    });
  } else if (startNodes.length > 1) {
    errors.push({
      type: 'error',
      code: 'MULTIPLE_STARTS',
      message: 'Workflow can only have one Start node'
    });
  }

  // Check for end node
  const endNodes = nodes.filter(n => n.data?.type === 'end');
  if (endNodes.length === 0) {
    warnings.push({
      type: 'warning',
      code: 'NO_END',
      message: 'Workflow has no End node. The workflow may not terminate properly.'
    });
  }

  // Check for orphaned nodes (nodes with no incoming or outgoing edges, except start/end)
  const orphanedNodes = findOrphanedNodes(nodes, edges);
  for (const node of orphanedNodes) {
    warnings.push({
      type: 'warning',
      code: 'ORPHANED_NODE',
      message: `Node "${node.data?.label || 'Unknown'}" is not connected to the workflow`,
      nodeId: node.id,
      nodeLabel: node.data?.label as string
    });
  }

  // Check for parallel branches without sync
  const parallelErrors = validateParallelBranches(nodes, edges);
  errors.push(...parallelErrors);

  // Check for cycles
  const cycleErrors = detectCycles(nodes, edges);
  errors.push(...cycleErrors);

  // Check approval nodes have required edges
  const approvalErrors = validateApprovalNodes(nodes, edges);
  errors.push(...approvalErrors);

  // Check sync nodes have enough incoming branches
  const syncWarnings = validateSyncNodes(nodes, edges);
  warnings.push(...syncWarnings);

  // Check conditional nodes have proper paths
  const conditionalWarnings = validateConditionalNodes(nodes, edges);
  warnings.push(...conditionalWarnings);

  return {
    valid: errors.length === 0,
    errors,
    warnings
  };
}

/**
 * Validate conditional nodes have proper configuration
 */
function validateConditionalNodes(nodes: Node[], edges: Edge[]): ValidationWarning[] {
  const warnings: ValidationWarning[] = [];

  const conditionalNodes = nodes.filter(n => n.data?.type === 'conditional');

  for (const node of conditionalNodes) {
    const outgoingEdges = edges.filter(e => e.source === node.id);

    if (outgoingEdges.length === 0) {
      warnings.push({
        type: 'warning',
        code: 'CONDITIONAL_NO_OUTPUT',
        message: `Conditional node "${node.data?.label || 'node'}" has no outgoing connections. The workflow cannot continue.`,
        nodeId: node.id,
        nodeLabel: node.data?.label as string
      });
      continue;
    }

    // Check if there's a default path (edge without condition)
    const hasDefaultPath = outgoingEdges.some(e => {
      const data = e.data as { conditionValue?: string; decision?: string } | undefined;
      return !data?.conditionValue && !data?.decision;
    });

    const conditionalEdges = outgoingEdges.filter(e => {
      const data = e.data as { conditionValue?: string; decision?: string } | undefined;
      return data?.conditionValue || data?.decision;
    });

    if (conditionalEdges.length === 0) {
      warnings.push({
        type: 'warning',
        code: 'CONDITIONAL_NO_CONDITIONS',
        message: `Conditional node "${node.data?.label || 'node'}" has no condition-based edges. All paths will be treated as default.`,
        nodeId: node.id,
        nodeLabel: node.data?.label as string
      });
    } else if (!hasDefaultPath && conditionalEdges.length < 2) {
      warnings.push({
        type: 'warning',
        code: 'CONDITIONAL_MISSING_DEFAULT',
        message: `Conditional node "${node.data?.label || 'node'}" may not handle all cases. Consider adding a default path or additional conditions.`,
        nodeId: node.id,
        nodeLabel: node.data?.label as string
      });
    }
  }

  return warnings;
}

/**
 * Find orphaned nodes (not connected to workflow)
 */
function findOrphanedNodes(nodes: Node[], edges: Edge[]): Node[] {
  const connectedNodeIds = new Set<string>();

  // Add all nodes that have edges
  edges.forEach(edge => {
    connectedNodeIds.add(edge.source);
    connectedNodeIds.add(edge.target);
  });

  // Find nodes not in connected set (except start with no incoming is ok)
  return nodes.filter(node => {
    // Start nodes are allowed to have no incoming edges
    if (node.data?.type === 'start') {
      return !edges.some(e => e.source === node.id);
    }
    // End nodes are allowed to have no outgoing edges
    if (node.data?.type === 'end') {
      return !edges.some(e => e.target === node.id);
    }
    // Other nodes must have at least one connection
    return !connectedNodeIds.has(node.id);
  });
}

/**
 * Validate parallel branches merge at sync nodes
 */
function validateParallelBranches(nodes: Node[], edges: Edge[]): ValidationError[] {
  const errors: ValidationError[] = [];

  // Find fork points (nodes with multiple outgoing edges that aren't conditional/approval routing)
  const forkPoints: Node[] = [];

  for (const node of nodes) {
    const outgoingEdges = edges.filter(e => e.source === node.id);

    // Check for parallel forks (multiple outgoing edges without conditions)
    const parallelEdges = outgoingEdges.filter(e => {
      const edgeData = e.data as any;
      // Edges with decision conditions are not parallel forks
      return !edgeData?.decision && !edgeData?.conditionValue;
    });

    if (parallelEdges.length > 1) {
      forkPoints.push(node);
    }
  }

  // For each fork point, verify branches merge at a sync node
  for (const forkNode of forkPoints) {
    const result = checkBranchesMergeAtSync(forkNode, nodes, edges);
    if (!result.merges) {
      errors.push({
        type: 'error',
        code: 'PARALLEL_WITHOUT_SYNC',
        message: `Parallel branches from "${forkNode.data?.label || 'node'}" must merge at a Sync node. ${result.reason}`,
        nodeId: forkNode.id,
        nodeLabel: forkNode.data?.label as string
      });
    }
  }

  return errors;
}

/**
 * Check if all branches from a fork point merge at a sync node
 */
function checkBranchesMergeAtSync(
  forkNode: Node,
  nodes: Node[],
  edges: Edge[]
): { merges: boolean; reason: string } {
  const outgoingEdges = edges.filter(e => e.source === forkNode.id);
  const parallelEdges = outgoingEdges.filter(e => {
    const edgeData = e.data as any;
    return !edgeData?.decision && !edgeData?.conditionValue;
  });

  if (parallelEdges.length < 2) {
    return { merges: true, reason: '' };
  }

  // Get the target nodes of parallel branches
  const branchTargetIds = parallelEdges.map(e => e.target);

  // For each branch, follow it until we hit a sync node or end
  const branchSyncNodes = new Map<string, string | null>();

  for (const targetId of branchTargetIds) {
    const syncNode = findFirstSyncOnPath(targetId, nodes, edges, new Set());
    branchSyncNodes.set(targetId, syncNode);
  }

  // Check if all branches reach the SAME sync node
  const syncNodeIds = new Set(Array.from(branchSyncNodes.values()).filter(Boolean));

  if (syncNodeIds.size === 0) {
    return { merges: false, reason: 'No Sync node found on any branch.' };
  }

  if (syncNodeIds.size > 1) {
    return { merges: false, reason: 'Branches merge at different Sync nodes.' };
  }

  // Check if any branch doesn't reach a sync
  const noSyncBranches = Array.from(branchSyncNodes.entries())
    .filter(([_, syncId]) => !syncId)
    .map(([branchId]) => {
      const node = nodes.find(n => n.id === branchId);
      return node?.data?.label || branchId;
    });

  if (noSyncBranches.length > 0) {
    return {
      merges: false,
      reason: `Branch starting at "${noSyncBranches.join(', ')}" does not reach a Sync node.`
    };
  }

  return { merges: true, reason: '' };
}

/**
 * Find the first sync node on a path from a starting node
 */
function findFirstSyncOnPath(
  nodeId: string,
  nodes: Node[],
  edges: Edge[],
  visited: Set<string>
): string | null {
  if (visited.has(nodeId)) return null;
  visited.add(nodeId);

  const node = nodes.find(n => n.id === nodeId);
  if (!node) return null;

  if (node.data?.type === 'sync') {
    return node.id;
  }

  if (node.data?.type === 'end') {
    return null;
  }

  // Follow all outgoing edges
  const outgoing = edges.filter(e => e.source === nodeId);
  for (const edge of outgoing) {
    const result = findFirstSyncOnPath(edge.target, nodes, edges, visited);
    if (result) return result;
  }

  return null;
}

/**
 * Detect cycles in the workflow
 */
function detectCycles(nodes: Node[], edges: Edge[]): ValidationError[] {
  const errors: ValidationError[] = [];
  const visited = new Set<string>();
  const recursionStack = new Set<string>();
  const cyclePath: string[] = [];

  function hasCycle(nodeId: string): boolean {
    visited.add(nodeId);
    recursionStack.add(nodeId);
    cyclePath.push(nodeId);

    const outgoing = edges.filter(e => e.source === nodeId);
    for (const edge of outgoing) {
      // Skip edges that are explicitly marked as rejection loops (intentional back-edges)
      const edgeData = edge.data as any;
      if (edgeData?.decision === 'rejected' || edgeData?.conditionValue === 'rejected') {
        continue; // Rejection loops are allowed
      }

      if (!visited.has(edge.target)) {
        if (hasCycle(edge.target)) return true;
      } else if (recursionStack.has(edge.target)) {
        // Found a cycle that's not a rejection loop
        const cycleStartIndex = cyclePath.indexOf(edge.target);
        const cycleNodes = cyclePath.slice(cycleStartIndex);
        const cycleLabels = cycleNodes.map(id => {
          const node = nodes.find(n => n.id === id);
          return node?.data?.label || id;
        });

        errors.push({
          type: 'error',
          code: 'CYCLE_DETECTED',
          message: `Workflow contains a cycle: ${cycleLabels.join(' → ')} → ${cycleLabels[0]}. Cycles are only allowed via rejection paths.`,
          nodeId: edge.target
        });
        return true;
      }
    }

    cyclePath.pop();
    recursionStack.delete(nodeId);
    return false;
  }

  // Start cycle detection from each unvisited node
  for (const node of nodes) {
    if (!visited.has(node.id)) {
      hasCycle(node.id);
    }
  }

  return errors;
}

/**
 * Validate approval nodes have proper routing edges
 */
function validateApprovalNodes(nodes: Node[], edges: Edge[]): ValidationError[] {
  const errors: ValidationError[] = [];

  const approvalNodes = nodes.filter(n => n.data?.type === 'approval');

  for (const node of approvalNodes) {
    const outgoingEdges = edges.filter(e => e.source === node.id);

    // Check for at least one edge
    if (outgoingEdges.length === 0) {
      errors.push({
        type: 'error',
        code: 'APPROVAL_NO_EDGES',
        message: `Approval node "${node.data?.label || 'node'}" has no outgoing connections`,
        nodeId: node.id,
        nodeLabel: node.data?.label as string
      });
      continue;
    }

    // Check if there are both approved and rejected paths
    const hasApprovedPath = outgoingEdges.some(e => {
      const data = e.data as any;
      return data?.decision === 'approved' || data?.conditionValue === 'approved';
    });

    const hasRejectedPath = outgoingEdges.some(e => {
      const data = e.data as any;
      return data?.decision === 'rejected' || data?.conditionValue === 'rejected';
    });

    // Only warn if no approved path (rejected path is optional for some workflows)
    if (!hasApprovedPath && outgoingEdges.length === 1) {
      // Single edge without condition is the default path
      // This is ok for simple workflows
    } else if (!hasApprovedPath && outgoingEdges.length > 1) {
      errors.push({
        type: 'error',
        code: 'APPROVAL_NO_APPROVED_PATH',
        message: `Approval node "${node.data?.label || 'node'}" has no "Approved" path configured`,
        nodeId: node.id,
        nodeLabel: node.data?.label as string
      });
    }
  }

  return errors;
}

/**
 * Validate sync nodes have enough incoming branches
 */
function validateSyncNodes(nodes: Node[], edges: Edge[]): ValidationWarning[] {
  const warnings: ValidationWarning[] = [];

  const syncNodes = nodes.filter(n => n.data?.type === 'sync');

  for (const node of syncNodes) {
    const incomingEdges = edges.filter(e => e.target === node.id);

    if (incomingEdges.length < 2) {
      warnings.push({
        type: 'warning',
        code: 'SYNC_SINGLE_BRANCH',
        message: `Sync node "${node.data?.label || 'node'}" has only ${incomingEdges.length} incoming branch(es). Sync nodes are typically used to merge 2+ parallel branches.`,
        nodeId: node.id,
        nodeLabel: node.data?.label as string
      });
    }

    // Check if sync has an outgoing edge
    const outgoingEdges = edges.filter(e => e.source === node.id);
    if (outgoingEdges.length === 0) {
      warnings.push({
        type: 'warning',
        code: 'SYNC_NO_OUTPUT',
        message: `Sync node "${node.data?.label || 'node'}" has no outgoing connection. The workflow cannot continue after this point.`,
        nodeId: node.id,
        nodeLabel: node.data?.label as string
      });
    }
  }

  return warnings;
}
