import { cn } from "@/lib/utils";

interface Node {
  cx: number;
  cy: number;
  r: number;
  color: string;
  opacity: number;
  className: string;
}

interface Edge {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  color: string;
  opacity: number;
  className: string;
}

// A symmetric grid of "neurons" so the layout reads the same in both
// LTR and RTL contexts (no left/right-only accents).
const nodes: Node[] = [
  { cx: 12, cy: 18, r: 2.4, color: "hsl(var(--accent))", opacity: 0.25, className: "ai-node-drift-slow" },
  { cx: 28, cy: 32, r: 1.6, color: "hsl(var(--chart-2))", opacity: 0.2, className: "ai-node-pulse" },
  { cx: 50, cy: 14, r: 2, color: "hsl(var(--primary))", opacity: 0.22, className: "ai-node-drift" },
  { cx: 72, cy: 30, r: 1.6, color: "hsl(var(--chart-3))", opacity: 0.18, className: "ai-node-pulse-slow" },
  { cx: 88, cy: 16, r: 2.4, color: "hsl(var(--accent))", opacity: 0.25, className: "ai-node-drift-slow" },
  { cx: 20, cy: 55, r: 1.8, color: "hsl(var(--chart-3))", opacity: 0.18, className: "ai-node-pulse" },
  { cx: 50, cy: 60, r: 2.6, color: "hsl(var(--primary))", opacity: 0.22, className: "ai-node-drift" },
  { cx: 80, cy: 56, r: 1.8, color: "hsl(var(--chart-2))", opacity: 0.18, className: "ai-node-pulse-slow" },
  { cx: 14, cy: 85, r: 2, color: "hsl(var(--chart-2))", opacity: 0.2, className: "ai-node-drift" },
  { cx: 36, cy: 78, r: 1.5, color: "hsl(var(--accent))", opacity: 0.16, className: "ai-node-pulse-slow" },
  { cx: 64, cy: 80, r: 1.5, color: "hsl(var(--chart-3))", opacity: 0.16, className: "ai-node-pulse" },
  { cx: 86, cy: 86, r: 2.2, color: "hsl(var(--primary))", opacity: 0.2, className: "ai-node-drift-slow" },
];

const edges: Edge[] = [
  { x1: 12, y1: 18, x2: 28, y2: 32, color: "hsl(var(--accent))", opacity: 0.16, className: "ai-edge-flow" },
  { x1: 28, y1: 32, x2: 50, y2: 14, color: "hsl(var(--primary))", opacity: 0.14, className: "ai-edge-flow-slow" },
  { x1: 50, y1: 14, x2: 72, y2: 30, color: "hsl(var(--chart-3))", opacity: 0.14, className: "ai-edge-flow" },
  { x1: 72, y1: 30, x2: 88, y2: 16, color: "hsl(var(--accent))", opacity: 0.16, className: "ai-edge-flow-slow" },
  { x1: 28, y1: 32, x2: 20, y2: 55, color: "hsl(var(--chart-2))", opacity: 0.12, className: "ai-edge-flow" },
  { x1: 50, y1: 14, x2: 50, y2: 60, color: "hsl(var(--primary))", opacity: 0.12, className: "ai-edge-flow-slow" },
  { x1: 72, y1: 30, x2: 80, y2: 56, color: "hsl(var(--chart-3))", opacity: 0.12, className: "ai-edge-flow" },
  { x1: 20, y1: 55, x2: 50, y2: 60, color: "hsl(var(--chart-2))", opacity: 0.14, className: "ai-edge-flow-slow" },
  { x1: 50, y1: 60, x2: 80, y2: 56, color: "hsl(var(--accent))", opacity: 0.14, className: "ai-edge-flow" },
  { x1: 20, y1: 55, x2: 14, y2: 85, color: "hsl(var(--primary))", opacity: 0.12, className: "ai-edge-flow-slow" },
  { x1: 50, y1: 60, x2: 36, y2: 78, color: "hsl(var(--chart-3))", opacity: 0.12, className: "ai-edge-flow" },
  { x1: 50, y1: 60, x2: 64, y2: 80, color: "hsl(var(--chart-2))", opacity: 0.12, className: "ai-edge-flow-slow" },
  { x1: 80, y1: 56, x2: 86, y2: 86, color: "hsl(var(--accent))", opacity: 0.12, className: "ai-edge-flow" },
  { x1: 14, y1: 85, x2: 36, y2: 78, color: "hsl(var(--primary))", opacity: 0.1, className: "ai-edge-flow-slow" },
  { x1: 36, y1: 78, x2: 64, y2: 80, color: "hsl(var(--chart-3))", opacity: 0.1, className: "ai-edge-flow" },
  { x1: 64, y1: 80, x2: 86, y2: 86, color: "hsl(var(--chart-2))", opacity: 0.1, className: "ai-edge-flow-slow" },
];

/**
 * Decorative, purely presentational "neural network / particle constellation"
 * overlay. Renders a symmetric grid of nodes connected by thin edges with
 * gentle CSS-driven pulse/drift animations. Safe to use in both LTR and RTL
 * layouts since the layout has no left/right-specific accents.
 */
const AINetworkBackground = ({ className }: { className?: string }) => {
  return (
    <div
      className={cn("absolute inset-0 pointer-events-none select-none", className)}
      aria-hidden="true"
    >
      <svg
        className="w-full h-full"
        viewBox="0 0 100 100"
        preserveAspectRatio="xMidYMid slice"
        xmlns="http://www.w3.org/2000/svg"
      >
        <g strokeWidth={0.15} fill="none">
          {edges.map((edge, i) => (
            <line
              key={`edge-${i}`}
              x1={edge.x1}
              y1={edge.y1}
              x2={edge.x2}
              y2={edge.y2}
              stroke={edge.color}
              strokeOpacity={edge.opacity}
              className={edge.className}
            />
          ))}
        </g>
        <g>
          {nodes.map((node, i) => (
            <circle
              key={`node-${i}`}
              cx={node.cx}
              cy={node.cy}
              r={node.r}
              fill={node.color}
              fillOpacity={node.opacity}
              className={node.className}
            />
          ))}
        </g>
      </svg>
    </div>
  );
};

export default AINetworkBackground;
