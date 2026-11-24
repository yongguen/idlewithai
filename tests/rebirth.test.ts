import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fpAvailable, fpSpent, franchiseMult, rebirthFpFor, recipeCap, startAlba } from '../assets/scripts/core/Economy';
import { gameWith, near } from './helpers';

test('환생: 목표 미달/단계 미달이면 불가', () => {
    const a = gameWith({ stage: 5, runRevenue: 9.99e12 });
    assert.equal(a.canRebirth(), false);
    assert.equal(a.rebirth(), false);
    assert.equal(a.state.rebirths, 0);
    const b = gameWith({ stage: 4, runRevenue: 1e14 });
    assert.equal(b.canRebirth(), false);
});

test('환생: FP = floor(5×sqrt(매출/1e13)), 최초 달성 5', () => {
    assert.equal(rebirthFpFor(1e13), 5);
    assert.equal(rebirthFpFor(4e13), 10);
    assert.equal(rebirthFpFor(2e13), 7); // 5×1.414=7.07
    assert.equal(rebirthFpFor(0), 0);
});

test('환생: 초기화·유지 항목이 §4.5와 일치', () => {
    const g = gameWith({
        stage: 5, money: 7e12, runRevenue: 1e13, totalRevenue: 3e13, alba: 10, fireLv: 40, doughLv: 30, fillingLv: 20, flipLv: 10, finishLv: 5, recipeLv: 45,
        equip: 4, fp: 0, rebirths: 0, playSec: 1234,
    });
    g.state.settings.sound = false;
    g.state.stats.taps = 77;
    g.heat = 50;
    const ev: any[] = [];
    g.on(e => ev.push(e));
    assert.equal(g.rebirth(), true);
    const s = g.state;
    // 초기화
    assert.equal(s.stage, 1);
    assert.equal(s.money, 0);
    assert.equal(s.runRevenue, 0);
    assert.equal(s.alba, 1); // 시작 알바 1명
    assert.equal(s.fireLv, 0);
    assert.deepEqual([s.doughLv, s.fillingLv, s.flipLv, s.finishLv], [0, 0, 0, 0]); // 굽기 단계 스탯도 초기화
    assert.equal(g.combo, 0);
    assert.equal(g.stepIndex, 0);
    assert.equal(s.recipeLv, 0);
    assert.equal(s.equip, 0);
    assert.equal(g.heat, 0);
    // 유지
    assert.equal(s.fp, 5);
    assert.equal(s.rebirths, 1);
    assert.equal(s.totalRevenue, 3e13);
    assert.equal(s.playSec, 1234);
    assert.equal(s.settings.sound, false);
    assert.equal(s.stats.taps, 77);
    assert.deepEqual(ev.map(e => e.type), ['rebirth']);
    assert.equal(ev[0].fpGained, 5);
    // 영구 배수 ×(1+0.2×5) = 2
    assert.ok(near(franchiseMult(s.fp), 2));
    assert.ok(near(g.bakeValue(), 16));
});

test('환생 추천: 예상 FP가 보유 FP의 50% 이상', () => {
    const g = gameWith({ stage: 5, runRevenue: 1e13, fp: 5 });
    assert.equal(g.rebirthRecommended(), true); // 5 ≥ 2.5
    g.state.fp = 20;
    assert.equal(g.rebirthRecommended(), false); // 5 < 10
});

test('프랜차이즈 업그레이드: FP 소비·한도·효과', () => {
    const g = gameWith({ fp: 7 });
    assert.equal(fpAvailable(g.state), 7);
    assert.equal(g.buyFpUp('train'), true); // 3
    assert.equal(fpSpent(g.state), 3);
    assert.equal(fpAvailable(g.state), 4);
    assert.equal(g.buyFpUp('train'), false); // 다음 5 > 4
    assert.equal(g.buyFpUp('night'), true); // 3
    assert.equal(fpAvailable(g.state), 1);
    assert.equal(g.buyFpUp('recipe'), false);
    // 소비해도 영구 배수(총 FP)는 유지
    assert.ok(near(franchiseMult(g.state.fp), 1 + 0.2 * 7));
    assert.equal(startAlba(g.state), 2);
    assert.equal(g.offlineCap(), 3 * 3600);
});

test('프랜차이즈 업그레이드: 시작 알바·레시피 한도 반영, 5레벨 상한', () => {
    const g = gameWith({ fp: 1000, stage: 5, runRevenue: 1e13 });
    for (let i = 0; i < 5; i++) assert.equal(g.buyFpUp('recipe'), true);
    assert.equal(g.buyFpUp('recipe'), false);
    assert.equal(recipeCap(g.state), 50 + 25);
    for (let i = 0; i < 2; i++) g.buyFpUp('train');
    g.rebirth();
    assert.equal(g.state.alba, 3); // 1 + 교육 2
});

test('환생 2회차: 영구 배수로 같은 상태에서 판당 수익이 커진다', () => {
    const g = gameWith({ stage: 5, runRevenue: 1e13 });
    const before = g.bakeValue();
    g.rebirth();
    g.state.stage = 5;
    assert.ok(g.bakeValue() >= before * 2 - 1e-6);
});
