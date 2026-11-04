import katex from 'katex';
import 'katex/dist/katex.min.css';

export function renderMath(root: ParentNode) {
  for (const node of root.querySelectorAll<HTMLElement>(
    '.math-formula[data-math]',
  )) {
    const formula = node.dataset.math!;
    katex.render(formula, node, {
      displayMode: node.dataset.display === 'true',
      throwOnError: false,
      trust: false,
      maxExpand: 500,
      maxSize: 20,
      strict: 'ignore',
      macros: {},
    });
  }
}

/** Native MathML needs no script, stylesheet or downloaded fonts in offline HTML. */
export function offlineMath(root: ParentNode) {
  for (const node of root.querySelectorAll<HTMLElement>(
    '.math-formula[data-math]',
  )) {
    node.innerHTML = katex.renderToString(node.dataset.math!, {
      displayMode: node.dataset.display === 'true',
      output: 'mathml',
      throwOnError: false,
      trust: false,
      maxExpand: 500,
      maxSize: 20,
      strict: 'ignore',
      macros: {},
    });
  }
}
