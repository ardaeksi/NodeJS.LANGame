// Loads and caches avatar images so the renderer can draw them every frame
// without re-fetching. Returns an HTMLImageElement (may not be loaded yet).
const cache = new Map();

export function getAvatarImage(file) {
  if (!file) return null;
  if (cache.has(file)) return cache.get(file);
  const img = new Image();
  img.decoding = 'async';
  img.src = 'avatars/' + encodeURIComponent(file);
  cache.set(file, img);
  return img;
}
