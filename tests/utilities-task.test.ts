import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createAnalysisTask } from '../src/tools/utilities/task';

test('analysis tasks terminate superseded workers and reject stale results and errors', (context) => {
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'Worker');
  const workers: FakeWorker[] = [];
  class FakeWorker {
    onmessage?: (event: { data: { result?: unknown; error?: string } }) => void;
    onerror?: () => void;
    stopped = false;
    constructor() {
      workers.push(this);
    }
    terminate() {
      this.stopped = true;
    }
    postMessage(_data: unknown) {}
  }
  Object.defineProperty(globalThis, 'Worker', {
    configurable: true,
    value: FakeWorker,
  });
  context.after(() => {
    if (previous) Object.defineProperty(globalThis, 'Worker', previous);
    else Reflect.deleteProperty(globalThis, 'Worker');
  });
  const results: unknown[] = [],
    errors: string[] = [];
  const task = createAnalysisTask(
    (value) => results.push(value),
    (message) => errors.push(message),
  );
  context.after(task.cancel);
  task.run({ kind: 'regex' });
  task.run({ kind: 'diff' });
  assert.equal(workers[0].stopped, true);
  workers[0].onmessage!({ data: { result: 'stale' } });
  workers[0].onerror!();
  assert.equal(workers[1].stopped, false);
  workers[1].onmessage!({ data: { result: 'current' } });
  assert.deepEqual(results, ['current']);
  assert.deepEqual(errors, []);
  assert.equal(workers[1].stopped, true);
  task.run({});
  task.cancel();
  workers[2].onmessage!({ data: { result: 'disposed' } });
  assert.deepEqual(results, ['current']);
});

test('analysis timeout terminates a stuck worker and allows subsequent work', async (context) => {
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'Worker');
  let terminated = 0;
  class FakeWorker {
    terminate() {
      terminated++;
    }
    postMessage() {}
  }
  Object.defineProperty(globalThis, 'Worker', {
    configurable: true,
    value: FakeWorker,
  });
  context.after(() => {
    if (previous) Object.defineProperty(globalThis, 'Worker', previous);
    else Reflect.deleteProperty(globalThis, 'Worker');
  });
  let fail: (message: string) => void;
  const failed = new Promise<string>((resolve) => {
    fail = resolve;
  });
  const task = createAnalysisTask(
    () => assert.fail('stuck worker must not succeed'),
    (message) => fail(message),
  );
  context.after(task.cancel);
  task.run({});
  assert.match(await failed, /超过 2 秒/);
  assert.equal(terminated, 1);
  task.run({});
  task.cancel();
  assert.equal(terminated, 2);
});
