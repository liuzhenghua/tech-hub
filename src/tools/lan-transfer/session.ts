import type { Peer, DataConnection } from 'peerjs';
import { generateCode, pairingCode, peerError } from './pairing';
import { DIRECT_TIMEOUT, iceSummary } from './ice';

const PREFIX = 'tech-hub-lan-v1-';
type SessionView = {
  code: (value: string) => void;
  request: () => void;
  ready: (channel: RTCDataChannel) => void;
  status: (value: string) => void;
  failed: (value: string) => void;
  diagnostic: (value: string) => void;
};
function register(client: Peer, signal: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    const finish = (error?: unknown) => {
      clearTimeout(timer);
      client.off('open', opened);
      client.off('error', failed);
      signal.removeEventListener('abort', aborted);
      if (error) reject(error);
      else resolve();
    };
    const opened = () => finish();
    const failed = (error: unknown) => finish(error);
    const aborted = () => finish(new DOMException('已取消', 'AbortError'));
    const timer = setTimeout(
      () => finish(Error('连接 PeerJS Cloud 超时，请检查网络后重试。')),
      20_000,
    );
    client.once('open', opened);
    client.once('error', failed);
    signal.addEventListener('abort', aborted, { once: true });
    if (signal.aborted) aborted();
  });
}
export class PairSession {
  readonly events = new AbortController();
  private client?: Peer;
  private connection?: DataConnection;
  private timer?: ReturnType<typeof setTimeout>;
  private paired = false;
  private waitingApproval = false;
  private approved = false;
  constructor(
    private view: SessionView,
    private createPeer: (id: string) => Peer,
  ) {}
  private arm(timeout: number, message: string) {
    clearTimeout(this.timer);
    this.timer = setTimeout(() => this.fail(message), timeout);
  }
  private fail(message: string) {
    if (!this.events.signal.aborted) this.view.failed(message);
  }
  private async online(id: string) {
    this.events.signal.throwIfAborted();
    const client = this.createPeer(id);
    this.client = client;
    await register(client, this.events.signal);
    this.events.signal.throwIfAborted();
    client.on('error', (error) => {
      if (!this.paired) this.fail(peerError(error));
    });
    client.on('disconnected', () => {
      if (!this.paired) this.fail('配对服务已断开，请重新开始。');
    });
    this.view.diagnostic('已连接 PeerJS Cloud，配对服务可用。');
    return client;
  }
  async host() {
    for (let attempt = 0; attempt < 3; attempt++) {
      const code = generateCode();
      try {
        const client = await this.online(PREFIX + code);
        client.on('connection', (connection) => this.attach(connection, true));
        this.view.code(code);
        this.view.status(
          '将配对码告诉对方，等待对方输入。配对码 5 分钟内有效。',
        );
        this.arm(300_000, '配对码已过期，请重新生成。');
        return;
      } catch (error) {
        this.client?.destroy();
        this.events.signal.throwIfAborted();
        if ((error as { type?: string }).type !== 'unavailable-id') throw error;
      }
    }
    throw Error('暂时无法分配配对码，请重试。');
  }
  async join(value: string) {
    const code = pairingCode(value);
    const client = await this.online(`${PREFIX}client-${crypto.randomUUID()}`);
    this.events.signal.throwIfAborted();
    client.on('connection', (connection) => connection.close());
    this.view.status('正在向对方发送配对请求，同时检测直连路径…');
    const connection = client.connect(PREFIX + code, {
      serialization: 'raw',
      reliable: true,
    });
    this.attach(connection, false);
  }
  private attach(connection: DataConnection, host: boolean) {
    if (this.connection || this.events.signal.aborted) {
      connection.close();
      return;
    }
    this.connection = connection;
    this.arm(30_000, DIRECT_TIMEOUT);
    connection.on('error', (error) => {
      this.fail(
        error.type === 'negotiation-failed' ? DIRECT_TIMEOUT : peerError(error),
      );
    });
    connection.on('close', () =>
      this.fail('对方已断开或拒绝配对，请重新开始。'),
    );
    connection.on('iceStateChanged', (state) => {
      this.view.diagnostic(iceSummary(state));
      if (state === 'failed') this.fail(DIRECT_TIMEOUT);
    });
    if (host) {
      // PeerJS emits `connection` when signaling arrives, before ICE succeeds.
      this.waitingApproval = true;
      this.view.status('已收到对方请求，请确认配对；文件通道仍在建立中。');
      this.view.request();
    }
    connection.on('open', () => this.opened(host));
    if (!host)
      connection.on('data', (data) => {
        if (data === 'tech-hub:paired:v1' && !this.paired) this.ready();
      });
  }
  private opened(host: boolean) {
    if (host && this.approved) {
      this.confirm();
      return;
    }
    this.arm(120_000, '文件通道已连通，但等待配对确认超时，请重新开始。');
    this.view.status('文件通道已连通，等待生成配对码的一方确认。');
  }
  respond(accept: boolean) {
    if (!this.waitingApproval || !this.connection) return;
    this.waitingApproval = false;
    if (!accept) {
      this.fail('已拒绝配对，请重新生成配对码。');
      return;
    }
    this.approved = true;
    this.view.status('已允许配对，正在建立文件通道…');
    if (this.connection.open) this.confirm();
  }
  private confirm() {
    this.connection!.dataChannel.send('tech-hub:paired:v1');
    this.ready();
  }
  private ready() {
    clearTimeout(this.timer);
    this.paired = true;
    this.view.diagnostic('配对已确认，点对点文件通道已连通。');
    this.view.ready(this.connection!.dataChannel);
    // The one-time code stops accepting other peers after pairing.
    this.client?.disconnect();
  }
  dispose() {
    this.events.abort();
    clearTimeout(this.timer);
    this.connection?.removeAllListeners();
    this.client?.removeAllListeners();
    this.client?.destroy();
  }
}
