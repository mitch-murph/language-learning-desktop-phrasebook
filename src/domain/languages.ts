export function colorForName(name: string | undefined): string {
  const key = (name ?? '').toLowerCase();
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) | 0;
  const hue = Math.abs(h) % 360;
  return `hsl(${hue}, 75%, 40%)`;
}
