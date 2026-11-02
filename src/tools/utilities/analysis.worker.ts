import { compareLines, normalizeJSON } from './diff';
import { testRegex } from './regex';
self.onmessage = (event: MessageEvent) => {
  try {
    const data = event.data;
    if (data.kind === 'regex')
      self.postMessage({
        result: testRegex(data.pattern, data.flags, data.text),
      });
    else {
      const left = data.json ? normalizeJSON(data.left) : data.left;
      const right = data.json ? normalizeJSON(data.right) : data.right;
      self.postMessage({ result: compareLines(left, right) });
    }
  } catch (error) {
    self.postMessage({
      error: error instanceof Error ? error.message : String(error),
    });
  }
};
