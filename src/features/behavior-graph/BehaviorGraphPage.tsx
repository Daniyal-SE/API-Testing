import React, { memo, useCallback, useMemo, useState } from 'react';
import {
  Background,
  Controls,
  Handle,
  MarkerType,
  Position,
  ReactFlow,
  type Edge,
  type Node,
  type NodeProps,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, Check, X } from 'lucide-react';
import { ErrorState, LoadingSkeleton } from '@/src/components/feedback/FeedbackStates';
import { PageHeader } from '@/src/components/layout/AppShell';
import { SemanticBadge } from '@/src/components/security/StatusBadges';
import { Button, Panel } from '@/src/components/ui/Primitives';
import { apiClient } from '@/src/lib/api-client';
import type { BehaviorGraphEdge, BehaviorGraphNode } from '@/src/types/domain';

interface OperationNodeData extends Record<string, unknown> {
  node: BehaviorGraphNode;
}

const OperationNode = memo(function OperationNode({ data, selected }: NodeProps<Node<OperationNodeData>>) {
  const op = data.node;
  return (
    <div
      className={`w-56 rounded-md border px-3 py-2 text-xs shadow-sm transition-colors ${
        selected
          ? 'border-teal-400 bg-slate-900 text-slate-100'
          : 'border-slate-700 bg-slate-900/95 text-slate-200'
      }`}
    >
      <Handle type="target" position={Position.Left} className="!bg-teal-500 !w-2 !h-2" />
      <div className="flex items-center justify-between gap-2">
        <span className={`font-mono font-semibold ${op.stateChanging ? 'text-amber-400' : 'text-teal-400'}`}>
          {op.method}
        </span>
        <span className="text-[10px] text-slate-400">{op.resourceGroup}</span>
      </div>
      <div className="mt-1 font-mono text-[11px] text-slate-100 truncate" title={op.path}>
        {op.path}
      </div>
      <div className="mt-0.5 text-[10px] text-slate-400 truncate">{op.operationId}</div>
      <Handle type="source" position={Position.Right} className="!bg-teal-500 !w-2 !h-2" />
    </div>
  );
});

const nodeTypes = { operationNode: OperationNode };

export function BehaviorGraphPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [provenanceFilter, setProvenanceFilter] = useState('all');
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>('e-3');

  const graphQ = useQuery({ queryKey: ['behavior-graph'], queryFn: () => apiClient.getBehaviorGraph() });

  const reviewMut = useMutation({
    mutationFn: ({ edgeId, decision }: { edgeId: string; decision: 'approved' | 'rejected' }) =>
      apiClient.reviewGraphEdge(edgeId, decision),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['behavior-graph'] });
      qc.invalidateQueries({ queryKey: ['audit-logs'] });
    },
  });

  const nodes: Node<OperationNodeData>[] = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (graphQ.data?.nodes ?? [])
      .filter((n) => !q || n.path.toLowerCase().includes(q) || n.operationId.toLowerCase().includes(q))
      .map((n) => ({
        id: n.id,
        type: 'operationNode',
        position: { x: n.x, y: n.y },
        data: { node: n },
        selected: n.id === selectedNodeId,
      }));
  }, [graphQ.data?.nodes, search, selectedNodeId]);

  const edges: Edge[] = useMemo(() => {
    const visibleIds = new Set(nodes.map((n) => n.id));
    return (graphQ.data?.edges ?? [])
      .filter((e) => visibleIds.has(e.source) && visibleIds.has(e.target))
      .filter((e) => provenanceFilter === 'all' || e.provenance === provenanceFilter)
      .map((e) => {
        const isInferred = e.provenance === 'inferred';
        const isRejected = e.reviewState === 'rejected';
        const stroke =
          isRejected
            ? '#ef4444'
            : e.provenance === 'documented'
              ? '#14b8a6'
              : e.provenance === 'observed'
                ? '#38bdf8'
                : '#f59e0b';
        return {
          id: e.id,
          source: e.source,
          target: e.target,
          label: `${e.label} (${e.provenance})`,
          animated: false,
          markerEnd: { type: MarkerType.ArrowClosed, color: stroke },
          style: {
            stroke,
            strokeWidth: e.id === selectedEdgeId ? 2.5 : 1.75,
            strokeDasharray: isInferred ? '6 4' : undefined,
          },
          labelStyle: { fill: '#cbd5e1', fontSize: 10, fontFamily: 'JetBrains Mono, monospace' },
          labelBgStyle: { fill: '#0f172a', fillOpacity: 0.9 },
        };
      });
  }, [graphQ.data?.edges, nodes, provenanceFilter, selectedEdgeId]);

  const onNodeClick = useCallback((_: React.MouseEvent, node: Node) => {
    setSelectedNodeId(node.id);
    setSelectedEdgeId(null);
  }, []);

  const onEdgeClick = useCallback((_: React.MouseEvent, edge: Edge) => {
    setSelectedEdgeId(edge.id);
    setSelectedNodeId(null);
  }, []);

  const selectedNode: BehaviorGraphNode | undefined = (graphQ.data?.nodes ?? []).find((n) => n.id === selectedNodeId);
  const selectedEdge: BehaviorGraphEdge | undefined = (graphQ.data?.edges ?? []).find((e) => e.id === selectedEdgeId);

  return (
    <div className="space-y-6">
      <PageHeader
        breadcrumbs={[{ label: 'Behavior (Sem 8)' }, { label: 'Dependency Graph' }]}
        title="Behavior Dependency Graph"
        description="Producer/consumer API operation dependencies mined from OpenAPI documentation, observed traces, and schema inference."
      />

      <div className="rounded-md border border-amber-700/40 bg-amber-950/30 p-3.5 text-xs text-amber-200 flex items-start gap-2.5">
        <AlertTriangle className="h-4 w-4 shrink-0 text-amber-400 mt-0.5" aria-hidden="true" />
        <span>
          Approving an inferred or observed dependency edge records structural validity only. An edge approval never
          authorizes execution—assessments still require an approved run plan, target authorization, and scope.
        </span>
      </div>

      {/* Controls & Legend */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-800 bg-slate-900/70 p-3 text-xs">
        <div className="flex flex-wrap items-center gap-3">
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Filter operation nodes..."
            aria-label="Filter dependency graph nodes"
            className="h-8 w-56 rounded border border-slate-700 bg-slate-950 px-2.5 text-xs text-slate-200"
          />
          <select
            aria-label="Filter edges by provenance"
            value={provenanceFilter}
            onChange={(e) => setProvenanceFilter(e.target.value)}
            className="h-8 rounded border border-slate-700 bg-slate-950 px-2.5 text-xs text-slate-200"
          >
            <option value="all">All Edge Provenances</option>
            <option value="documented">Documented (Solid Teal)</option>
            <option value="observed">Observed (Solid Sky)</option>
            <option value="inferred">Inferred (Dashed Amber)</option>
          </select>
        </div>

        <div className="flex flex-wrap items-center gap-4 text-[11px] text-slate-300">
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-0.5 w-4 bg-teal-400" /> Documented
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-0.5 w-4 bg-sky-400" /> Observed
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-0.5 w-4 border-b-2 border-dashed border-amber-400" /> Inferred
          </span>
        </div>
      </div>

      {graphQ.error ? (
        <ErrorState message="Failed to load behavior dependency graph." onRetry={() => graphQ.refetch()} />
      ) : graphQ.isLoading ? (
        <LoadingSkeleton rows={5} />
      ) : (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <Panel className="lg:col-span-2 h-[500px] overflow-hidden" data-testid="behavior-graph-canvas">
            <ReactFlow
              nodes={nodes}
              edges={edges}
              nodeTypes={nodeTypes}
              onNodeClick={onNodeClick}
              onEdgeClick={onEdgeClick}
              fitView
              proOptions={{ hideAttribution: true }}
              className="bg-slate-950"
            >
              <Background color="#1e293b" gap={20} />
              <Controls />
            </ReactFlow>
          </Panel>

          <Panel className="p-5 space-y-4">
            <h2 className="text-sm font-semibold text-slate-100">Selected Element Details</h2>

            {selectedEdge ? (
              <div className="space-y-3 text-xs">
                <div className="font-mono text-sm font-semibold text-teal-400">{selectedEdge.label}</div>
                <div className="flex flex-wrap gap-2">
                  <SemanticBadge
                    label={`Provenance: ${selectedEdge.provenance}`}
                    tone={selectedEdge.provenance === 'inferred' ? 'warning' : 'info'}
                  />
                  <SemanticBadge
                    label={selectedEdge.reviewState.replace(/_/g, ' ')}
                    tone={
                      selectedEdge.reviewState === 'approved'
                        ? 'success'
                        : selectedEdge.reviewState === 'rejected'
                          ? 'error'
                          : 'warning'
                    }
                  />
                </div>
                <div>
                  <span className="text-slate-400">Confidence: </span>
                  <span className="font-mono text-slate-200 tabular-nums">{Math.round(selectedEdge.confidence * 100)}%</span>
                </div>
                <div>
                  <div className="text-slate-400 mb-1">Rationale</div>
                  <p className="text-slate-200 leading-relaxed">{selectedEdge.rationale}</p>
                </div>
                {selectedEdge.evidenceRef && (
                  <div className="text-slate-400">
                    Evidence Ref: <span className="font-mono text-slate-200">{selectedEdge.evidenceRef}</span>
                  </div>
                )}
                <div className="flex items-center gap-2 border-t border-slate-800 pt-3">
                  <Button
                    size="sm"
                    variant="primary"
                    disabled={reviewMut.isPending}
                    onClick={() => reviewMut.mutate({ edgeId: selectedEdge.id, decision: 'approved' })}
                  >
                    <Check className="h-3.5 w-3.5" aria-hidden="true" />
                    Approve Edge
                  </Button>
                  <Button
                    size="sm"
                    variant="danger"
                    disabled={reviewMut.isPending}
                    onClick={() => reviewMut.mutate({ edgeId: selectedEdge.id, decision: 'rejected' })}
                  >
                    <X className="h-3.5 w-3.5" aria-hidden="true" />
                    Reject
                  </Button>
                </div>
              </div>
            ) : selectedNode ? (
              <div className="space-y-3 text-xs">
                <div className="font-mono text-sm font-semibold text-slate-100">
                  {selectedNode.method} {selectedNode.path}
                </div>
                <div>Operation ID: <span className="font-mono text-slate-200">{selectedNode.operationId}</span></div>
                <div>Resource Group: <span className="text-slate-200">{selectedNode.resourceGroup}</span></div>
                <div>Auth Required: <span className="font-mono text-slate-200">{selectedNode.authRequired ? 'Yes' : 'No'}</span></div>
                <div>State Changing: <span className="font-mono text-slate-200">{selectedNode.stateChanging ? 'Yes' : 'No (Read-only)'}</span></div>
              </div>
            ) : (
              <p className="text-xs text-slate-400">
                Select any operation node or directed dependency edge in the graph to inspect provenance, confidence, and review state.
              </p>
            )}
          </Panel>
        </div>
      )}
    </div>
  );
}
