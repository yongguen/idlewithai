// 경제 공식(순수 함수). Docs/Prototype_Plan.md §4.1~4.5. `cc` 의존 없음.
import { B, FP_UPGRADES, FP_UP_KINDS, STAGES, STEPS } from './Balance';
import type { FpUpKind, StageDef, StepKind } from './Balance';
import type { GameState } from './GameState';
import type { Num } from './Num';

export const stageDef = (s: GameState): StageDef => STAGES[s.stage - 1];

const milestones = (lv: number) => Math.floor(lv / B.milestoneEvery);

/** 화력배수 SP = (1+0.20×Lv) × 1.5^floor(Lv/10) — 굽는 속도 */
export const fireMult = (lv: number): number =>
    (1 + B.fireStep * lv) * Math.pow(B.fireMilestone, milestones(lv));
/** 레시피배수 RC = (1+0.25×Lv) × 2^floor(Lv/10) — 판당 수익 */
export const recipeMult = (lv: number): number =>
    (1 + B.recipeStep * lv) * Math.pow(B.recipeMilestone, milestones(lv));
export const equipMult = (n: number): number => Math.pow(B.equipMult, n);
export const franchiseMult = (fp: number): number => 1 + B.franchiseStep * fp;

/** 판당 수익 BV (황금 불판 제외) */
export const bakeValue = (s: GameState): Num =>
    stageDef(s).value * recipeMult(s.recipeLv) * franchiseMult(s.fp) * equipMult(s.equip);

// ── 굽기 5단계 ──
export function stepLv(s: GameState, k: StepKind): number {
    switch (k) {
        case 'dough': return s.doughLv;
        case 'filling': return s.fillingLv;
        case 'bake': return s.fireLv;
        case 'flip': return s.flipLv;
        case 'finish': return s.finishLv;
    }
}
export const stepDef = (k: StepKind) => STEPS.find(d => d.kind === k)!;
/** 단계 소요 시간(초) = 기본 시간 × 붕어빵 시간 배율 / 알바 숙련 배수 */
export const stepSec = (s: GameState, k: StepKind): number =>
    (stepDef(k).baseSec * stageDef(s).timeMult) / fireMult(stepLv(s, k));
/** 단계 이름. 속 넣기는 붕어빵 종류에 따라 '팥 넣기' 등으로 바뀐다 */
/** 짧은 이름(칩·효과 문구). 속 넣기는 속 재료 이름 */
export const stepShort = (s: GameState, k: StepKind): string =>
    k === 'filling' ? stageDef(s).filling : stepDef(k).short;
export const stepName = (s: GameState, k: StepKind): string =>
    k === 'filling' ? `${stageDef(s).filling} 넣기` : stepDef(k).name;
/** 한 판 전체 시간(5단계 합). 알바 숙련 0이면 3초 × 붕어빵 시간 배율 */
export const cycleSec = (s: GameState): number => STEPS.reduce((a, d) => a + stepSec(s, d.kind), 0);
/** 단계 스탯 비용 = 화덕 기본 비용 × (단계 시간 비중) × 1.5^Lv. 5단계를 같은 레벨로 올리는 총비용 = 예전 화덕 비용 */
export const stepCost = (k: StepKind, lv: number): Num =>
    (B.fireBase * stepDef(k).baseSec / B.bakeSec) * Math.pow(B.fireGrowth, lv);
/** 직접 굽기 콤보 배수 */
export const comboMult = (combo: number): number =>
    1 + B.comboStep * (Math.min(Math.max(combo, 1), B.comboMax) - 1);

/** 자동 초당 매출 AUTO = 알바수 × BV / 한 판 시간 (황금 불판 제외) */
export const autoPerSec = (s: GameState): Num => (s.alba * bakeValue(s)) / cycleSec(s);

// ── 구매 비용 ──
export const albaCost = (k: number): Num => B.albaBase * Math.pow(B.albaGrowth, k);
export const fireCost = (lv: number): Num => stepCost('bake', lv);
export const recipeCost = (lv: number): Num => B.recipeBase * Math.pow(B.recipeGrowth, lv);
/** 다음 설비 비용 = 0.25 × 해당 설비 단계의 진입 비용. 구매할 설비가 없으면 null */
export function equipCost(s: GameState): Num | null {
    if (s.equip >= s.stage - 1) return null;
    const equipStage = s.equip + 2; // 설비는 2단계부터 한 단계에 하나
    return B.equipCostRate * STAGES[equipStage - 2].expandCost;
}

// ── 한도 ──
export const albaCap = (s: GameState): number => stageDef(s).albaCap;
export const fireCap = (s: GameState): number => stageDef(s).levelCap;
export const recipeCap = (s: GameState): number => stageDef(s).levelCap + 5 * s.fpUp.recipe;
export const offlineCapSec = (s: GameState): number => B.offlineBaseCapSec + 3600 * s.fpUp.night;
/** 환생 직후 시작 알바 수 */
export const startAlba = (s: GameState): number => 1 + s.fpUp.train;

// ── 환생 ──
export const rebirthFpFor = (runRevenue: Num): number =>
    Math.floor(B.rebirthFpBase * Math.sqrt(Math.max(0, runRevenue) / B.rebirthTarget));
export const canRebirth = (s: GameState): boolean =>
    s.stage === STAGES.length && s.runRevenue >= B.rebirthTarget;

export function fpSpent(s: GameState): number {
    let sum = 0;
    for (const k of FP_UP_KINDS) {
        for (let i = 0; i < s.fpUp[k]; i++) sum += FP_UPGRADES[k].costs[i];
    }
    return sum;
}
export const fpAvailable = (s: GameState): number => Math.max(0, s.fp - fpSpent(s));
export function fpUpCost(s: GameState, k: FpUpKind): number | null {
    const lv = s.fpUp[k];
    return lv >= FP_UPGRADES[k].costs.length ? null : FP_UPGRADES[k].costs[lv];
}
