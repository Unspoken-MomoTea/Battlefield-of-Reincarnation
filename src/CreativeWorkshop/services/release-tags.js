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

export async function latestTaggedRelease(fetchImpl, prefixOrPrefixes) {
  const prefixes = (Array.isArray(prefixOrPrefixes) ? prefixOrPrefixes : [prefixOrPrefixes])
    .map(value => String(value || '').trim())
    .filter(Boolean);
  if (!prefixes.length) throw new Error('正式版本 Tag 前缀不能为空');

  const response = await fetchImpl(TAGS_URL, {
    headers: { Accept: 'application/vnd.github+json' },
    cache: 'no-store',
  });
  if (!response.ok) throw new Error(`无法读取 ${prefixes[0]} 正式版本：GitHub HTTP ${response.status}`);
  const rows = await response.json();
  const candidates = [];
  for (const row of Array.isArray(rows) ? rows : []) {
    const sha = String(row?.commit?.sha || '').trim();
    if (!validCommitSha(sha)) continue;
    for (let priority = 0; priority < prefixes.length; priority += 1) {
      const parsed = parseTag(row?.name, prefixes[priority]);
      if (!parsed) continue;
      candidates.push({ ...parsed, tag: String(row.name), sha, priority });
      break;
    }
  }
  candidates.sort((a, b) => compareVersion(b, a) || (a.priority - b.priority));
  if (!candidates.length) return null;
  const latest = candidates[0];
  return {
    version: latest.version,
    tag: latest.tag,
    sha: latest.sha,
    releaseSource: 'tag',
  };
}
