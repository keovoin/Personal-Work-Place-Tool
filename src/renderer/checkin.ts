/**
 * Check-in prompt renderer (Requirement 4.2).
 *
 * Captures energy and focus ratings (1..5) and submits them through the
 * preload bridge. Dismissing closes the prompt without persisting an entry.
 */

const selected: Record<string, number> = { energy: 0, focus: 0 };

function buildRating(containerId: string, name: string): void {
  const container = document.getElementById(containerId);
  if (!container) return;
  for (let i = 1; i <= 5; i += 1) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.textContent = String(i);
    btn.addEventListener('click', () => {
      selected[name] = i;
      Array.from(container.children).forEach((child, idx) => {
        child.classList.toggle('selected', idx < i);
      });
    });
    container.appendChild(btn);
  }
}

window.addEventListener('DOMContentLoaded', () => {
  buildRating('energy-rating', 'energy');
  buildRating('focus-rating', 'focus');

  const submit = document.getElementById('checkin-submit');
  const dismiss = document.getElementById('checkin-dismiss');

  submit?.addEventListener('click', async () => {
    const energy = selected.energy || 3;
    const focus = selected.focus || 3;
    await window.dashboard.submitCheckIn(energy, focus);
  });

  dismiss?.addEventListener('click', async () => {
    await window.dashboard.dismissCheckIn();
  });
});
