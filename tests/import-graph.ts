/** Import graph of the `src` tree. Not built yet. */
export type Graph = Map<string, string[]>;

export function importSpecifiers(_source: string): string[] {
  return [];
}

export function resolveSpecifier(_from: string, _spec: string, _files: ReadonlySet<string>): string | null {
  return null;
}

export function buildGraph(_sources: ReadonlyMap<string, string>): Graph {
  return new Map();
}

export function findCycles(_graph: Graph): string[][] {
  return [];
}

export function formatCycle(cycle: readonly string[]): string {
  return cycle.join(" → ");
}
