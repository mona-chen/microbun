import { URL } from 'url';

/**
 * Extracts the port number from a given URL string.
 * If no port is explicitly defined, returns default based on protocol.
 * 
 * @param rawUrl - The full URL string
 * @returns The extracted port number as a number
 */
export function getPortFromUrl(rawUrl: string): number {
  try {
    const url = new URL(rawUrl);

    if (url.port) return parseInt(url.port, 10);

    // Fallback to default ports
    if (url.protocol === 'http:') return 80;
    if (url.protocol === 'https:') return 443;

    throw new Error(`No port found and unknown protocol: ${url.protocol}`);
  } catch (err) {
    throw new Error(`Invalid URL provided: ${rawUrl}`);
  }
}
