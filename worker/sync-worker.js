/**
 * Repeading の同期置き場。Cloudflare Workers + KV で動く。
 *
 * 作りの前提:
 * - 登録も利用者の概念も持たない。鍵を知っていることが、そのまま読み書きの権利になる。
 *   鍵は端末側で 26 文字の乱数として作られるので、総当たりは現実的でない。
 * - 鍵そのものは保存しない。SHA-256 を取った値を棚の名前に使う。
 *   KV の中身が漏れても、そこから鍵は復元できない。
 * - 書き込みは rev（版）で守る。手元が知っている版と食い違えば 409 を返し、
 *   そのとき置き場にある中身も一緒に返す。端末はそれと突き合わせてから出し直す。
 *   これが無いと、2 台が同時に書いたときに片方の変更が消える。
 *
 * 置き方は worker/README.md を参照。
 */

/** 教材と単語だけなので、これを超えるのは異常。置き場を物置に使われないための蓋でもある。 */
const MAX_BODY = 2 * 1024 * 1024;

/** これより短い鍵は受け付けない。短い鍵は当てられる。 */
const MIN_KEY = 20;

function corsHeaders(env) {
  return {
    // ALLOWED_ORIGIN を設定すれば、そのサイトからだけに絞れる。
    'Access-Control-Allow-Origin': env.ALLOWED_ORIGIN || '*',
    'Access-Control-Allow-Methods': 'GET, PUT, OPTIONS',
    'Access-Control-Allow-Headers': 'authorization, content-type',
    'Access-Control-Max-Age': '86400',
  };
}

function json(body, status, env) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', ...corsHeaders(env) },
  });
}

/** 鍵から棚の名前を作る。鍵そのものは置き場に残さない。 */
async function shelfName(key) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(key));
  return `sync:${Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('')}`;
}

function readKey(request) {
  const header = request.headers.get('authorization') ?? '';
  const match = /^Bearer\s+(.+)$/i.exec(header.trim());
  return match ? match[1].trim() : null;
}

const EMPTY = { payload: null, rev: null };

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders(env) });
    }

    const key = readKey(request);
    if (!key || key.length < MIN_KEY) {
      return json({ error: 'invalid key' }, 401, env);
    }

    const shelf = await shelfName(key);

    if (request.method === 'GET') {
      const stored = await env.SYNC.get(shelf, 'json');
      return json(stored ?? EMPTY, 200, env);
    }

    if (request.method === 'PUT') {
      const raw = await request.text();
      if (raw.length > MAX_BODY) return json({ error: 'too large' }, 413, env);

      let body;
      try {
        body = JSON.parse(raw);
      } catch {
        return json({ error: 'invalid json' }, 400, env);
      }

      const stored = (await env.SYNC.get(shelf, 'json')) ?? EMPTY;

      // 手元が見た版と、いま置き場にある版が違う = 別の端末が先に書いた。
      // 上書きせず、今の中身を返して突き合わせ直させる。
      if ((body.ifRev ?? null) !== stored.rev) {
        return json({ error: 'conflict', ...stored }, 409, env);
      }

      const rev = crypto.randomUUID();
      await env.SYNC.put(shelf, JSON.stringify({ payload: body.payload ?? null, rev }));
      return json({ rev }, 200, env);
    }

    return json({ error: 'method not allowed' }, 405, env);
  },
};
