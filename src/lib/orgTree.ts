export type OUnit = { id: number; name: string; parentId: number | null; active: boolean };
export type ONode = OUnit & { depth: number; direct: number; total: number; children: ONode[] };

/** Build a tree. rootId = show only that branch; maxDepth = cut deeper levels; counts = direct headcount per unit id. */
export function buildTree(units: OUnit[], counts: Record<number, number>, opt: { rootId?: number | null; maxDepth?: number; hideInactive?: boolean } = {}): ONode[] {
  const { rootId = null, maxDepth = 99, hideInactive = false } = opt;
  const make = (u: OUnit, depth: number): ONode => {
    const allKids = units.filter((x) => x.parentId === u.id && (!hideInactive || x.active)).map((x) => make(x, depth + 1));
    const direct = counts[u.id] ?? 0;
    return { ...u, depth, direct, total: direct + allKids.reduce((a, k) => a + k.total, 0), children: depth >= maxDepth ? [] : allKids };
  };
  const roots = rootId ? units.filter((u) => u.id === rootId && (!hideInactive || u.active)) : units.filter((u) => u.parentId === null && (!hideInactive || u.active));
  return roots.map((u) => make(u, 1));
}
export const flatten = (nodes: ONode[]): ONode[] => nodes.flatMap((n) => [n, ...flatten(n.children)]);
