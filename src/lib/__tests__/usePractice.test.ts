import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS, gapPlan } from '../usePractice';

describe('gapPlan', () => {
  it('puts understanding before mimicking', () => {
    // リピーディングは 聞く → 理解する → 真似る。
    // 理解を飛ばして真似ると、音をなぞるだけで意味が入らない。
    const gaps = gapPlan(1, 1, 2000);

    expect(gaps.map((gap) => gap.phase)).toEqual(['understanding', 'mimicking']);
  });

  it('scales each gap by the length of what was said', () => {
    const gaps = gapPlan(0.5, 1.5, 4000);

    expect(gaps[0].waitMs).toBe(2000);
    expect(gaps[1].waitMs).toBe(6000);
  });

  it('keeps a floor so a short sentence does not feel rushed', () => {
    const gaps = gapPlan(1, 1, 100);

    expect(gaps[0].waitMs).toBe(400);
    expect(gaps[1].waitMs).toBe(400);
  });

  it('drops the understanding step when its ratio is zero', () => {
    // 意味が取れている素材なら、理解を挟まず回せる。
    const gaps = gapPlan(0, 1, 2000);

    expect(gaps.map((gap) => gap.phase)).toEqual(['mimicking']);
  });

  it('drops the mimicking step when its ratio is zero', () => {
    const gaps = gapPlan(1, 0, 2000);

    expect(gaps.map((gap) => gap.phase)).toEqual(['understanding']);
  });

  it('goes straight on when both are off', () => {
    expect(gapPlan(0, 0, 2000)).toEqual([]);
  });

  it('includes an understanding step by default', () => {
    // 既定で理解の段が入っていなければ、言葉だけ直して中身が変わっていないことになる。
    const gaps = gapPlan(DEFAULT_SETTINGS.understandRatio, DEFAULT_SETTINGS.pauseRatio, 2000);

    expect(gaps.map((gap) => gap.phase)).toEqual(['understanding', 'mimicking']);
  });
});
