export const PREFIX = '/w2/';
const XOR_KEY = 0x57;
export function encode(url) {
    const bytes = new TextEncoder().encode(url);
    let binary = '';
    for (let i = 0; i < bytes.length; i++) {
        binary += String.fromCharCode(bytes[i] ^ XOR_KEY);
    }
    return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}
export function decode(encoded) {
    const pad = (4 - (encoded.length % 4)) % 4;
    const padded = encoded.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat(pad);
    const binary = atob(padded);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i) ^ XOR_KEY;
    }
    return new TextDecoder().decode(bytes);
}
export function toProxyUrl(target, base) {
    try {
        const resolved = base ? new URL(target, base).href : new URL(target).href;
        if (!resolved.startsWith('http://') && !resolved.startsWith('https://')) {
            return target;
        }
        return PREFIX + encode(resolved);
    }
    catch {
        return target;
    }
}
export function fromProxyPath(proxyPath) {
    const encoded = proxyPath.startsWith(PREFIX)
        ? proxyPath.slice(PREFIX.length)
        : proxyPath;
    return decode(encoded);
}
