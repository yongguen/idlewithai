// 게임 규칙 본체. `cc`를 import하지 않는 순수 TS — node에서 그대로 시뮬레이션·테스트한다.
import { B, FP_UPGRADES, STAGE_COUNT, STEPS } from './Balance';
import type { FpUpKind, StepKind } from './Balance';
import {
    albaCap, albaCost, autoPerSec, bakeValue, canRebirth, comboMult, cycleSec, equipCost, fireCap, stepCost, stepLv, stepSec,
    fpAvailable, fpUpCost, offlineCapSec, rebirthFpFor, recipeCap, recipeCost, stageDef, startAlba,
} from './Economy';
import { createNewState } from './GameState';
import type { GameState } from './GameState';
import type { Num } from './Num';

/** 'fire'는 굽기 단계 스탯(=화덕). 나머지 단계 스탯은 'dough'|'filling'|'flip'|'finish' */
export type BuyKind = 'alba' | 'fire' | 'recipe' | 'equip' | 'dough' | 'filling' | 'flip' | 'finish';
export const STEP_BUY: Record<StepKind, BuyKind> = { dough: 'dough', filling: 'filling', bake: 'fire', flip: 'flip', finish: 'finish' };
export const stepOfBuy = (k: BuyKind): StepKind | null =>
    k === 'dough' ? 'dough' : k === 'filling' ? 'filling' : k === 'fire' ? 'bake' : k === 'flip' ? 'flip' : k === 'finish' ? 'finish' : null;

export type BuyReason = 'ok' | 'maxed' | 'money' | 'locked';
export interface BuyCheck {
    ok: boolean;
    reason: BuyReason;
    /** 다음 구매 비용. 한도에 닿았으면 null */
    cost: Num | null;
}

export type GameEvent =
    | { type: 'tap'; amount: Num; golden: boolean; step: StepKind; combo: number; cycleDone: boolean }
    | { type: 'tap-early'; step: StepKind }
    | { type: 'combo-break' }
    | { type: 'auto-bake'; batches: number; perBatch: Num; golden: boolean }
    | { type: 'purchase'; kind: BuyKind; cost: Num }
    | { type: 'fp-upgrade'; kind: FpUpKind; level: number }
    | { type: 'expand'; stage: number }
    | { type: 'rebirth'; fpGained: number; rebirths: number }
    | { type: 'golden-start' }
    | { type: 'golden-end' }
    | { type: 'state-reset' };

export type GameListener = (e: GameEvent) => void;

export interface OfflineReport {
    gained: Num;
    elapsedSec: number;
    appliedSec: number;
    capped: boolean;
    /** 팝업을 띄울지(보상이 있고 자리 비운 시간이 충분할 때) */
    show: boolean;
}

export class Game {
    state: GameState;
    // 비저장 런타임 상태
    heat = 0;
    goldenLeft = 0;
    /** 직접 굽기 진행(비저장): 현재 단계 번호 0~4, 그 단계 경과 시간, 콤보 */
    stepIndex = 0;
    stepElapsed = 99; // 시작 직후 첫 단계는 바로 수행 가능
    combo = 0;
    private sinceTap = 99;
    private tapTokens: number = B.maxTapPerSec;
    private batchAcc = 0;
    private listeners: GameListener[] = [];

    constructor(state?: GameState, now = 0) {
        this.state = state ?? createNewState(now);
    }

    on(l: GameListener): () => void {
        this.listeners.push(l);
        return () => {
            const i = this.listeners.indexOf(l);
            if (i >= 0) this.listeners.splice(i, 1);
        };
    }
    private emit(e: GameEvent) {
        for (const l of this.listeners.slice()) l(e);
    }

    // ── 조회 ──
    get stage() { return stageDef(this.state); }
    get isGolden() { return this.goldenLeft > 0; }
    private get goldenMult() { return this.isGolden ? B.goldenMult : 1; }
    /** 판당 수익(황금 불판 반영) */
    bakeValue(): Num { return bakeValue(this.state) * this.goldenMult; }
    /** 초당 매출(황금 불판 반영) */
    incomePerSec(): Num { return autoPerSec(this.state) * this.goldenMult; }
    /** 환생 진행도 0~1 / 확장 진행도 0~1 (§2.4) */
    progress(): number {
        const s = this.state;
        if (s.stage < STAGE_COUNT) return Math.min(1, s.money / this.stage.expandCost);
        return Math.min(1, s.runRevenue / B.rebirthTarget);
    }

    // ── 입력 ──
    /** 현재 직접 굽기 단계 */
    get currentStep(): StepKind { return STEPS[this.stepIndex].kind; }
    /** 현재 단계 소요 시간(초) */
    currentStepSec(): number { return stepSec(this.state, this.currentStep); }
    /** 현재 단계 진행도 0~1 (1이면 지금 탭 가능) */
    stepReadyRatio(): number { return Math.min(1, this.stepElapsed / this.currentStepSec()); }
    stepReady(): boolean { return this.stepElapsed >= this.currentStepSec() - 1e-9; }
    /** 지금 탭하면 벌 금액(콤보 이어짐 여부 반영) */
    nextTapValue(): Num {
        const late = this.stepElapsed - this.currentStepSec();
        const c = this.combo > 0 && late <= B.comboGraceSec ? this.combo + 1 : 1;
        return this.bakeValue() * comboMult(c);
    }
    /** 지금 콤보 배수 */
    comboMultNow(): number { return this.combo > 0 ? comboMult(this.combo) : 1; }

    /**
     * 직접 굽기 1회(= 현재 단계 수행). 단계가 아직 준비되지 않았으면 무시(0 반환).
     * 준비 후 graceSec 안에 탭하면 콤보 +1, 늦으면 콤보 1부터 다시. 단계마다 판당 수익 × 콤보 배수를 번다.
     * 초당 8회를 넘는 입력도 무시.
     */
    tap(): Num {
        const step = this.currentStep;
        if (!this.stepReady()) {
            this.emit({ type: 'tap-early', step });
            return 0;
        }
        if (this.tapTokens < 1) return 0;
        this.tapTokens -= 1;
        const late = this.stepElapsed - this.currentStepSec();
        this.combo = late <= B.comboGraceSec && this.combo > 0 ? this.combo + 1 : 1;
        const golden = this.isGolden;
        const amount = this.bakeValue() * comboMult(this.combo);
        this.earn(amount);
        this.state.stats.taps += 1;
        this.sinceTap = 0;
        this.stepElapsed = 0;
        this.stepIndex += 1;
        const cycleDone = this.stepIndex >= STEPS.length;
        if (cycleDone) this.stepIndex = 0;
        if (!golden) {
            this.heat = Math.min(B.heatMax, this.heat + B.heatPerTap);
            if (this.heat >= B.heatMax) {
                this.goldenLeft = B.goldenSec;
                this.state.stats.goldenCount += 1;
                this.emit({ type: 'golden-start' });
            }
        }
        this.emit({ type: 'tap', amount, golden, step, combo: this.combo, cycleDone });
        return amount;
    }

    /** 시간 진행. dt는 초. 한 프레임 dt가 크면 호출 측에서 잘라 넣는다(Controller 참고). */
    tick(dt: number) {
        if (!(dt > 0)) return;
        const s = this.state;
        s.playSec += dt;
        this.tapTokens = Math.min(B.maxTapPerSec, this.tapTokens + B.maxTapPerSec * dt);
        // 직접 굽기: 준비 시간 + 유예 시간을 넘기면 콤보 끊김(단계는 그대로 대기)
        this.stepElapsed = Math.min(this.stepElapsed + dt, 3600);
        if (this.combo > 0 && this.stepElapsed > this.currentStepSec() + B.comboGraceSec) {
            this.combo = 0;
            this.emit({ type: 'combo-break' });
        }

        // 황금 불판: 남은 시간만큼만 ×3
        const goldenPart = Math.min(dt, this.goldenLeft);
        const auto = autoPerSec(s);
        this.earn(auto * (dt + goldenPart * (B.goldenMult - 1)));
        if (s.alba > 0) {
            // 알바 1명이 한 판 시간(5단계 합)에 한 판 → 연출용 판 수(매출은 위에서 연속 정산)
            this.batchAcc += (s.alba / cycleSec(s)) * dt;
            const n = Math.floor(this.batchAcc);
            if (n > 0) {
                this.batchAcc -= n;
                this.emit({ type: 'auto-bake', batches: n, perBatch: this.bakeValue(), golden: this.isGolden });
            }
        }

        if (this.goldenLeft > 0) {
            this.goldenLeft -= dt;
            if (this.goldenLeft <= 0) {
                this.goldenLeft = 0;
                this.heat = 0;
                this.emit({ type: 'golden-end' });
            }
        } else {
            this.sinceTap += dt;
            const decayTime = this.sinceTap - B.heatHoldSec;
            if (decayTime > 0 && this.heat > 0) {
                this.heat = Math.max(0, this.heat - B.heatDecayPerSec * Math.min(dt, decayTime));
            }
        }
    }

    private earn(amount: Num) {
        if (!(amount > 0)) return;
        const s = this.state;
        s.money += amount;
        s.runRevenue += amount;
        s.totalRevenue += amount;
    }

    // ── 구매 ──
    check(kind: BuyKind): BuyCheck {
        const s = this.state;
        let cost: Num | null;
        let maxed: boolean;
        switch (kind) {
            case 'alba': cost = albaCost(s.alba); maxed = s.alba >= albaCap(s); break;
            case 'fire': case 'dough': case 'filling': case 'flip': case 'finish': {
                const sk = stepOfBuy(kind)!;
                cost = stepCost(sk, stepLv(s, sk));
                maxed = stepLv(s, sk) >= fireCap(s);
                break;
            }
            case 'recipe': cost = recipeCost(s.recipeLv); maxed = s.recipeLv >= recipeCap(s); break;
            case 'equip':
                cost = equipCost(s);
                if (cost === null) return { ok: false, reason: 'maxed', cost: null };
                maxed = false;
                break;
        }
        if (maxed) return { ok: false, reason: 'maxed', cost: null };
        if (s.money < cost) return { ok: false, reason: 'money', cost };
        return { ok: true, reason: 'ok', cost };
    }

    buy(kind: BuyKind): boolean {
        const c = this.check(kind);
        if (!c.ok || c.cost === null) return false;
        const s = this.state;
        s.money -= c.cost;
        if (kind === 'alba') s.alba += 1;
        else if (kind === 'fire') s.fireLv += 1;
        else if (kind === 'dough') s.doughLv += 1;
        else if (kind === 'filling') s.fillingLv += 1;
        else if (kind === 'flip') s.flipLv += 1;
        else if (kind === 'finish') s.finishLv += 1;
        else if (kind === 'recipe') s.recipeLv += 1;
        else s.equip += 1;
        this.emit({ type: 'purchase', kind, cost: c.cost });
        return true;
    }

    // ── 점포 확장 ──
    canExpand(): boolean {
        const s = this.state;
        return s.stage < STAGE_COUNT && s.money >= this.stage.expandCost;
    }
    expand(): boolean {
        if (!this.canExpand()) return false;
        const s = this.state;
        s.money -= this.stage.expandCost;
        s.stage += 1;
        this.emit({ type: 'expand', stage: s.stage });
        return true;
    }

    // ── 환생 ──
    canRebirth(): boolean { return canRebirth(this.state); }
    /** 지금 환생하면 얻을 FP */
    rebirthPreview(): number { return rebirthFpFor(this.state.runRevenue); }
    /** 예상 FP가 보유 FP의 50% 이상이면 '지금 개점하면 +N' 강조 */
    rebirthRecommended(): boolean {
        return this.canRebirth() && this.rebirthPreview() >= Math.max(1, this.state.fp * 0.5);
    }
    rebirth(): boolean {
        if (!this.canRebirth()) return false;
        const s = this.state;
        const gain = this.rebirthPreview();
        s.fp += gain;
        s.rebirths += 1;
        s.stage = 1;
        s.money = 0;
        s.runRevenue = 0;
        s.alba = startAlba(s);
        s.fireLv = 0;
        s.doughLv = 0;
        s.fillingLv = 0;
        s.flipLv = 0;
        s.finishLv = 0;
        s.recipeLv = 0;
        s.equip = 0;
        this.heat = 0;
        this.goldenLeft = 0;
        this.batchAcc = 0;
        this.stepIndex = 0;
        this.stepElapsed = 99;
        this.combo = 0;
        this.emit({ type: 'rebirth', fpGained: gain, rebirths: s.rebirths });
        return true;
    }

    // ── 프랜차이즈 업그레이드 ──
    canBuyFpUp(k: FpUpKind): boolean {
        const c = fpUpCost(this.state, k);
        return c !== null && fpAvailable(this.state) >= c;
    }
    buyFpUp(k: FpUpKind): boolean {
        if (!this.canBuyFpUp(k)) return false;
        this.state.fpUp[k] += 1;
        this.emit({ type: 'fp-upgrade', kind: k, level: this.state.fpUp[k] });
        return true;
    }
    fpUpDesc(k: FpUpKind) { return FP_UPGRADES[k]; }

    // ── 오프라인 ──
    /**
     * 정산 = AUTO × min(elapsed, 한도) × 0.5. 탭·황금 불판 제외. 음수 elapsed는 0.
     * 구매·확장·환생은 일어나지 않는다. state.savedAt은 호출 측(SaveManager)이 갱신한다.
     */
    applyOffline(nowMs: number): OfflineReport {
        const s = this.state;
        const elapsedSec = Math.max(0, (nowMs - s.savedAt) / 1000);
        const cap = Math.max(0, Math.floor(this.offlineCap()));
        const appliedSec = Math.min(elapsedSec, cap);
        const gained = autoPerSec(s) * appliedSec * B.offlineRate;
        this.earn(gained);
        s.stats.offlineEarned += gained;
        s.stats.offlineSec += appliedSec;
        return {
            gained, elapsedSec, appliedSec,
            capped: elapsedSec > cap,
            show: gained > 0 && elapsedSec >= B.offlineMinShowSec,
        };
    }
    offlineCap(): number { return offlineCapSec(this.state); }

    /** 저장 초기화 후 새 게임 */
    reset(now = 0) {
        const settings = this.state.settings;
        this.state = createNewState(now);
        this.state.settings = { ...settings };
        this.heat = 0;
        this.goldenLeft = 0;
        this.batchAcc = 0;
        this.stepIndex = 0;
        this.stepElapsed = 99;
        this.combo = 0;
        this.emit({ type: 'state-reset' });
    }
}
