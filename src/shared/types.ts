export interface ProxyRequest {
  targetUrl: string;
  method: string;
  headers: Record<string, string>;
  body?: string;
}

export interface W2Config {
  prefix: string;
  wispPath: string;
  swPath: string;
  clientPath: string;
}

export const DEFAULT_CONFIG: W2Config = {
  prefix: '/w2/',
  wispPath: '/wisp/',
  swPath: '/w2-sw.js',
  clientPath: '/w2-client.js',
};
