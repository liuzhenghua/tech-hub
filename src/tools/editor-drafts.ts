import { mountEditorPanel } from './shared/editor-panel';
import type { ToolDefinition } from './shared/types';

const drafts = [1, 2, 3];

export function mountEditorDrafts(
  root: HTMLElement,
  tool: ToolDefinition,
  draftLabel = '草稿',
): () => void {
  const selector = document.createElement('div');
  selector.className = 'editor-draft-selector';
  selector.setAttribute('role', 'group');
  selector.setAttribute('aria-label', `${tool.title}草稿`);

  const events = new AbortController();
  const panels = new Map<number, HTMLElement>();
  const disposers: (() => void)[] = [];

  function showDraft(draft: number) {
    let panel = panels.get(draft);
    if (!panel) {
      panel = document.createElement('div');
      panel.className = 'tool-workspace-panel';
      root.replaceChildren(panel);
      // Keep previous local content in the first draft.
      const storageId = draft === 1 ? tool.id : `${tool.id}-draft-${draft}`;
      disposers.push(mountEditorPanel(panel, tool, storageId));
      panels.set(draft, panel);
    } else if (root.firstChild !== panel) {
      root.replaceChildren(panel);
    }
    const toolbar = panel.querySelector('.toolbar')!;
    if (selector.parentElement !== toolbar) toolbar.prepend(selector);
    buttons.forEach((button, index) =>
      button.setAttribute('aria-pressed', String(drafts[index] === draft)),
    );
  }

  const buttons = drafts.map((draft) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = `${draftLabel} ${draft}`;
    button.addEventListener(
      'click',
      () => {
        showDraft(draft);
        button.focus({ preventScroll: true });
      },
      { signal: events.signal },
    );
    return button;
  });
  selector.append(...buttons);
  showDraft(drafts[0]);

  return () => {
    events.abort();
    disposers.forEach((dispose) => dispose());
  };
}
