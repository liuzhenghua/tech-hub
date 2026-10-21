/** Export the current loaded source or print the already rendered document. */
export function mountDocumentExport(
  snapshot: () => { path: string; markdown: string } | null,
): () => void {
  const menu = document.querySelector<HTMLDetailsElement>('#document-export')!;
  const events = new AbortController();
  document.getElementById('export-markdown')!.addEventListener(
    'click',
    () => {
      const current = snapshot();
      if (!current) return;
      const url = URL.createObjectURL(
        new Blob([current.markdown], { type: 'text/markdown;charset=utf-8' }),
      );
      const link = document.createElement('a');
      link.href = url;
      link.download = current.path.split('/').pop() || 'document.md';
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      menu.open = false;
    },
    { signal: events.signal },
  );
  document.getElementById('export-pdf')!.addEventListener(
    'click',
    () => {
      const current = snapshot();
      if (!current) return;
      menu.open = false;
      const title = document.title;
      document.title =
        document.querySelector('#document h1')?.textContent ||
        current.path.split('/').pop()!.replace(/\.md$/i, '');
      try {
        window.print();
      } finally {
        document.title = title;
      }
    },
    { signal: events.signal },
  );
  document.addEventListener(
    'click',
    (event) => {
      if (event.target instanceof Node && !menu.contains(event.target))
        menu.open = false;
    },
    { signal: events.signal },
  );
  document.addEventListener(
    'keydown',
    (event) => {
      if (event.key === 'Escape') menu.open = false;
    },
    { signal: events.signal },
  );
  return () => events.abort();
}
