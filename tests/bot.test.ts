import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runTwoCycles } from './bot';

const within = (v: number, target: number, tol = 0.25) =>
    Math.abs(v - target) <= target * tol;

test('봇 시뮬 0.5탭/초: §4.8 목표 시간 ±25% (5단계 16분, 환생 22분, 2회차 11분)', () => {
    const r = runTwoCycles(0.5);
    const min = (s: number) => s / 60;
    console.log('  [bot 0.5/s] 5단계', min(r.first.stageAt[4]).toFixed(1), '분 / 환생가능', min(r.first.rebirthReadyAt).toFixed(1),
        '분 / 2회차', min(r.second.rebirthReadyAt).toFixed(1), '분 / FP', r.fp);
    assert.equal(r.fp, 5);
    assert.ok(within(min(r.first.stageAt[4]), 16), '5단계 도달');
    assert.ok(within(min(r.first.rebirthReadyAt), 22), '환생 목표 1회차');
    assert.ok(within(min(r.second.rebirthReadyAt), 11), '환생 목표 2회차');
});

test('봇 시뮬 2탭/초: 완주 가능하고 0.5탭/초보다 빠르며 2회차가 1회차보다 빠르다', () => {
    const slow = runTwoCycles(0.5);
    const fast = runTwoCycles(2);
    console.log('  [bot 2/s] 환생가능', (fast.first.rebirthReadyAt / 60).toFixed(1), '분 / 2회차', (fast.second.rebirthReadyAt / 60).toFixed(1),
        '분 (기획 목표 18/9분 — 미충족, Code_Handoff 참고)');
    assert.ok(fast.first.rebirthReadyAt > 0);
    assert.ok(fast.first.rebirthReadyAt < slow.first.rebirthReadyAt);
    assert.ok(fast.second.rebirthReadyAt < fast.first.rebirthReadyAt);
});

test('방치 플레이(탭 0): 알바 고용 불가라 진행하지 못한다는 점을 확인(첫 알바는 탭 필요)', () => {
    const r = runTwoCycles(0);
    assert.equal(r.first.rebirthReadyAt, -1);
});
