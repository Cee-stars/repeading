/**
 * 練習の段。
 *
 * 長い文をいきなりリピートできないのは当然で、**自分の記憶に頼って言おうとするから**
 * そうなる。先に模範音声へ自分の声を重ねてしまえば、覚えなくても最後まで言える。
 * 十分に慣れてから自分の声を少しずつ遅らせていくと、そのままリピートになる。
 *
 * 段の違いは「自分の声を模範からどれだけ遅らせるか」だけ。
 *
 *   重ねる（0）→ ずらす（わずか）→ リピート（1 文ぶん）
 *
 * 遅れが 1 文に届くまでは、**無音の間を使わない**。模範音声が鳴っている時間が練習の時間。
 * 無音の間は、長い文をひとつのかたまりとして掴めるようになってから使う段のもの。
 *
 * 回数は数えない。「5 回聞く」「何十回も重ねる」は文によって人によって違うので、
 * アプリが区切るものではない。選んだ段のまま鳴り続け、進むのは自分で決める。
 */
export type Stage = 'listen' | 'overlap' | 'shift' | 'repeat';

/** 梯子の下から上へ。この並びで出す。 */
export const STAGE_ORDER: Stage[] = ['listen', 'overlap', 'shift', 'repeat'];

export const STAGE_LABELS: Record<Stage, string> = {
  listen: '聞く',
  overlap: '重ねる',
  shift: 'ずらす',
  repeat: 'リピート',
};

/** その段で何をするか。段を変えた人がまず読むもの。 */
export const STAGE_HINTS: Record<Stage, string> = {
  listen: '声は出さず、音だけ追う。気が済むまで鳴り続けます。',
  overlap: '模範音声にぴったり重ねて言う。覚えなくてよい。',
  shift: '少し遅らせて言い始め、模範を追いかける。',
  repeat: '聞いたあとの無音で、ひとりで言う。',
};

/** 新しい文は梯子の一番下から始める。 */
export const DEFAULT_STAGE: Stage = 'listen';

/**
 * 同じ文を鳴らし続ける段かどうか。
 * リピート以外は、模範音声の時間そのものを練習に使うので、無音を挟まず回り続ける。
 */
export function loops(stage: Stage): boolean {
  return stage !== 'repeat';
}

/** 模範音声が鳴っているあいだ、学習者がしていること。 */
export function stagePhase(stage: Stage): 'listening' | 'overlapping' | 'shifting' {
  if (stage === 'overlap') return 'overlapping';
  if (stage === 'shift') return 'shifting';
  return 'listening';
}

/**
 * 字幕を出さざるを得ない段かどうか。
 * 重ねる・ずらすは「記憶に頼らない」ことが要点なので、全文が見えていないと成立しない。
 */
export function forcesCaption(stage: Stage): boolean {
  return stage === 'overlap' || stage === 'shift';
}

/** 息継ぎの下限。これより短いと、長い文を言い切ったあとに間に合わない。 */
const MIN_BREATH_MS = 500;
/** 息継ぎの上限。これより長いと、重ねる練習のリズムが切れる。 */
const MAX_BREATH_MS = 1500;
/** 息継ぎは言い終えた長さに対する比で取る。 */
const BREATH_RATIO = 0.15;

/**
 * 鳴り終わってから次の回までの息継ぎ。
 *
 * 長い文ほど息を使うので長めに取る。つまみにはしない。ここを人に決めさせると、
 * 回数を決めさせるのと同じで、練習そのものより設定を気にすることになる。
 */
export function breathMs(spokenMs: number): number {
  return Math.min(MAX_BREATH_MS, Math.max(MIN_BREATH_MS, spokenMs * BREATH_RATIO));
}

/** 段の記録。文 id ごとに、最後にどの段でやっていたかだけを持つ。 */
export type StageMap = Record<number, Stage>;

export function isStage(value: unknown): value is Stage {
  return STAGE_ORDER.includes(value as Stage);
}

/** 読み込んだ教材の段の記録を確かめる。古い教材には無いので、無い場合も通す。 */
export function isStageMap(value: unknown): value is StageMap {
  if (value === undefined) return true;
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  return Object.values(value).every(isStage);
}

/** その文の段。記録が無ければ梯子の一番下。 */
export function stageOf(stages: StageMap | undefined, sentenceId: number | undefined): Stage {
  if (!stages || sentenceId === undefined) return DEFAULT_STAGE;
  return stages[sentenceId] ?? DEFAULT_STAGE;
}

/** 文を消したり繋いだりしたあと、消えた文に付いていた記録を落とす。 */
export function pruneStages(stages: StageMap | undefined, aliveIds: number[]): StageMap {
  if (!stages) return {};
  const alive = new Set(aliveIds);
  const kept: StageMap = {};
  for (const [key, stage] of Object.entries(stages)) {
    const id = Number(key);
    if (alive.has(id)) kept[id] = stage;
  }
  return kept;
}
