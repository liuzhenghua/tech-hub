import { Peer, SerializationType, type DataConnection } from 'peerjs';
import { generateCode, pairingCode, peerError } from './pairing';

const PREFIX = 'tech-hub-lan-v1-';
type SessionView = {
  code: (value: string) => void;
  request: () => void;
  ready: (channel: RTCDataChannel) => void;
  status: (value: string) => void;
  failed: (value: string) => void;
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
  constructor(private view: SessionView) {}
  private arm(timeout: number, message: string) {
    clearTimeout(this.timer);
    this.timer = setTimeout(() => this.fail(message), timeout);
  }
  private fail(message: string) {
    if (!this.events.signal.aborted) this.view.failed(message);
  }
  private async online(id: string) {
    this.events.signal.throwIfAborted();
    const client = new Peer(id, {
      debug: 0,
      secure: true,
      config: { iceServers: [] },
    });
    this.client = client;
    await register(client, this.events.signal);
    this.events.signal.throwIfAborted();
    client.on('error', (error) => {
      if (!this.paired) this.fail(peerError(error));
    });
    client.on('disconnected', () => {
      if (!this.paired) this.fail('配对服务已断开，请重新开始。');
    });
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
    this.view.status('正在连接对方，连接后等待对方确认…');
    const connection = client.connect(PREFIX + code, {
      serialization: SerializationType.None,
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
    this.arm(
      30_000,
      '建立点对点连接超时，请检查内网权限、防火墙和网络隔离设置。',
    );
    connection.on('error', (error) => this.fail(peerError(error)));
    connection.on('close', () =>
      this.fail('对方已断开或拒绝配对，请重新开始。'),
    );
    connection.on('open', () => {
      this.arm(120_000, '等待配对确认超时，请重新开始。');
      if (host) {
        this.waitingApproval = true;
        this.view.request();
      }
    });
    if (!host)
      connection.on('data', (data) => {
        if (data === 'tech-hub:paired:v1' && !this.paired) this.ready();
      });
  }
  respond(accept: boolean) {
    if (!this.waitingApproval || !this.connection?.open) return;
    this.waitingApproval = false;
    if (!accept) {
      this.fail('已拒绝配对，请重新生成配对码。');
      return;
    }
    this.connection.dataChannel.send('tech-hub:paired:v1');
    this.ready();
  }
  private ready() {
    clearTimeout(this.timer);
    this.paired = true;
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
