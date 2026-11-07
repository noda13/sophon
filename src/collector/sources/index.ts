import type { SourceRegistry } from '../core/source';

export const sources: SourceRegistry = {
  stock: async () => (await import('./stock/run')).source,
  tech: async () => (await import('./tech/run')).source,
  issue: async () => (await import('./issue/run')).source,
  econ: async () => (await import('./econ/run')).source,
};
