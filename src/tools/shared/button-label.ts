/** Preserve icon content while keeping tooltips and accessible names in sync. */
export function setButtonLabel(button: HTMLElement, label: string): void {
  if (!button.querySelector('svg')) button.textContent = label;
  button.setAttribute('aria-label', label);
  button.title = label;
}
