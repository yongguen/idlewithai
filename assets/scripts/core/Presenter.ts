// 화면에 보여줄 문구·상태를 만드는 순수 함수. UI 컴포넌트는 이 결과를 Label/Sprite에 옮기기만 한다.
// `cc` 의존 없음 → node 테스트 가능.
import { B, FP_UP_KINDS, ROADMAP, STAGE_COUNT, STAGES, STEPS } from './Balance';
import type { FpUpKind, StepKind } from './Balance';
import { autoPerSec, bakeValue, cycleSec, fpAvailable, fpUpCost, stepLv, stepName, stepSec, stepShort } from './Economy';
import { Game, STEP_BUY, stepOfBuy } from './Game';
import type { BuyKind } from './Game';
import { formatNum } from './Num';

export const BUY_KINDS: BuyKind[] = ['alba', 'dough', 'filling', 'fire', 'flip', 'finish', 'recipe', 'equip'];

export type CardState = 'ok' | 'money' | 'maxed' | 'locked';

export interface InvestInfo {
    kind: BuyKind;
    title: string;
    /** 'Lv 3 → 4' 또는 '2 / 4명' */
    levelText: string;
    effectText: string;
    /** 마일스톤 예고('Lv 10에서 ×2'). 없으면 '' */
    noteText: string;
    priceText: string;
    state: CardState;
    cost: number | null;
}

/** 구매 후 초당 수익 증가분(자동 + 탭 tapRate회/초). 회수 시간 계산용. */
export function incomeGain(g: Game, kind: BuyKind, tapRate: number): number {
    const probe = new Game(JSON.parse(JSON.stringify(g.state)));
    const income = (x: Game) => autoPerSec(x.state) + tapRate * bakeValue(x.state);
    const before = income(probe);
    probe.state.money = Number.MAX_VALUE;
    if (!probe.buy(kind)) return 0;
    return income(probe) - before;
}

const STEP_FIELD: Record<StepKind, 'doughLv' | 'fillingLv' | 'fireLv' | 'flipLv' | 'finishLv'> =
    { dough: 'doughLv', filling: 'fillingLv', bake: 'fireLv', flip: 'flipLv', finish: 'finishLv' };

const nextMilestone = (lv: number) => (Math.floor(lv / B.milestoneEvery) + 1) * B.milestoneEvery;

export function investInfo(g: Game, kind: BuyKind): InvestInfo {
    const s = g.state;
    const chk = g.check(kind);
    let state: CardState = chk.reason === 'ok' ? 'ok' : chk.reason;
    let title = '';
    let levelText = '';
    let effectText = '';
    let noteText = '';
    switch (kind) {
        case 'alba': {
            const cap = g.stage.albaCap;
            title = '알바 채용';
            levelText = `${s.alba} / ${cap}명`;
            effectText = chk.cost === null ? '더 고용할 수 없어요' : `자동 굽기 초당 +${formatNum(incomeGain(g, 'alba', 0))}`;
            break;
        }
        case 'dough': case 'filling': case 'fire': case 'flip': case 'finish': {
            const sk = stepOfBuy(kind)!;
            const def = STEPS.find(d => d.kind === sk)!;
            const lv = stepLv(s, sk);
            title = `${def.role} 강화`;
            levelText = state === 'maxed' ? `Lv ${lv} (최대)` : `Lv ${lv} → ${lv + 1}`;
            if (state === 'maxed') {
                effectText = '다음 단계에서 한도 해금';
            } else {
                const now = stepSec(s, sk);
                const next = stepSec({ ...s, [STEP_FIELD[sk]]: lv + 1 }, sk);
                effectText = `${stepShort(s, sk)} ${now.toFixed(2)}초 → ${next.toFixed(2)}초`;
                noteText = `Lv ${nextMilestone(lv)}에서 ×${B.fireMilestone}`;
            }
            break;
        }
        case 'recipe': {
            title = '레시피 개발';
            levelText = state === 'maxed' ? `Lv ${s.recipeLv} (최대)` : `Lv ${s.recipeLv} → ${s.recipeLv + 1}`;
            effectText = state === 'maxed' ? '다음 단계에서 한도 해금' : '한 판 수익 +25%';
            noteText = state === 'maxed' ? '' : `Lv ${nextMilestone(s.recipeLv)}에서 ×${B.recipeMilestone}`;
            break;
        }
        case 'equip': {
            title = STAGES[Math.min(s.equip + 1, STAGE_COUNT - 1)].equipName; // 설비 i는 i+2단계 것
            if (s.stage === 1) {
                state = 'locked';
                title = '자동화 설비';
                levelText = '2단계부터';
                effectText = '점포를 확장하면 구매할 수 있어요';
            } else if (state === 'maxed') {
                title = '자동화 설비';
                levelText = `${s.equip} / ${s.stage - 1}`;
                effectText = '이 단계 설비를 모두 구매했어요';
            } else {
                levelText = `${s.equip} → ${s.equip + 1}`;
                effectText = `판당 수익 ×${B.equipMult}`;
            }
            break;
        }
    }
    const priceText = state === 'maxed' ? '최대' : state === 'locked' ? '잠금' : `₩ ${formatNum(chk.cost ?? 0)}`;
    return { kind, title, levelText, effectText, noteText, priceText, state, cost: chk.cost };
}

/** '오늘의 투자': 회수 시간이 가장 짧은 항목 상위 n개(한도·잠금 제외). */
export function todaysPicks(g: Game, n = 2, tapRate = 0.5): BuyKind[] {
    const ranked: Array<{ kind: BuyKind; pay: number }> = [];
    for (const kind of BUY_KINDS) {
        const c = g.check(kind);
        if (c.cost === null) continue;
        const gain = incomeGain(g, kind, tapRate);
        if (gain <= 0) continue;
        ranked.push({ kind, pay: c.cost / gain });
    }
    ranked.sort((a, b) => a.pay - b.pay);
    return ranked.slice(0, n).map(r => r.kind);
}

export interface ProgressInfo {
    /** 'n / 11 단계명' */
    title: string;
    nextText: string;
    ratio: number;
    percentText: string;
}

export function progressInfo(g: Game): ProgressInfo {
    const s = g.state;
    const total = STAGE_COUNT + ROADMAP.length;
    const ratio = g.progress();
    const next = s.stage < STAGE_COUNT ? STAGES[s.stage].name : `${ROADMAP[0]} (준비 중)`;
    return {
        title: `${s.stage} / ${total} ${g.stage.name}`,
        nextText: `다음: ${next}`,
        ratio,
        percentText: `${Math.floor(ratio * 100)}%`,
    };
}

export interface ExpandInfo {
    visible: boolean;
    enabled: boolean;
    text: string;
}

export function expandInfo(g: Game): ExpandInfo {
    const s = g.state;
    if (s.stage >= STAGE_COUNT) return { visible: false, enabled: false, text: '' };
    const next = STAGES[s.stage].name;
    return {
        visible: true,
        enabled: g.canExpand(),
        text: g.canExpand() ? `새 메뉴 개발 → ${next}` : `${next} 개발 ₩ ${formatNum(g.stage.expandCost)}`,
    };
}

export type FranchiseState = 'locked' | 'progress' | 'ready';
export interface FranchiseInfo {
    state: FranchiseState;
    text: string;
    enabled: boolean;
    recommended: boolean;
}

export function franchiseInfo(g: Game): FranchiseInfo {
    const s = g.state;
    if (s.stage < STAGE_COUNT) {
        return { state: 'locked', text: '대형가게에서 해금 →', enabled: false, recommended: false };
    }
    if (g.canRebirth()) {
        return { state: 'ready', text: `프랜차이즈 개점 (+${g.rebirthPreview()} 포인트)`, enabled: true, recommended: g.rebirthRecommended() };
    }
    return { state: 'progress', text: `프랜차이즈 개점 ${Math.floor(g.progress() * 100)}%`, enabled: false, recommended: false };
}

export interface StepRowInfo {
    kind: StepKind;
    buy: BuyKind;
    /** 알바 종류(예: 반죽 알바) */
    name: string;
    /** 맡은 일(예: 팥 넣기) */
    task: string;
    levelText: string;
    timeText: string;
    priceText: string;
    state: CardState;
    /** 가장 느린 단계(병목) 여부 */
    bottleneck: boolean;
}

/** 굽기 단계 탭: 5단계 행 정보 + 한 판 시간 요약 */
export function stepRows(g: Game): StepRowInfo[] {
    const s = g.state;
    const slowest = STEPS.reduce((m, d) => (stepSec(s, d.kind) > stepSec(s, m.kind) ? d : m), STEPS[0]).kind;
    return STEPS.map(d => {
        const info = investInfo(g, STEP_BUY[d.kind]);
        return {
            kind: d.kind,
            buy: STEP_BUY[d.kind],
            name: d.role,
            task: stepName(s, d.kind),
            levelText: info.levelText,
            timeText: info.state === 'maxed' ? `${stepSec(s, d.kind).toFixed(2)}초 (최대)` : info.effectText.replace(`${stepShort(s, d.kind)} `, ''),
            priceText: info.priceText,
            state: info.state,
            bottleneck: d.kind === slowest,
        };
    });
}
export const cycleText = (g: Game) => `한 판 ${cycleSec(g.state).toFixed(2)}초`;

/** 굽기 버튼 라벨: 지금 해야 할 단계 */
export function tapStepText(g: Game): string {
    const def = STEPS[g.stepIndex];
    return `${g.stepIndex + 1}. ${stepName(g.state, def.kind)}${g.stepReady() ? '!' : ''}`;
}
export function comboText(g: Game): string {
    if (g.combo < 2) return '';
    return `콤보 ${g.combo} · 수익 ×${g.comboMultNow().toFixed(2)}`;
}

/** 굽기 버튼 아래 안내 문구(상황별). */
export function hintText(g: Game): string {
    const s = g.state;
    if (g.isGolden) return '황금 불판! 8초간 수익 ×3';
    if (g.combo >= 2) return comboText(g);
    if (g.canRebirth()) return '프랜차이즈를 개점할 수 있어요';
    if (g.canExpand()) return '새 붕어빵 메뉴를 개발할 수 있어요!';
    if (s.alba === 0) {
        return g.check('alba').ok ? '알바를 고용하면 자동으로 구워요!' : '단계가 차면 바로 탭! 이어 탭하면 콤보';
    }
    return '알바가 자동으로 굽는 중 · 단계마다 탭하면 매출 추가';
}

export interface RoadmapCard {
    index: number; // 6~11
    name: string;
    toast: string;
}
export const roadmapCards = (): RoadmapCard[] =>
    ROADMAP.map((name, i) => ({ index: STAGE_COUNT + 1 + i, name, toast: `${STAGE_COUNT + 1 + i}단계 ${name} — 준비 중이에요` }));

export interface FpUpInfo {
    kind: FpUpKind;
    name: string;
    desc: string;
    levelText: string;
    costText: string;
    canBuy: boolean;
}
export function fpUpInfos(g: Game): FpUpInfo[] {
    return FP_UP_KINDS.map(kind => {
        const d = g.fpUpDesc(kind);
        const cost = fpUpCost(g.state, kind);
        return {
            kind,
            name: d.name,
            desc: d.desc,
            levelText: `Lv ${g.state.fpUp[kind]} / ${d.costs.length}`,
            costText: cost === null ? '최대' : `${cost} FP`,
            canBuy: g.canBuyFpUp(kind),
        };
    });
}

export const fpSummary = (g: Game) => ({
    total: g.state.fp,
    available: fpAvailable(g.state),
    multText: `판당 수익 ×${(1 + B.franchiseStep * g.state.fp).toFixed(2)}`,
});
