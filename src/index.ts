interface McpToolDefinition {
  name: string;
  description: string;
  inputSchema: {
    type: 'object';
    properties: Record<string, unknown>;
    required?: string[];
  };
}

interface McpToolExport {
  tools: McpToolDefinition[];
  callTool: (name: string, args: Record<string, unknown>) => Promise<unknown>;
  meter?: { credits: number };
  cost?: Record<string, unknown>;
  provider?: string;
}

/**
 * Internet Archive Wayback Machine MCP.
 *
 * Keyless wrapper over the Wayback Machine "available" API and the CDX search
 * API. Look up the archived/historical version of a web page, list every
 * captured snapshot of a URL over time, and find out when a URL was first
 * archived. No authentication required.
 */


const UA = 'pipeworx/1.0 (+https://pipeworx.io)';
const AVAILABLE = 'https://archive.org/wayback/available';
const CDX = 'https://web.archive.org/cdx/search/cdx';

const tools: McpToolExport['tools'] = [
  {
    name: 'get_snapshot',
    description:
      'Look up the archived/historical version of a web page in the Internet Archive Wayback Machine. Returns the closest available snapshot (its Wayback URL, timestamp and HTTP status). Pass a timestamp to find the snapshot nearest a specific date; omit it to get the latest archived version.',
    inputSchema: {
      type: 'object',
      properties: {
        url: { type: 'string', description: 'The page URL to look up, e.g. "example.com" or "https://example.com/page".' },
        timestamp: {
          type: 'string',
          description: 'Optional target date as YYYYMMDD or YYYYMMDDhhmmss. The closest snapshot to this time is returned. Defaults to the latest snapshot.',
        },
      },
      required: ['url'],
    },
  },
  {
    name: 'list_snapshots',
    description:
      'List the captured snapshots of a URL in the Internet Archive Wayback Machine over time, using the CDX index. Each entry includes the capture timestamp, the original URL, HTTP status code, MIME type, content digest and a direct Wayback snapshot URL. Optionally restrict to a date range with from/to (YYYYMMDD).',
    inputSchema: {
      type: 'object',
      properties: {
        url: { type: 'string', description: 'The page URL to list archived snapshots for, e.g. "example.com".' },
        limit: { type: 'number', description: 'Maximum number of snapshots to return (default 50, max 1000).' },
        from: { type: 'string', description: 'Optional start of date range as YYYYMMDD.' },
        to: { type: 'string', description: 'Optional end of date range as YYYYMMDD.' },
      },
      required: ['url'],
    },
  },
  {
    name: 'get_capture_count',
    description:
      'Count how many times a URL has been captured by the Internet Archive Wayback Machine, and find when a URL was first and last archived. Returns the total number of captures plus the earliest and latest capture timestamps (YYYYMMDDhhmmss).',
    inputSchema: {
      type: 'object',
      properties: {
        url: { type: 'string', description: 'The page URL to count archived captures for, e.g. "example.com".' },
      },
      required: ['url'],
    },
  },
];

async function callTool(name: string, args: Record<string, unknown>): Promise<unknown> {
  switch (name) {
    case 'get_snapshot':
      return getSnapshot(reqStr(args, 'url'), optStr(args, 'timestamp'));
    case 'list_snapshots':
      return listSnapshots(reqStr(args, 'url'), args.limit as number | undefined, optStr(args, 'from'), optStr(args, 'to'));
    case 'get_capture_count':
      return getCaptureCount(reqStr(args, 'url'));
    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}

async function getSnapshot(url: string, timestamp?: string): Promise<unknown> {
  let target = `${AVAILABLE}?url=${encodeURIComponent(url)}`;
  if (timestamp) target += `&timestamp=${encodeURIComponent(timestamp)}`;

  const res = await fetch(target, { headers: { Accept: 'application/json', 'User-Agent': UA } });
  if (!res.ok) return httpError(res);

  const data = (await res.json()) as {
    archived_snapshots?: {
      closest?: { available: boolean; url: string; timestamp: string; status: string };
    };
  };
  const closest = data.archived_snapshots?.closest ?? null;
  return { url, found: !!closest, snapshot: closest };
}

async function listSnapshots(url: string, limit?: number, from?: string, to?: string): Promise<unknown> {
  const cappedLimit = Math.min(Math.max(1, Math.floor(limit ?? 50)), 1000);
  let target =
    `${CDX}?url=${encodeURIComponent(url)}&output=json&limit=${cappedLimit}` +
    `&fl=timestamp,original,statuscode,mimetype,digest`;
  if (from) target += `&from=${encodeURIComponent(from)}`;
  if (to) target += `&to=${encodeURIComponent(to)}`;

  const res = await fetch(target, { headers: { Accept: 'application/json', 'User-Agent': UA } });
  if (!res.ok) return httpError(res);

  const raw = (await res.json()) as string[][];
  // CDX returns an array-of-arrays; the first row is the column header.
  if (!Array.isArray(raw) || raw.length === 0) return { url, count: 0, snapshots: [] };

  const header = raw[0]!;
  const idx = (col: string) => header.indexOf(col);
  const ti = idx('timestamp');
  const oi = idx('original');
  const si = idx('statuscode');
  const mi = idx('mimetype');
  const di = idx('digest');

  const snapshots = raw.slice(1).map((row) => {
    const timestamp = row[ti] ?? '';
    const original = row[oi] ?? '';
    return {
      timestamp,
      original,
      statuscode: row[si] ?? '',
      mimetype: row[mi] ?? '',
      digest: row[di] ?? '',
      snapshot_url: `https://web.archive.org/web/${timestamp}/${original}`,
    };
  });

  return { url, count: snapshots.length, snapshots };
}

async function getCaptureCount(url: string): Promise<unknown> {
  const target = `${CDX}?url=${encodeURIComponent(url)}&output=json&fl=timestamp&limit=10000`;
  const res = await fetch(target, { headers: { Accept: 'application/json', 'User-Agent': UA } });
  if (!res.ok) return httpError(res);

  const raw = (await res.json()) as string[][];
  // First row is the header; remaining rows are individual captures.
  if (!Array.isArray(raw) || raw.length <= 1) {
    return { url, total_captures: 0, first: null, last: null };
  }
  const total = raw.length - 1;
  return {
    url,
    total_captures: total,
    first: raw[1]?.[0] ?? null,
    last: raw[raw.length - 1]?.[0] ?? null,
  };
}

async function httpError(res: Response): Promise<{ error: number; message: string }> {
  const text = await res.text().then((t) => t.slice(0, 200)).catch(() => '');
  return { error: res.status, message: text || res.statusText || 'request failed' };
}

function reqStr(args: Record<string, unknown>, key: string): string {
  const v = args[key];
  if (typeof v !== 'string' || !v.trim()) {
    throw new Error(`Required argument "${key}" is missing. Pass a URL string like "example.com".`);
  }
  return v;
}

function optStr(args: Record<string, unknown>, key: string): string | undefined {
  const v = args[key];
  return typeof v === 'string' && v.trim() ? v : undefined;
}

export default { tools, callTool, meter: { credits: 1 } } satisfies McpToolExport;
