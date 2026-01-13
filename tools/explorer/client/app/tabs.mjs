export function activateTab(tabId) {
  const btn = document.getElementById(tabId);
  if (!btn) return;

  document.querySelectorAll('.tab').forEach(t => t.classList.remove('tab--active'));
  document.querySelectorAll('.tabs__panel').forEach(p => p.classList.remove('tabs__panel--active'));

  btn.classList.add('tab--active');
  const panelId = btn.id.replace('tab', 'panel');
  document.getElementById(panelId).classList.add('tabs__panel--active');
}

export function bindTabs(onGraph) {
  document.querySelectorAll('.tab').forEach(btn => {
    btn.onclick = () => {
      activateTab(btn.id);
      if (btn.id === 'tabGraph' && typeof onGraph === 'function') {
        onGraph();
      }
    };
  });
}
