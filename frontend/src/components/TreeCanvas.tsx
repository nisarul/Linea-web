// SPDX-License-Identifier: AGPL-3.0-or-later
import { useEffect, useRef, useState } from "react";
import Konva from "konva";
import * as d3 from "d3-hierarchy";
import { type Person, preferredName, lifeRange } from "@/lib/persons";
import { type Relationship } from "@/lib/relationships";

/**
 * TreeCanvas renders a top-down ancestry / descendancy tree.
 *
 * Inputs:
 *   persons        — full person list for the genealogy.
 *   relationships  — full relationship list (parent/child + marriage).
 *   focusId        — the person at the root.
 *   direction      — "ancestors" walks parents; "descendants" walks children.
 *
 * The layout uses d3-hierarchy.tree(); rendering is Konva. Pan +
 * mouse-wheel zoom are wired in. Clicking a node calls onSelect.
 */
export interface TreeCanvasProps {
  persons: Person[];
  relationships: Relationship[];
  focusId: string;
  direction?: "ancestors" | "descendants";
  height?: number;
  onSelect?: (personId: string) => void;
}

interface Node {
  id: string;
  person: Person | null;
  children?: Node[];
}

const NODE_W = 160;
const NODE_H = 56;
const H_GAP = 32;
const V_GAP = 28;
const MAX_DEPTH = 6;

export function TreeCanvas({
  persons,
  relationships,
  focusId,
  direction = "ancestors",
  height = 480,
  onSelect,
}: TreeCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<Konva.Stage | null>(null);
  const [width, setWidth] = useState(0);

  // Resize observer.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setWidth(el.clientWidth));
    ro.observe(el);
    setWidth(el.clientWidth);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const el = containerRef.current;
    if (!el || width === 0) return;

    const stage = new Konva.Stage({
      container: el,
      width,
      height,
      draggable: true,
    });
    stageRef.current = stage;

    const layer = new Konva.Layer();
    stage.add(layer);

    const personIndex = new Map(persons.map((p) => [p.id.value, p]));
    const root = buildHierarchy(focusId, personIndex, relationships, direction);

    const rootNode = d3
      .hierarchy<Node>(root, (d) => d.children)
      .count();

    const layout = d3
      .tree<Node>()
      .nodeSize([NODE_W + H_GAP, NODE_H + V_GAP])
      .separation((a, b) => (a.parent === b.parent ? 1 : 1.2));

    const tree = layout(rootNode);

    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;
    tree.descendants().forEach((d) => {
      const y = direction === "ancestors" ? -d.y : d.y;
      if (d.x < minX) minX = d.x;
      if (d.x > maxX) maxX = d.x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    });
    const padding = 32;
    const treeW = maxX - minX + NODE_W + padding * 2;
    const treeH = maxY - minY + NODE_H + padding * 2;
    const offsetX = (width - treeW) / 2 - minX + padding;
    const offsetY = (height - treeH) / 2 - minY + padding;

    // Edges first (so nodes paint on top).
    tree.links().forEach((l) => {
      const sx = l.source.x + offsetX + NODE_W / 2;
      const sy = (direction === "ancestors" ? -l.source.y : l.source.y) + offsetY + NODE_H / 2;
      const tx = l.target.x + offsetX + NODE_W / 2;
      const ty = (direction === "ancestors" ? -l.target.y : l.target.y) + offsetY + NODE_H / 2;
      const midY = (sy + ty) / 2;
      const line = new Konva.Line({
        points: [sx, sy, sx, midY, tx, midY, tx, ty],
        stroke: cssVar("--color-border-default") || "#9ca3af",
        strokeWidth: 1,
        lineCap: "round",
        lineJoin: "round",
      });
      layer.add(line);
    });

    // Nodes.
    tree.descendants().forEach((d) => {
      const x = d.data.id === focusId ? d.x + offsetX : d.x + offsetX;
      const y = (direction === "ancestors" ? -d.y : d.y) + offsetY;
      const isFocus = d.data.id === focusId;
      const group = new Konva.Group({ x, y });
      const rect = new Konva.Rect({
        width: NODE_W,
        height: NODE_H,
        cornerRadius: 8,
        fill: cssVar("--color-bg-surface") || "#ffffff",
        stroke: isFocus
          ? cssVar("--color-accent") || "#6366f1"
          : cssVar("--color-border-default") || "#9ca3af",
        strokeWidth: isFocus ? 2 : 1,
        shadowColor: "#000",
        shadowBlur: 6,
        shadowOpacity: 0.06,
        shadowOffsetY: 2,
      });
      group.add(rect);

      const name = new Konva.Text({
        x: 10,
        y: 8,
        width: NODE_W - 20,
        text: d.data.person ? preferredName(d.data.person) : "Unknown",
        fontSize: 13,
        fontStyle: "600",
        fontFamily: "Inter, system-ui, sans-serif",
        fill: cssVar("--color-fg-primary") || "#0f172a",
        ellipsis: true,
        wrap: "none",
      });
      group.add(name);

      const meta = new Konva.Text({
        x: 10,
        y: 30,
        width: NODE_W - 20,
        text: d.data.person ? lifeRange(d.data.person) : "",
        fontSize: 11,
        fontFamily: "Inter, system-ui, sans-serif",
        fill: cssVar("--color-fg-muted") || "#6b7280",
        ellipsis: true,
        wrap: "none",
      });
      group.add(meta);

      group.on("mouseenter", () => {
        document.body.style.cursor = "pointer";
        rect.stroke(cssVar("--color-accent") || "#6366f1");
      });
      group.on("mouseleave", () => {
        document.body.style.cursor = "default";
        rect.stroke(
          isFocus
            ? cssVar("--color-accent") || "#6366f1"
            : cssVar("--color-border-default") || "#9ca3af",
        );
      });
      group.on("click tap", () => {
        if (onSelect && d.data.person) onSelect(d.data.id);
      });
      layer.add(group);
    });

    // Mouse-wheel zoom about pointer.
    const onWheel = (e: Konva.KonvaEventObject<WheelEvent>) => {
      e.evt.preventDefault();
      const oldScale = stage.scaleX();
      const pointer = stage.getPointerPosition();
      if (!pointer) return;
      const scaleBy = 1.06;
      const direction = e.evt.deltaY > 0 ? -1 : 1;
      const newScale = clamp(direction > 0 ? oldScale * scaleBy : oldScale / scaleBy, 0.25, 3);
      const mp = {
        x: (pointer.x - stage.x()) / oldScale,
        y: (pointer.y - stage.y()) / oldScale,
      };
      stage.scale({ x: newScale, y: newScale });
      stage.position({
        x: pointer.x - mp.x * newScale,
        y: pointer.y - mp.y * newScale,
      });
    };
    stage.on("wheel", onWheel);

    layer.draw();

    return () => {
      stage.destroy();
      stageRef.current = null;
      document.body.style.cursor = "default";
    };
  }, [persons, relationships, focusId, direction, width, height, onSelect]);

  return (
    <div
      ref={containerRef}
      className="w-full overflow-hidden rounded-(--radius-lg) border border-(--color-border-subtle) bg-(--color-bg-canvas)"
      style={{ height }}
    />
  );
}

function buildHierarchy(
  rootId: string,
  index: Map<string, Person>,
  rels: Relationship[],
  direction: "ancestors" | "descendants",
): Node {
  // Build parent->children maps from PARENT_CHILD relationships.
  const parentsOf = new Map<string, string[]>(); // child -> [parent...]
  const childrenOf = new Map<string, string[]>(); // parent -> [child...]
  for (const r of rels) {
    if (r.type !== "RELATIONSHIP_TYPE_PARENT_CHILD") continue;
    const parent = r.fromPerson.value;
    const child = r.toPerson.value;
    if (!childrenOf.has(parent)) childrenOf.set(parent, []);
    childrenOf.get(parent)!.push(child);
    if (!parentsOf.has(child)) parentsOf.set(child, []);
    parentsOf.get(child)!.push(parent);
  }

  const seen = new Set<string>();
  const make = (id: string, depth: number): Node => {
    seen.add(id);
    const p = index.get(id) ?? null;
    const node: Node = { id, person: p };
    if (depth >= MAX_DEPTH) return node;
    const adj = direction === "ancestors" ? parentsOf.get(id) : childrenOf.get(id);
    if (adj && adj.length > 0) {
      node.children = adj
        .filter((cid) => !seen.has(cid))
        .map((cid) => make(cid, depth + 1));
    }
    return node;
  };
  return make(rootId, 0);
}

function clamp(n: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, n));
}

function cssVar(name: string): string | null {
  if (typeof window === "undefined") return null;
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return v || null;
}
