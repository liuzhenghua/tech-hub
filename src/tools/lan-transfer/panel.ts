import { PairSession } from './session';
import { peerError, pairingCode } from './pairing';
import { Transfer } from './transfer';
import { mountFileInput } from './file-input';

export function mountTransfer() {
  const $ = <T extends HTMLElement>(id: string) =>
    document.getElementById(id) as T;
  const button = (id: string) => $<HTMLButtonElement>(id);
  const text = (id: string, value: string) => {
    $(id).textContent = value;
    if (id === 'connection-status') $('dialog-status').textContent = value;
  };
  const events = new AbortController();
  let session: PairSession | undefined;
  let transfer: Transfer | undefined;
  let busy = false;
  let downloadUrl: string | undefined;
  const fileInput = mountFileInput(
    $('drop-zone').closest('main')!,
    () => busy,
    update,
    (value) => text('transfer-status', value),
  );
  const dialog = $<HTMLDialogElement>('connection-dialog');
  button('configure').addEventListener('click', () => dialog.showModal(), {
    signal: events.signal,
  });
  button('close-dialog').addEventListener('click', () => dialog.close(), {
    signal: events.signal,
  });
  function update() {
    const supported = window.isSecureContext && 'RTCPeerConnection' in window;
    const open = Boolean(transfer);
    button('connect').disabled = button('generate').disabled =
      !supported || Boolean(session);
    $<HTMLInputElement>('code').disabled = Boolean(session);
    fileInput.update();
    button('send').disabled = !open || busy || !fileInput.get();
  }
  function release() {
    if (downloadUrl) URL.revokeObjectURL(downloadUrl);
    downloadUrl = undefined;
    $('download').removeAttribute('href');
    $('download-area').hidden = true;
  }
  function reset() {
    session?.dispose();
    session = undefined;
    transfer = undefined;
    $<HTMLInputElement>('my-code').value = '';
    button('copy-code').disabled = true;
    $('pair-request').hidden = true;
    busy = false;
    $('incoming').hidden = true;
    progress(0, 1);
    text('connection-status', '尚未连接');
    text('transfer-status', '连接后选择文件发送。');
    update();
  }
  function progress(bytes: number, total: number) {
    $<HTMLProgressElement>('progress').value = total ? bytes / total : 1;
    text(
      'progress-label',
      `${total ? Math.round((bytes / total) * 100) : 100}%`,
    );
  }
  function attach(current: PairSession, channel: RTCDataChannel) {
    const signal = current.events.signal;
    transfer = new Transfer(channel, signal, {
      status: (value) => text('transfer-status', value),
      progress,
      request: (name, size) => {
        text(
          'request',
          `对方希望发送：${name}（${size.toLocaleString()} 字节）。是否接收？`,
        );
        $('incoming').hidden = false;
      },
      busy: (value) => {
        busy = value;
        if (!value) $('incoming').hidden = true;
        update();
      },
      received: (name, blob) => {
        release();
        downloadUrl = URL.createObjectURL(blob);
        const link = $<HTMLAnchorElement>('download');
        link.href = downloadUrl;
        link.download = name;
        link.textContent = `保存：${name}`;
        $('download-area').hidden = false;
      },
    });
    $('pair-request').hidden = true;
    $<HTMLInputElement>('my-code').value = '';
    button('copy-code').disabled = true;
    dialog.close();
    text('connection-status', '已连接 · 双方可以发送文件');
    update();
  }
  async function start(mode: 'host' | 'join') {
    if (session) return;
    let code = '';
    try {
      if (mode === 'join')
        code = pairingCode($<HTMLInputElement>('code').value);
    } catch (error) {
      text('connection-status', peerError(error));
      return;
    }
    const current = new PairSession({
      code: (value) => {
        $<HTMLInputElement>('my-code').value = value;
        button('copy-code').disabled = false;
      },
      request: () => {
        $('pair-request').hidden = false;
        if (!dialog.open) dialog.showModal();
      },
      ready: (channel) => {
        if (session === current) attach(current, channel);
      },
      status: (value) => {
        if (session === current) text('connection-status', value);
      },
      failed: (value) => {
        if (session === current) {
          reset();
          text('connection-status', value);
        }
      },
    });
    session = current;
    update();
    text('connection-status', '正在连接 PeerJS Cloud…');
    try {
      if (mode === 'host') await current.host();
      else await current.join(code);
    } catch (error) {
      if (session !== current) return;
      reset();
      text('connection-status', peerError(error));
    } finally {
      if (session === current) {
        update();
      }
    }
  }
  button('generate').addEventListener('click', () => void start('host'), {
    signal: events.signal,
  });
  button('connect').addEventListener('click', () => void start('join'), {
    signal: events.signal,
  });
  for (const action of ['allow-pair', 'deny-pair'])
    button(action).addEventListener(
      'click',
      () => {
        try {
          session?.respond(action === 'allow-pair');
        } catch {
          reset();
          text('connection-status', '配对失败，请重新开始。');
        }
      },
      { signal: events.signal },
    );
  button('copy-code').addEventListener(
    'click',
    () => {
      const current = session;
      const input = $<HTMLInputElement>('my-code');
      void navigator.clipboard.writeText(input.value).catch(() => {
        if (session !== current) return;
        input.select();
        text('connection-status', '请手动复制已选中的配对码。');
      });
    },
    { signal: events.signal },
  );
  button('reset').addEventListener('click', reset, { signal: events.signal });
  button('send').addEventListener(
    'click',
    () => {
      try {
        const file = fileInput.get();
        if (file) transfer?.send(file);
      } catch (error) {
        text(
          'transfer-status',
          error instanceof Error ? error.message : '发送失败。',
        );
      }
    },
    { signal: events.signal },
  );
  for (const action of ['accept', 'reject'])
    button(action).addEventListener(
      'click',
      () => {
        try {
          transfer?.respond(action === 'accept');
          $('incoming').hidden = true;
        } catch {
          text('transfer-status', '连接已断开，请重新开始。');
        }
      },
      { signal: events.signal },
    );
  button('release').addEventListener('click', release, {
    signal: events.signal,
  });
  function dispose() {
    reset();
    release();
    fileInput.dispose();
    dialog.close();
    events.abort();
  }
  window.addEventListener(
    'pagehide',
    (event) => {
      if (!event.persisted) dispose();
    },
    { signal: events.signal },
  );
  if (!window.isSecureContext || !('RTCPeerConnection' in window)) {
    text(
      'connection-status',
      '当前环境不支持 WebRTC，请使用新版浏览器并通过 HTTPS 或 localhost 打开。',
    );
    button('connect').disabled = true;
  }
  update();
  return dispose;
}
