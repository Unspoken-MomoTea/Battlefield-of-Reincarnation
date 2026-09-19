const REASON_MAP = {
  '恶意': 'malicious',
  '恶意内容': 'malicious',
  '损坏': 'broken',
  '内容损坏': 'broken',
  '不当': 'inappropriate',
  '不当内容': 'inappropriate',
  '盗用': 'stolen',
  '疑似盗用': 'stolen',
  '其他': 'other',
};

export function promptProjectReport(host) {
  const raw = host.prompt?.(
    '举报原因：请输入“恶意”“损坏”“不当”“盗用”或“其他”',
    '其他',
  );
  if (raw == null) return null;
  const reason = REASON_MAP[String(raw).trim()];
  if (!reason) throw new Error('举报原因无效，请输入：恶意、损坏、不当、盗用或其他');
  const details = host.prompt?.('补充说明（可留空）', '') ?? '';
  return { reason, details };
}
