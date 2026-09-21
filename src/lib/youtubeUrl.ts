const VIDEO_ID = /^[\w-]{11}$/;

const PATH_PREFIXES = ['embed', 'shorts', 'live', 'v'];

/**
 * YouTube の URL から動画 ID を取り出す。ID を直接貼られた場合もそのまま通す。
 * 解釈できなければ null。
 */
export function extractVideoId(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  if (VIDEO_ID.test(trimmed)) return trimmed;

  let url: URL;
  try {
    url = new URL(trimmed.includes('://') ? trimmed : `https://${trimmed}`);
  } catch {
    return null;
  }

  const host = url.hostname.replace(/^www\./, '');

  if (host === 'youtu.be') {
    const id = url.pathname.slice(1).split('/')[0];
    return VIDEO_ID.test(id) ? id : null;
  }

  if (!host.endsWith('youtube.com')) return null;

  const v = url.searchParams.get('v');
  if (v && VIDEO_ID.test(v)) return v;

  const [prefix, id] = url.pathname.split('/').filter(Boolean);
  if (PATH_PREFIXES.includes(prefix) && id && VIDEO_ID.test(id)) return id;

  return null;
}
