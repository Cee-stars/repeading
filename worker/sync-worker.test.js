import { describe, expect, it } from 'vitest';
import worker from './sync-worker.js';

const KEY = 'abcdefghijklmnopqrstuvwxyz';
const OTHER = 'zyxwvutsrqponmlkjihgfedcba';

/** KV の代わり。中身をそのまま覗けるようにしておく。 */
function fakeKV() {
  const store = new Map();
  return {
    store,
    async get(name, type) {
      const value = store.get(name);
      if (value === undefined) return null;
      return type === 'json' ? JSON.parse(value) : value;
    },
    async put(name, value) {
      store.set(name, value);
    },
  };
}

function env(extra = {}) {
  return { SYNC: fakeKV(), ...extra };
}

const get = (key) =>
  new Request('https://sync.example/', { headers: key ? { authorization: `Bearer ${key}` } : {} });

const put = (key, payload, ifRev) =>
  new Request('https://sync.example/', {
    method: 'PUT',
    headers: { authorization: `Bearer ${key}`, 'content-type': 'application/json' },
    body: JSON.stringify({ payload, ifRev }),
  });

const payload = (n) => ({ app: 'repeading', version: 1, updatedAt: n, materials: [], words: [] });

describe('同期の置き場', () => {
  it('鍵が無ければ断る', async () => {
    expect((await worker.fetch(get(null), env())).status).toBe(401);
  });

  it('短い鍵は断る', async () => {
    // 当てられる長さの鍵を通すと、他人の棚に手が届く。
    expect((await worker.fetch(get('short'), env())).status).toBe(401);
  });

  it('まだ何も預かっていなければ、空を返す', async () => {
    const response = await worker.fetch(get(KEY), env());

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ payload: null, rev: null });
  });

  it('預けたものをそのまま返す', async () => {
    const e = env();
    const written = await worker.fetch(put(KEY, payload(5), null), e);
    const { rev } = await written.json();

    expect(written.status).toBe(200);
    expect(typeof rev).toBe('string');

    const read = await worker.fetch(get(KEY), e);
    expect(await read.json()).toEqual({ payload: payload(5), rev });
  });

  it('鍵そのものは置き場に残さない', async () => {
    const e = env();
    await worker.fetch(put(KEY, payload(1), null), e);

    // 棚の名前にも中身にも、鍵が平文で現れてはいけない。
    const everything = [...e.SYNC.store.keys(), ...e.SYNC.store.values()].join(' ');
    expect(everything).not.toContain(KEY);
  });

  it('鍵が違えば別の棚になる', async () => {
    const e = env();
    await worker.fetch(put(KEY, payload(1), null), e);

    const other = await worker.fetch(get(OTHER), e);
    expect(await other.json()).toEqual({ payload: null, rev: null });
  });

  it('知らない版で書こうとしたら拒み、いまの中身を返す', async () => {
    const e = env();
    const first = await worker.fetch(put(KEY, payload(1), null), e);
    const { rev } = await first.json();

    // 別の端末が先に書いた状態。手元は版を知らないまま出しにきた。
    const stale = await worker.fetch(put(KEY, payload(2), null), e);

    expect(stale.status).toBe(409);
    const body = await stale.json();
    expect(body.rev).toBe(rev);
    expect(body.payload).toEqual(payload(1));

    // 返ってきた版を持って出し直せば通る。
    const retry = await worker.fetch(put(KEY, payload(2), rev), e);
    expect(retry.status).toBe(200);
    expect((await retry.json()).rev).not.toBe(rev);
  });

  it('書くたびに版が変わる', async () => {
    const e = env();
    const a = (await (await worker.fetch(put(KEY, payload(1), null), e)).json()).rev;
    const b = (await (await worker.fetch(put(KEY, payload(2), a), e)).json()).rev;

    expect(b).not.toBe(a);
  });

  it('大きすぎるものは預からない', async () => {
    const huge = new Request('https://sync.example/', {
      method: 'PUT',
      headers: { authorization: `Bearer ${KEY}` },
      body: JSON.stringify({ payload: 'x'.repeat(3 * 1024 * 1024), ifRev: null }),
    });

    expect((await worker.fetch(huge, env())).status).toBe(413);
  });

  it('壊れた本文は断る', async () => {
    const broken = new Request('https://sync.example/', {
      method: 'PUT',
      headers: { authorization: `Bearer ${KEY}` },
      body: 'not json',
    });

    expect((await worker.fetch(broken, env())).status).toBe(400);
  });

  it('ブラウザからの問い合わせに答える', async () => {
    const response = await worker.fetch(
      new Request('https://sync.example/', { method: 'OPTIONS' }),
      env({ ALLOWED_ORIGIN: 'https://cee-stars.github.io' }),
    );

    expect(response.status).toBe(204);
    expect(response.headers.get('access-control-allow-origin')).toBe('https://cee-stars.github.io');
    expect(response.headers.get('access-control-allow-headers')).toContain('authorization');
  });

  it('絞り込みを設定していなければ、どこからでも受ける', async () => {
    const response = await worker.fetch(get(KEY), env());
    expect(response.headers.get('access-control-allow-origin')).toBe('*');
  });

  it('知らない操作は断る', async () => {
    const response = await worker.fetch(
      new Request('https://sync.example/', {
        method: 'DELETE',
        headers: { authorization: `Bearer ${KEY}` },
      }),
      env(),
    );

    expect(response.status).toBe(405);
  });
});
