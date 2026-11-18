// Every wait has a deadline and is invalidated when the session is replaced.
export async function waitUntil(
  ready: () => boolean,
  signal: AbortSignal,
  timeout = 30_000,
): Promise<void> {
  const deadline = Date.now() + timeout;
  while (!signal.aborted && !ready()) {
    if (Date.now() > deadline) throw Error('操作超时，请断开后重新连接。');
    await new Promise<void>((resolve) => setTimeout(resolve, 50));
  }
  signal.throwIfAborted();
}
