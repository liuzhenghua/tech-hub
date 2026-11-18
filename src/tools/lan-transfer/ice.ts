// STUN discovers direct routes; no TURN means file bytes cannot use a relay.
export const ICE_CONFIG: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun.cloudflare.com:3478' },
  ],
};
export const DIRECT_TIMEOUT =
  '已找到对方，但点对点通道未连通。请在 VPN 中允许局域网直连，或临时断开双方 VPN 后重试；同时检查防火墙、Chrome 本地网络权限及 Wi-Fi 隔离。当前未配置 TURN 中继，网络阻止直连时无法传输。';
export function iceSummary(state: RTCIceConnectionState): string {
  const labels: Record<RTCIceConnectionState, string> = {
    new: '准备检测直连路径',
    checking: '正在检测直连路径；尚未建立文件通道',
    connected: '直连路径可用，正在打开文件通道',
    completed: '直连路径检测完成',
    disconnected: '直连路径暂时中断',
    failed: '所有直连路径检测失败',
    closed: '文件通道已关闭',
  };
  return labels[state];
}
