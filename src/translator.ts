import type { DataRecord, DataType, Translation } from "./registry";

export interface TranslationStep {
  from: string;
  to: string;
  description: string;
}

export interface TranslationResult {
  record: DataRecord;
  path: TranslationStep[];
}

/**
 * Translation graph over data types. Nodes are data types, edges are translations.
 * Requests for a type that is not stored are answered by the shortest chain of
 * translations from a stored type (e.g. °F -> °C -> K).
 */
export class Translator {
  private types = new Map<string, DataType>();
  private edges = new Map<string, Translation[]>();

  constructor(types: DataType[], translations: Translation[]) {
    for (const t of types) this.types.set(t.id, t);
    for (const tr of translations) {
      const from = this.types.get(tr.from);
      const to = this.types.get(tr.to);
      if (!from || !to) throw new Error(`Translation references unknown type: ${tr.from} -> ${tr.to}`);
      if (from.concept !== to.concept) {
        throw new Error(`Translation crosses concepts (${from.concept} -> ${to.concept}); only same-semantics translations are allowed`);
      }
      const list = this.edges.get(tr.from) ?? [];
      list.push(tr);
      this.edges.set(tr.from, list);
    }
  }

  getType(id: string): DataType | undefined {
    return this.types.get(id);
  }

  allTypes(): DataType[] {
    return [...this.types.values()];
  }

  /** Shortest translation path (BFS). Empty array if from === to, null if unreachable. */
  findPath(from: string, to: string): Translation[] | null {
    if (from === to) return [];
    const prev = new Map<string, Translation>();
    const seen = new Set([from]);
    const queue = [from];
    while (queue.length) {
      const current = queue.shift()!;
      for (const edge of this.edges.get(current) ?? []) {
        if (seen.has(edge.to)) continue;
        seen.add(edge.to);
        prev.set(edge.to, edge);
        if (edge.to === to) {
          const path: Translation[] = [];
          for (let node = to; node !== from; node = prev.get(node)!.from) path.unshift(prev.get(node)!);
          return path;
        }
        queue.push(edge.to);
      }
    }
    return null;
  }

  /** All types reachable from the given type, including itself. */
  reachableFrom(from: string): string[] {
    return this.allTypes()
      .map((t) => t.id)
      .filter((id) => this.findPath(from, id) !== null);
  }

  translate(record: DataRecord, from: string, to: string): TranslationResult {
    const path = this.findPath(from, to);
    if (path === null) throw new Error(`No translation path from ${from} to ${to}`);
    let current = record;
    for (const step of path) current = step.apply(current);
    return {
      record: current,
      path: path.map(({ from, to, description }) => ({ from, to, description })),
    };
  }
}
