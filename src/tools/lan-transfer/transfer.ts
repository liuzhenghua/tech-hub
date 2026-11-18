import { CHUNK_SIZE, parseControl, safeName, type Control } from './protocol';
import { waitUntil } from './wait';
type Incoming = {
  name: string;
  size: number;
  bytes: number;
  chunks: ArrayBuffer[];
  accepted: boolean;
};
type Outgoing = { file: File; phase: 'waiting' | 'sending' | 'confirming' };
export type TransferView = {
  status: (text: string) => void;
  progress: (bytes: number, total: number) => void;
  request: (name: string, size: number) => void;
  busy: (value: boolean) => void;
  received: (name: string, blob: Blob) => void;
};
export class Transfer {
  private incoming?: Incoming;
  private outgoing?: Outgoing;
  private timer?: ReturnType<typeof setTimeout>;
  constructor(
    private channel: RTCDataChannel,
    private signal: AbortSignal,
    private view: TransferView,
  ) {
    channel.addEventListener(
      'message',
      (event) => {
        try {
          this.message(event.data);
        } catch (error) {
          this.fail(error instanceof Error ? error.message : '传输失败。');
        }
      },
      { signal },
    );
    signal.addEventListener('abort', () => this.clear(), { once: true });
  }
  private control(message: Control) {
    this.channel.send(JSON.stringify(message));
  }
  private touch() {
    clearTimeout(this.timer);
    this.timer = setTimeout(
      () => this.fail('等待对方或传输超时，请重新连接。'),
      120_000,
    );
  }
  private clear() {
    clearTimeout(this.timer);
    this.incoming = undefined;
    this.outgoing = undefined;
    this.view.busy(false);
  }
  private fail(text: string) {
    this.clear();
    this.channel.close();
    this.view.status(text);
  }
  send(file: File) {
    if (this.incoming || this.outgoing) throw Error('请先完成当前传输。');
    parseControl(
      JSON.stringify({ type: 'file', name: file.name, size: file.size }),
    );
    this.control({ type: 'file', name: file.name, size: file.size });
    this.outgoing = { file, phase: 'waiting' };
    this.view.busy(true);
    this.view.progress(0, file.size);
    this.view.status(`等待对方接收：${file.name}`);
    this.touch();
  }
  respond(accept: boolean) {
    if (!this.incoming || this.incoming.accepted) return;
    this.control({ type: accept ? 'accept' : 'reject' });
    if (!accept) {
      this.clear();
      this.view.status('已拒绝接收。');
      return;
    }
    this.incoming.accepted = true;
    this.view.progress(0, this.incoming.size);
    this.view.status(`正在接收：${this.incoming.name}`);
    this.touch();
  }
  private message(data: unknown) {
    if (data instanceof ArrayBuffer) {
      this.chunk(data);
      return;
    }
    if (typeof data !== 'string') throw Error('不支持的传输数据。');
    const message = parseControl(data);
    switch (message.type) {
      case 'file':
        this.request(message);
        break;
      case 'accept':
        if (this.outgoing?.phase !== 'waiting') throw Error('传输状态无效。');
        this.outgoing.phase = 'sending';
        void this.pump(this.outgoing).catch((error: unknown) => {
          if (!this.signal.aborted)
            this.fail(error instanceof Error ? error.message : '发送失败。');
        });
        break;
      case 'reject':
        if (this.outgoing?.phase !== 'waiting') return;
        this.clear();
        this.view.status('对方拒绝接收或正在传输，请稍后重试。');
        break;
      case 'end':
        this.finish();
        break;
      case 'received':
        if (this.outgoing?.phase !== 'confirming')
          throw Error('传输状态无效。');
        this.clear();
        this.view.status('对方已完整接收文件。');
        break;
    }
  }
  private request(message: Extract<Control, { type: 'file' }>) {
    if (this.outgoing || this.incoming) {
      this.control({ type: 'reject' });
      return;
    }
    this.incoming = { ...message, bytes: 0, chunks: [], accepted: false };
    this.view.busy(true);
    this.view.request(message.name, message.size);
    this.touch();
  }
  private chunk(data: ArrayBuffer) {
    const incoming = this.incoming;
    if (
      !incoming?.accepted ||
      !data.byteLength ||
      data.byteLength !==
        Math.min(CHUNK_SIZE, incoming.size - incoming.bytes) ||
      incoming.bytes + data.byteLength > incoming.size
    )
      throw Error('文件数据与声明不符，已停止传输。');
    incoming.chunks.push(data);
    incoming.bytes += data.byteLength;
    this.view.progress(incoming.bytes, incoming.size);
    this.touch();
  }
  private finish() {
    const incoming = this.incoming;
    if (!incoming?.accepted || incoming.bytes !== incoming.size)
      throw Error('文件不完整，已停止传输。');
    this.view.received(
      safeName(incoming.name),
      new Blob(incoming.chunks, { type: 'application/octet-stream' }),
    );
    this.control({ type: 'received' });
    this.clear();
    this.view.progress(incoming.size, incoming.size);
    this.view.status('接收完成，请点击保存文件。');
  }
  private async pump(outgoing: Outgoing) {
    const { file } = outgoing;
    this.view.status(`正在发送：${file.name}`);
    for (let offset = 0; offset < file.size; offset += CHUNK_SIZE) {
      await waitUntil(
        () =>
          this.channel.bufferedAmount < 256 * 1024 ||
          this.channel.readyState !== 'open',
        this.signal,
      );
      const chunk = await file.slice(offset, offset + CHUNK_SIZE).arrayBuffer();
      this.signal.throwIfAborted();
      if (this.outgoing !== outgoing || this.channel.readyState !== 'open')
        throw Error('连接已断开。');
      this.channel.send(chunk);
      this.view.progress(
        Math.min(offset + chunk.byteLength, file.size),
        file.size,
      );
      this.touch();
    }
    this.signal.throwIfAborted();
    if (this.outgoing !== outgoing) return;
    outgoing.phase = 'confirming';
    this.control({ type: 'end' });
    this.view.status('发送完毕，等待对方确认完整接收…');
    this.touch();
  }
}
