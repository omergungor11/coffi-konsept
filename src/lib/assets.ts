import assetManifest from '../data/asset-manifest.json';
import detailAssetManifest from '../data/detail-asset-manifest.json';

/** Source media URLs mapped to files served by this Next application. */
const manifest: Record<string, string> = { ...assetManifest, ...detailAssetManifest };
const aliases = new Map<string, string>();
const normalizeUrl = (source: string) => source
  .replaceAll('&amp;', '&')
  .replaceAll('\\u002F', '/')
  .replaceAll('\\/', '/');

for (const [source, target] of Object.entries(manifest)) {
  aliases.set(source, target);
  aliases.set(normalizeUrl(source), target);
  aliases.set(source.replaceAll('&', '&amp;'), target);
  aliases.set(source.replaceAll('/', '\\u002F'), target);
}

export function localAssetUrl(source: string): string {
  const normalized = normalizeUrl(source);
  const exact = aliases.get(normalized);
  if (exact) return exact;
  const hashIndex = normalized.indexOf("#");
  if (hashIndex >= 0) {
    const base = normalized.slice(0, hashIndex);
    const target = aliases.get(base);
    if (target) return target + normalized.slice(hashIndex);
  }
  // Responsive optimizer variants can share the already mirrored original.
  if (normalized.includes('/_vercel/image?')) {
    try {
      const original = new URL(normalized, 'https://deltacafes.com').searchParams.get('url');
      if (original) return aliases.get(original) ?? source;
    } catch {
      // Preserve unknown values; malformed references must not break rendering.
    }
  }
  return source;
}

/** Rewrites src, srcset, poster, CSS url() and Rive data-file URLs. */
export function rewriteAssetUrls(markup: string): string {
  // Scan URL-shaped tokens once, then use a map lookup. A giant alternation of
  // every responsive variant makes a long page expensive to render in V8.
  return markup.replace(/https?:\/\/[^\s"'<>\\)]+|\/(?:_vercel\/image\?|_nuxt\/|fonts\/|imgs\/|assets\/|audios\/|videos\/)[^\s"'<>\\)]+/g,
    source => localAssetUrl(source));
}
