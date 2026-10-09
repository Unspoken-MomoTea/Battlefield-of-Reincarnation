const REPOSITORY = 'Unspoken-MomoTea/Battlefield-of-Reincarnation';

const JSDELIVR_PATTERN = new RegExp(
  `(https:\\/\\/(?:(?:testingcf|cdn)\\.)?jsdelivr\\.net\\/gh\\/Unspoken-MomoTea\\/Battlefield-of-Reincarnation@)([^/'"\\s]+)(\\/src\\/CreativeWorkshop\\/index\\.js)`,
  'gu',
);

export function workshopLoaderRefs(content) {
  const refs = [];
  JSDELIVR_PATTERN.lastIndex = 0;
  let match;
  while ((match = JSDELIVR_PATTERN.exec(String(content || '')))) {
    refs.push(match[2]);
  }
  JSDELIVR_PATTERN.lastIndex = 0;
  return refs;
}


export function workshopLoaderChannel(content) {
  const value = String(content || '').toLowerCase();
  if (value.includes('workshop-test.6661816.xyz')) return 'testing';
  if (value.includes('workshop.6661816.xyz')) return 'stable';
  return '';
}

export function isWorkshopLoaderScript(script) {
  const content = String(script?.content || '');
  if (!content) return false;
  if (workshopLoaderRefs(content).length) return true;

  // 兜底识别未使用 jsDelivr、但仍直接导入本仓库工坊入口的 loader。
  return (
    content.includes(REPOSITORY) &&
    content.includes('/src/CreativeWorkshop/index.js')
  );
}

export function rewriteWorkshopLoaderContent(content, ref) {
  JSDELIVR_PATTERN.lastIndex = 0;
  const next = String(content || '').replace(JSDELIVR_PATTERN, `$1${ref}$3`);
  JSDELIVR_PATTERN.lastIndex = 0;
  return next;
}
