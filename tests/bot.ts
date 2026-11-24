// 탐욕 봇: Prototype_Plan §4.8 규칙(회수 시간이 가장 짧은 항목을 즉시 구매, 점포 확장은 가능하면 즉시).
// 시간은 시뮬레이션 초. 실제 시계·`cc` 미사용.
import { Game } from '../assets/scripts/core/Game';
import { createNewState } from '../assets/scripts/core/GameState';
import { BUY_KINDS, incomeGain } from '../assets/scripts/core/Presenter';
import type { BuyKind } from '../assets/scripts/core/Game';

export interface BotResult {
    stageAt: number[]; // 단계 i+1에 도달한 시각(초). 1단계는 0
    rebirthReadyAt: number; // 환생 목표 도달 시각
}

const KINDS: BuyKind[] = BUY_KINDS;

/** 한 회차를 환생 목표 도달까지 돌린다. 시작 상태는 g.state(환생 직후 포함). */
/** tapRate: 초당 탭 시도 횟수(0.5·2 등). skilled=true면 단계가 준비되는 즉시 탭(콤보 유지). */
export function runCycle(g: Game, tapRate: number, maxSec = 3600, skilled = false): BotResult {
    const dt = 0.1;
    const res: BotResult = { stageAt: [0, 0, 0, 0, 0], rebirthReadyAt: -1 };
    let t = 0;
    let tapAcc = 0;
    let decideAcc = 0;
    while (t < maxSec) {
        if (skilled) {
            for (let i = 0; i < 5 && g.stepReady(); i++) g.tap();
        } else {
            tapAcc += tapRate * dt;
            while (tapAcc >= 1) { g.tap(); tapAcc -= 1; }
        }
        g.tick(dt);
        t += dt;
        decideAcc += dt;
        if (decideAcc < 0.25) continue;
        decideAcc = 0;
        // 확장 우선
        while (g.canExpand()) {
            g.expand();
            res.stageAt[g.state.stage - 1] = t;
        }
        // 최선 구매 반복
        for (;;) {
            let best: BuyKind | null = null;
            let bestPay = Infinity;
            for (const k of KINDS) {
                const c = g.check(k);
                if (!c.ok || c.cost === null) continue;
                const gain = incomeGain(g, k, tapRate);
                if (gain <= 0) continue;
                const pay = c.cost / gain;
                if (pay < bestPay) { bestPay = pay; best = k; }
            }
            if (!best) break;
            g.buy(best);
        }
        if (g.canRebirth()) { res.rebirthReadyAt = t; return res; }
    }
    return res;
}

export function runTwoCycles(tapRate: number, skilled = false) {
    const g = new Game(createNewState(0));
    const first = runCycle(g, tapRate, 3600, skilled);
    const fp = g.rebirthPreview();
    g.rebirth();
    const second = runCycle(g, tapRate, 3600, skilled);
    return { first, second, fp };
}
