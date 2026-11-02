/** Superseded jobs terminate their worker, including pathological regular expressions. */
export function createAnalysisTask<T>(
  success: (result: T) => void,
  failure: (message: string) => void,
) {
  let worker: Worker | undefined;
  let timeout: ReturnType<typeof setTimeout> | undefined;
  function cancel() {
    worker?.terminate();
    worker = undefined;
    clearTimeout(timeout);
  }
  function run(data: unknown) {
    cancel();
    try {
      const current = new Worker(
        new URL('./analysis.worker.ts', import.meta.url),
        { type: 'module' },
      );
      worker = current;
      current.onmessage = (event) => {
        if (worker !== current) return;
        cancel();
        if (event.data.error) failure(event.data.error);
        else success(event.data.result);
      };
      current.onerror = () => {
        if (worker !== current) return;
        cancel();
        failure('处理失败，请调整输入后重试。');
      };
      timeout = setTimeout(() => {
        if (worker !== current) return;
        cancel();
        failure('处理超过 2 秒，已停止。请简化表达式或缩小输入。');
      }, 2000);
      current.postMessage(data);
    } catch {
      cancel();
      failure('无法启动处理任务，请刷新后重试。');
    }
  }
  return { run, cancel };
}
