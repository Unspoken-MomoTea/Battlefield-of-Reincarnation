const REPOSITORY = 'Unspoken-MomoTea/Battlefield-of-Reincarnation';
const TAGS_URL = `https://api.github.com/repos/${REPOSITORY}/tags?per_page=100`;

export function validCommitSha(value) {
  return /^[0-9a-f]{40}$/iu.test(String(value || '').trim());
}

function parseTag(tag, prefix) {
  const escaped = String(prefix).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = String(tag || '').match(new RegExp(`^${escaped}(\\d+)\\.(\\d+)\\.(\\d+)$`, 'u'));
  if (!match) return null;
  return {
    major: Number(match[1]),
    minor: Number(match[2]),
    patch: Number(match[3]),
    version: `${match[1]}.${match[2]}.${match[3]}`,
  };
}

function compareVersion(left, right) {
  return (left.major - right.major) || (left.minor - right.minor) || (left.patch - right.patch);
}

export async function latestTaggedRelease(fetchImpl, prefix) {
  const response = await fetchImpl(TAGS_URL, {
    headers: { Accept: 'application/vnd.github+json' },
    cache: 'no-store',
  });
  if (!response.ok) throw new Error(`无法读取 ${prefix} 正式版本：GitHub HTTP ${response.status}`);
  const rows = await response.json();
  const candidates = (Array.isArray(rows) ? rows : [])
    .map(row => {
      const parsed = parseTag(row?.name, prefix);
      const sha = String(row?.commit?.sha || '').trim();
      return parsed && validCommitSha(sha) ? { ...parsed, tag: String(row.name), sha } : null;
    })
    .filter(Boolean)
    .sort((a, b) => compareVersion(b, a));
  if (!candidates.length) return null;
  const latest = candidates[0];
  return {
    version: latest.version,
    tag: latest.tag,
    sha: latest.sha,
    releaseSource: 'tag',
  };
}
