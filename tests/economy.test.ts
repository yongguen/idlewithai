import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formatNum, formatDuration } from '../assets/scripts/core/Num';
import {
    albaCost, autoPerSec, bakeValue, comboMult, cycleSec, equipCost, fireCost, fireMult, franchiseMult, recipeCost, recipeMult,
    rebirthFpFor, stepCost, stepSec,
} from '../assets/scripts/core/Economy';
import { STEPS } from '../assets/scripts/core/Balance';
import { createNewState } from '../assets/scripts/core/GameState';
import { gameWith, near } from './helpers';

test('포맷: Prototype_Plan §4.9 규칙', () => {
    assert.equal(formatNum(0), '0');
    assert.equal(formatNum(999), '999');
    assert.equal(formatNum(12480), '12,480');
    assert.equal(formatNum(1e8), '1.00억');
    assert.equal(formatNum(3.2e8), '3.20억');
    assert.equal(formatNum(1.5e12), '1.50조');
    assert.equal(formatNum(1e20), '1.00e20');
    assert.equal(formatNum(NaN), '0');
    assert.equal(formatNum(-5), '0');
    assert.equal(formatNum(999999.9), '999,999');
    assert.equal(formatNum(99999999.99), '9999.99만');
    assert.equal(formatNum(1e6), '100.00만');
    assert.equal(formatDuration(3725), '01:02:05');
    assert.equal(formatDuration(-3), '00:00:00');
});

test('공식: 화력·레시피 배수 레벨 0/1/10/25 (손계산)', () => {
    assert.ok(near(fireMult(0), 1));
    assert.ok(near(fireMult(1), 1.2));
    assert.ok(near(fireMult(10), 4.5)); // (1+2)×1.5
    assert.ok(near(fireMult(25), 13.5)); // (1+5)×1.5²
    assert.ok(near(recipeMult(0), 1));
    assert.ok(near(recipeMult(1), 1.25));
    assert.ok(near(recipeMult(10), 7)); // 3.5×2
    assert.ok(near(recipeMult(25), 29)); // 7.25×4
    assert.ok(near(franchiseMult(5), 2));
});

test('공식: BV·AUTO 조합', () => {
    const s = createNewState(0);
    s.stage = 3; s.recipeLv = 10; s.fp = 5; s.equip = 2; s.alba = 3; s.fireLv = 10;
    const bv = 720 * 7 * 2 * 2.56; // 슈크림 붕어빵 V=720(시간 배율 1.5 반영)
    assert.ok(near(bakeValue(s), bv));
    // 한 판 시간 = 5단계 합 × 붕어빵 시간 배율(3단계 1.5): 굽기만 Lv10(1.2/4.5), 나머지 Lv0
    const cyc = 1.5 * (1.8 + 1.2 / 4.5);
    assert.ok(near(cycleSec(s), cyc));
    assert.ok(near(autoPerSec(s), (3 * bv) / cyc));
    // 1단계 첫 상태: 알바 0 → 자동 수익 0, 탭 1회 8
    assert.equal(autoPerSec(createNewState(0)), 0);
    assert.equal(bakeValue(createNewState(0)), 8);
});

test('비용 공식', () => {
    assert.equal(albaCost(0), 25);
    assert.ok(near(albaCost(2), 25 * 2.4 * 2.4));
    // 단계 스탯 비용 = 40 × (단계 시간 비중) × 1.5^Lv. 굽기(1.2/3)=16부터
    assert.equal(fireCost(0), 16);
    assert.ok(near(fireCost(2), 36));
    assert.equal(stepCost('dough', 0), 8);
    assert.equal(stepCost('flip', 0), 4);
    // 5단계를 같은 레벨까지 올리는 총비용 = 예전 화덕 비용(40×1.5^lv)
    for (const lv of [0, 1, 5]) {
        const sum = STEPS.reduce((a, d) => a + stepCost(d.kind, lv), 0);
        assert.ok(near(sum, 40 * Math.pow(1.5, lv)));
    }
    assert.equal(recipeCost(0), 60);
    assert.ok(near(recipeCost(1), 93));
    const s = createNewState(0);
    assert.equal(equipCost(s), null); // 1단계 설비 없음
    s.stage = 2;
    assert.equal(equipCost(s), 7500); // 0.25 × 3만
    s.equip = 1; s.stage = 3;
    assert.equal(equipCost(s), 0.25 * 3e6);
    s.equip = 2; s.stage = 5;
    assert.equal(equipCost(s), 0.25 * 4e8);
});

test('구매: 비용 부족 불가 / 한도 불가 / 구매 후 감소량 = 비용', () => {
    const g = gameWith({ money: 24 });
    assert.equal(g.buy('alba'), false);
    assert.equal(g.check('alba').reason, 'money');
    g.state.money = 100;
    assert.equal(g.buy('alba'), true);
    assert.equal(g.state.alba, 1);
    assert.equal(g.state.money, 75);
    assert.equal(g.buy('alba'), true); // 두 번째는 60, 75 보유
    assert.equal(g.state.money, 15);
    assert.equal(g.buy('alba'), false); // 한도 2 (money 15도 부족)
});

test('구매: 알바 한도·레벨 한도·설비 한도', () => {
    const g = gameWith({ money: 1e12 });
    assert.ok(g.buy('alba'));
    assert.ok(g.buy('alba'));
    assert.equal(g.check('alba').reason, 'maxed'); // 1단계 한도 2
    for (let i = 0; i < 10; i++) assert.ok(g.buy('fire'));
    assert.equal(g.buy('fire'), false);
    assert.equal(g.state.fireLv, 10);
    for (let i = 0; i < 10; i++) assert.ok(g.buy('recipe'));
    assert.equal(g.check('recipe').reason, 'maxed');
    assert.equal(g.check('equip').reason, 'maxed'); // 1단계 설비 없음
    const before = g.state.money;
    assert.equal(g.buy('equip'), false);
    assert.equal(g.state.money, before);
    // 단계가 오르면 한도 해금
    assert.ok(g.expand());
    assert.equal(g.check('fire').ok, true);
    assert.ok(g.buy('equip'));
    assert.equal(g.state.equip, 1);
    assert.equal(g.check('equip').reason, 'maxed'); // 2단계 설비는 하나
});

test('구매 이벤트 발행', () => {
    const g = gameWith({ money: 1000 });
    const ev: string[] = [];
    g.on(e => ev.push(e.type));
    g.buy('alba');
    assert.deepEqual(ev, ['purchase']);
});

test('확장: 비용 충족 시에만 +1, 5단계는 확장 불가, 비용 차감', () => {
    const g = gameWith({ money: 29999 });
    assert.equal(g.canExpand(), false);
    assert.equal(g.expand(), false);
    assert.equal(g.state.stage, 1);
    g.state.money = 30500;
    assert.equal(g.expand(), true);
    assert.equal(g.state.stage, 2);
    assert.equal(g.state.money, 500);
    const g5 = gameWith({ stage: 5, money: 1e30 });
    assert.equal(g5.canExpand(), false);
    assert.equal(g5.expand(), false);
    assert.equal(g5.state.stage, 5);
});

test('진행도: 1~4단계 = 매출/확장비용, 5단계 = 회차 누적/환생 목표', () => {
    const g = gameWith({ money: 15000 });
    assert.ok(near(g.progress(), 0.5));
    g.state.money = 1e9;
    assert.equal(g.progress(), 1);
    const g5 = gameWith({ stage: 5, runRevenue: 5e12, money: 0 });
    assert.ok(near(g5.progress(), 0.5));
});

test('직접 굽기: 첫 탭은 BV만큼 벌고, 단계가 준비되기 전 탭은 무시', () => {
    const g = gameWith();
    assert.equal(g.tap(), 8); // 시작 직후 첫 단계(반죽)는 바로 수행
    assert.equal(g.state.money, 8);
    assert.equal(g.state.runRevenue, 8);
    assert.equal(g.state.totalRevenue, 8);
    assert.equal(g.stepIndex, 1); // 다음은 팥(0.6초)
    assert.equal(g.tap(), 0); // 아직 준비 안 됨
    assert.equal(g.state.money, 8);
    g.tick(0.5);
    assert.equal(g.tap(), 0);
    g.tick(0.1);
    assert.ok(near(g.tap(), 8.4)); // 제때 이어 탭 → 콤보 2(×1.05)
});

test('직접 굽기: 5단계를 순서대로 거치고 완성에서 한 바퀴가 돈다', () => {
    const g = gameWith();
    const steps: string[] = [];
    let done = 0;
    g.on(e => { if (e.type === 'tap') { steps.push(e.step); if (e.cycleDone) done++; } });
    const want = ['dough', 'filling', 'bake', 'flip', 'finish'];
    for (const k of want) {
        g.tick(2); // 어떤 단계든 준비됨
        assert.equal(g.currentStep, k);
        assert.ok(g.tap() > 0);
    }
    assert.deepEqual(steps, want);
    assert.equal(done, 1);
    assert.equal(g.stepIndex, 0);
});

test('직접 굽기 콤보: 제때 이어 탭하면 +5%씩, 늦으면 1부터', () => {
    const g = gameWith();
    const amounts: number[] = [];
    g.on(e => { if (e.type === 'tap') amounts.push(e.amount); });
    g.tap(); // 첫 탭: 콤보 1(×1.00)
    for (let i = 0; i < 4; i++) {
        g.tick(g.currentStepSec() + 0.1); // 준비 직후(유예 0.6초 안)
        g.tap();
    }
    assert.equal(g.combo, 5);
    assert.ok(near(amounts[4], 8 * 1.2)); // 콤보 5 → ×1.20
    assert.ok(near(comboMult(21), 2));
    assert.ok(near(comboMult(99), 2)); // 상한
    // 늦게(유예 초과) 탭하면 콤보 끊김
    g.tick(g.currentStepSec() + 0.7);
    assert.equal(g.combo, 0);
    g.tap();
    assert.equal(g.combo, 1);
});

test('직접 굽기: 초당 8회 제한(단계가 항상 준비돼 있어도)', () => {
    const g = gameWith();
    let ok = 0;
    for (let i = 0; i < 30; i++) { g.stepElapsed = 99; if (g.tap() > 0) ok++; }
    assert.equal(ok, 8); // 버스트 한도 8
    g.tick(0.5); // 4회분 회복
    let again = 0;
    for (let i = 0; i < 10; i++) { g.stepElapsed = 99; if (g.tap() > 0) again++; }
    assert.equal(again, 4);
});

test('굽기 단계: 한 판 시간은 5단계 합(스탯 0이면 3초)이고 단계 스탯이 해당 단계만 줄인다', () => {
    const s = createNewState(0);
    assert.ok(near(cycleSec(s), 3));
    assert.ok(near(stepSec(s, 'dough'), 0.6));
    s.doughLv = 10; // ×4.5
    assert.ok(near(stepSec(s, 'dough'), 0.6 / 4.5));
    assert.ok(near(stepSec(s, 'filling'), 0.6));
    assert.ok(near(cycleSec(s), 3 - 0.6 + 0.6 / 4.5));
    // 5단계를 같은 레벨로 올리면 예전 화력배수와 같은 효과
    s.doughLv = s.fillingLv = s.fireLv = s.flipLv = s.finishLv = 10;
    assert.ok(near(cycleSec(s), 3 / 4.5));
});

test('굽기 단계 구매: 종류별 레벨·한도·차감', () => {
    const g = gameWith({ money: 1e6 });
    for (const k of ['dough', 'filling', 'fire', 'flip', 'finish'] as const) {
        const before = g.state.money;
        const c = g.check(k).cost!;
        assert.ok(g.buy(k));
        assert.ok(near(before - g.state.money, c));
    }
    assert.deepEqual([g.state.doughLv, g.state.fillingLv, g.state.fireLv, g.state.flipLv, g.state.finishLv], [1, 1, 1, 1, 1]);
    g.state.doughLv = 10; // 1단계 한도
    assert.equal(g.check('dough').reason, 'maxed');
    assert.equal(g.buy('dough'), false);
});

test('자동 생산: 알바 × BV / 한 판 시간 (tick 적분)', () => {
    const g = gameWith({ alba: 2, fireLv: 10, recipeLv: 10 });
    const rate = (2 * 8 * 7) / (1.8 + 1.2 / 4.5);
    assert.ok(near(g.incomePerSec(), rate));
    for (let i = 0; i < 100; i++) g.tick(0.1);
    assert.ok(near(g.state.money, rate * 10, 1e-9));
    assert.ok(near(g.state.playSec, 10, 1e-9));
});

test('자동 생산 이벤트: 판 수 합이 알바×SP/3×t와 일치', () => {
    const g = gameWith({ alba: 3, fireLv: 0 });
    let batches = 0;
    g.on(e => { if (e.type === 'auto-bake') batches += e.batches; });
    for (let i = 0; i < 300; i++) g.tick(0.1); // 30초 → 3명 × 30/3 = 30판
    assert.ok(Math.abs(batches - 30) <= 1, String(batches));
});

test('황금 불판: 13회 탭에 발동, ×3, 8초 후 종료·게이지 0', () => {
    const g = gameWith({ alba: 1 });
    const ev: string[] = [];
    g.on(e => { if (e.type === 'golden-start' || e.type === 'golden-end') ev.push(e.type); });
    let taps = 0;
    while (!g.isGolden && taps < 100) { g.stepElapsed = 99; g.tap(); g.tick(0.15); taps++; }
    assert.equal(taps, 13); // 8×13=104 ≥ 100
    assert.deepEqual(ev, ['golden-start']);
    assert.equal(g.state.stats.goldenCount, 1);
    const base = (8 * 1) / 3;
    assert.ok(near(g.incomePerSec(), base * 3));
    assert.equal(g.bakeValue(), 24);
    const m0 = g.state.money;
    g.tick(1);
    assert.ok(near(g.state.money - m0, base * 3));
    g.tick(7); // 총 8초 경과(첫 0.15 틱은 발동 전)
    g.tick(0.2);
    assert.equal(g.isGolden, false);
    assert.equal(g.heat, 0);
    assert.deepEqual(ev, ['golden-start', 'golden-end']);
});

test('황금 불판: 경계 틱은 남은 시간만 ×3', () => {
    const g = gameWith({ alba: 1 });
    g.goldenLeft = 0.5;
    g.tick(1);
    // 0.5초 ×3 + 0.5초 ×1 = 2초분
    assert.ok(near(g.state.money, (8 / 3) * 2));
});

test('불 게이지: 1.5초 유지 후 초당 10 감소', () => {
    const g = gameWith();
    for (let i = 0; i < 8; i++) { g.stepElapsed = 99; g.tap(); } // 64
    assert.equal(g.heat, 64);
    g.tick(1);
    assert.equal(g.heat, 64);
    g.tick(2); // 유지 1.5초 후 1.5초 감소
    assert.ok(near(g.heat, 49));
    g.tick(10);
    assert.equal(g.heat, 0);
});

test('규칙: 1단계 첫 알바는 탭 4회(₩32)로 고용 가능', () => {
    const g = gameWith();
    for (let i = 0; i < 3; i++) { g.stepElapsed = 99; g.tap(); }
    assert.equal(g.check('alba').ok, false);
    g.stepElapsed = 99;
    g.tap();
    assert.equal(g.check('alba').ok, true);
});
