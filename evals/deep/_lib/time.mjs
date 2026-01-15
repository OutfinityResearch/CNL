export function timestampId(now = new Date()) {
  const pad2 = (n) => String(n).padStart(2, "0");
  const y = now.getFullYear();
  const m = pad2(now.getMonth() + 1);
  const d = pad2(now.getDate());
  const hh = pad2(now.getHours());
  const mm = pad2(now.getMinutes());
  const ss = pad2(now.getSeconds());
  return `${y}-${m}-${d}_${hh}-${mm}-${ss}`;
}

