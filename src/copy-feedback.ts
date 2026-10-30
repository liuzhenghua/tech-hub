interface Feedback {
  nodes: Node[];
  label: string | null;
  title: string | null;
  timer: ReturnType<typeof setTimeout>;
}
/** One timer per button; repeated successes extend feedback without losing its label. */
export function createCopyFeedback() {
  const pending = new Map<HTMLElement, Feedback>();
  let disposed = false;
  function reset(button: HTMLElement) {
    const previous = pending.get(button);
    if (!previous) return;
    clearTimeout(previous.timer);
    button.replaceChildren(...previous.nodes);
    for (const [name, value] of [
      ['aria-label', previous.label],
      ['title', previous.title],
    ] as const) {
      if (value === null) button.removeAttribute(name);
      else button.setAttribute(name, value);
    }
    button.removeAttribute('data-copy-feedback');
    pending.delete(button);
  }
  function resetAll() {
    for (const button of pending.keys()) reset(button);
  }
  return {
    show(button: HTMLElement) {
      if (disposed) return;
      const previous = pending.get(button);
      const nodes = previous?.nodes ?? [...button.childNodes];
      if (previous) clearTimeout(previous.timer);
      const label = previous
        ? previous.label
        : button.getAttribute('aria-label');
      const title = previous ? previous.title : button.getAttribute('title');
      const svg = button.querySelector('svg');
      button.replaceChildren(
        ...(svg ? [svg.cloneNode(true)] : []),
        document.createTextNode('已复制'),
      );
      button.setAttribute('aria-label', '已复制');
      button.title = '已复制';
      button.setAttribute('data-copy-feedback', 'true');
      pending.set(button, {
        nodes,
        label,
        title,
        timer: setTimeout(() => reset(button), 2000),
      });
    },
    reset,
    resetAll,
    dispose() {
      disposed = true;
      resetAll();
    },
  };
}
