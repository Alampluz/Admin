// Pure helpers for the monthly chat Volume import (Duoke CSV/XLSX).
// Kept framework-free so they can be unit-tested with plain Node.

/**
 * Accumulate a file store's per-platform chats onto the brand id the match
 * loop actually picked (exact OR partial name match). Several file stores
 * mapping to one brand are summed.
 */
export function addChatsToBrand(chatsByBrandId, brandId, platChats) {
  const cur = chatsByBrandId[brandId] || (chatsByBrandId[brandId] = {});
  for (const [p, v] of Object.entries(platChats || {})) cur[p] = (cur[p] || 0) + (Number(v) || 0);
  return chatsByBrandId;
}

/** Set of platforms that actually appear in the imported file. */
export function platformsInFile(agg) {
  return new Set(Object.values(agg || {}).flatMap(pc => Object.keys(pc || {})));
}

/**
 * Build a brand's monthlyVol row for the imported month.
 * - Platforms present in the file are overwritten with the file value
 *   (0 if this brand has no rows for that platform).
 * - Every other platform keeps its existing (manually entered) value.
 * - Platforms with no value at all default to 0.
 */
export function mergeMonthlyVolRow(existingRow, fromFile, filePlats, platforms) {
  const row = { ...(existingRow || {}) };
  const file = fromFile || {};
  platforms.forEach(p => {
    if (filePlats.has(p)) row[p] = file[p] || 0;
    else if (row[p] == null) row[p] = 0;
  });
  return row;
}
