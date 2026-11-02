import { describe, expect, it } from 'vitest';
import {
  breathMs,
  DEFAULT_STAGE,
  forcesCaption,
  isStageMap,
  loops,
  pruneStages,
  STAGE_ORDER,
  stageOf,
  stagePhase,
} from '../stage';

describe('段', () => {
  it('梯子の一番下から始まる', () => {
    // 新しい文をいきなりリピートさせないための既定。ここが変わると方法が崩れる。
    expect(DEFAULT_STAGE).toBe('listen');
    expect(STAGE_ORDER[0]).toBe('listen');
    expect(STAGE_ORDER[STAGE_ORDER.length - 1]).toBe('repeat');
  });

  it('リピート以外は同じ文を鳴らし続ける', () => {
    // 遅れが 1 文に届くまでは、模範音声の時間そのものが練習の時間。
    expect(loops('listen')).toBe(true);
    expect(loops('overlap')).toBe(true);
    expect(loops('shift')).toBe(true);
    expect(loops('repeat')).toBe(false);
  });

  it('鳴っているあいだの段の名前が段ごとに変わる', () => {
    expect(stagePhase('listen')).toBe('listening');
    expect(stagePhase('overlap')).toBe('overlapping');
    expect(stagePhase('shift')).toBe('shifting');
    // リピート段は、鳴っているあいだは今までどおり「聞く」。
    expect(stagePhase('repeat')).toBe('listening');
  });

  it('重ねる段では字幕を隠せない', () => {
    // 記憶に頼らないのが要点なので、見えていなければ成立しない。
    expect(forcesCaption('overlap')).toBe(true);
    expect(forcesCaption('shift')).toBe(true);
    expect(forcesCaption('listen')).toBe(false);
    expect(forcesCaption('repeat')).toBe(false);
  });
});

describe('breathMs', () => {
  it('長い文ほど息継ぎを長く取る', () => {
    expect(breathMs(6000)).toBe(900);
  });

  it('短い文でも息を継げる長さを残す', () => {
    expect(breathMs(500)).toBe(500);
  });

  it('長すぎる間でリズムを切らない', () => {
    expect(breathMs(60000)).toBe(1500);
  });
});

describe('段の記録', () => {
  it('記録が無い文は一番下の段', () => {
    expect(stageOf(undefined, 3)).toBe('listen');
    expect(stageOf({}, 3)).toBe('listen');
    expect(stageOf({ 3: 'overlap' }, 3)).toBe('overlap');
  });

  it('文が無いときも落ちない', () => {
    expect(stageOf({ 3: 'overlap' }, undefined)).toBe('listen');
  });

  it('消えた文の記録を落とす', () => {
    expect(pruneStages({ 1: 'overlap', 2: 'repeat' }, [2])).toEqual({ 2: 'repeat' });
  });

  it('古い教材には記録が無いので、無いものを通す', () => {
    expect(isStageMap(undefined)).toBe(true);
    expect(isStageMap({ 1: 'overlap' })).toBe(true);
  });

  it('知らない段が入ったファイルは受け取らない', () => {
    expect(isStageMap({ 1: 'karaoke' })).toBe(false);
    expect(isStageMap([])).toBe(false);
  });
});
