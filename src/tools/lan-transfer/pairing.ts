export function pairingCode(value: string): string {
  const code = value.trim().replace(/[\s-]/g, '');
  if (!/^\d{6}$/.test(code)) throw Error('请输入对方提供的 6 位数字配对码。');
  return code;
}
export function generateCode(): string {
  return String(
    100000 + (crypto.getRandomValues(new Uint32Array(1))[0] % 900000),
  );
}
export function peerError(error: unknown): string {
  const type = (error as { type?: string })?.type;
  if (type === 'peer-unavailable')
    return '找不到该配对码，请确认对方页面仍在等待连接。';
  if (type === 'unavailable-id') return '配对码暂时被占用，请重新生成。';
  if (type === 'browser-incompatible')
    return '浏览器不支持点对点传输，请使用新版 Chrome / Edge。';
  if (
    ['network', 'server-error', 'socket-error', 'socket-closed'].includes(
      type || '',
    )
  )
    return '无法连接 PeerJS Cloud，请检查网络后重试。';
  return error instanceof Error ? error.message : '连接失败，请重新开始。';
}
