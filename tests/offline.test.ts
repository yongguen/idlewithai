import { test } from 'node:test';
import assert from 'node:assert/strict';
import { autoPerSec } from '../assets/scripts/core/Economy';
import { gameWith, near } from './helpers';

const T0 = 1_700_000_000_000;
const rich = () => gameWith({ alba: 2, fireLv: 5, recipeLv: 5, savedAt: T0 });

test('오프라인: 보상 = AUTO × 시간 × 0.5', () => {
    const g = rich();
    const rate = autoPerSec(g.state);
    const rep = g.applyOffline(T0 + 3600 * 1000);
    assert.ok(near(rep.gained, rate * 3600 * 0.5));
    assert.equal(rep.appliedSec, 3600);
    assert.equal(rep.capped, false);
    assert.equal(rep.show, true);
    assert.ok(near(g.state.money, rep.gained));
    assert.ok(near(g.state.runRevenue, rep.gained)); // 환생 목표 누적에도 포함
    assert.ok(near(g.state.stats.offlineEarned, rep.gained));
});

test('오프라인: elapsed 음수(시계 되돌림)는 0', () => {
    const g = rich();
    const rep = g.applyOffline(T0 - 5000);
    assert.equal(rep.elapsedSec, 0);
    assert.equal(rep.gained, 0);
    assert.equal(rep.show, false);
    assert.equal(g.state.money, 0);
});

test('오프라인: 한도(2시간) 초과분은 버리고 capped 표시', () => {
    const g = rich();
    const rate = autoPerSec(g.state);
    const rep = g.applyOffline(T0 + 10 * 3600 * 1000);
    assert.equal(rep.appliedSec, 7200);
    assert.equal(rep.capped, true);
    assert.ok(near(rep.gained, rate * 7200 * 0.5));
});

test('오프라인: 야간 영업 레벨만큼 한도 +1시간', () => {
    const g = rich();
    g.state.fpUp.night = 3;
    const rep = g.applyOffline(T0 + 24 * 3600 * 1000);
    assert.equal(rep.appliedSec, 5 * 3600);
});

test('오프라인: 알바 0명이면 보상 없음·팝업 없음, 탭·황금 불판 제외', () => {
    const g = gameWith({ savedAt: T0 });
    g.goldenLeft = 8; // 황금 불판 중이어도 정산에 반영되지 않는다
    const rep = g.applyOffline(T0 + 3600 * 1000);
    assert.equal(rep.gained, 0);
    assert.equal(rep.show, false);
    const g2 = rich();
    g2.goldenLeft = 8;
    const rep2 = g2.applyOffline(T0 + 1000 * 3600);
    assert.ok(near(rep2.gained, autoPerSec(g2.state) * 3600 * 0.5));
});

test('오프라인: 너무 짧은 부재(<30초)는 지급하되 팝업 생략', () => {
    const g = rich();
    const rep = g.applyOffline(T0 + 10 * 1000);
    assert.ok(rep.gained > 0);
    assert.equal(rep.show, false);
});

test('오프라인: 구매·확장·환생이 일어나지 않는다', () => {
    const g = rich();
    g.state.money = 1e30;
    const snap = JSON.stringify({ ...g.state, money: 0, runRevenue: 0, totalRevenue: 0, stats: 0 });
    g.applyOffline(T0 + 3600 * 1000);
    assert.equal(JSON.stringify({ ...g.state, money: 0, runRevenue: 0, totalRevenue: 0, stats: 0 }), snap);
});
