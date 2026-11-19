// One table per platform: tool name → category. Unknown names are `other`; we never guess.
import type { Category } from './types.ts';

export interface CategoryTable {
  platform: string;
  /** Exact tool names. */
  tools: Readonly<Record<string, Category>>;
  /** Connector (MCP) tool names: returns the connector id, or undefined when the name is not a connector tool. */
  connectorOf(tool: string): string | undefined;
}

export function categoryOf(table: CategoryTable, tool: string): Category {
  const known = table.tools[tool];
  if (known) return known;
  return table.connectorOf(tool) !== undefined ? 'connector' : 'other';
}

/** The short tool name without the connector prefix, for labels. */
export function shortTool(table: CategoryTable, tool: string): string {
  const c = table.connectorOf(tool);
  if (c === undefined) return tool;
  const i = tool.lastIndexOf('__');
  return i >= 0 ? tool.slice(i + 2) : tool;
}
