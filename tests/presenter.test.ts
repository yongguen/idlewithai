import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
    comboText, expandInfo, franchiseInfo, fpUpInfos, hintText, investInfo, progressInfo, roadmapCards, stepRows, tapStepText, todaysPicks,
} from '../assets/scripts/core/Presenter';
import { MemoryStorage } from '../assets/scripts/core/Save';
import { GameSession } from '../assets/scripts/core/Session';
import { cycleSec } from '../assets/scripts/core/Economy';
import { gameWith } from './helpers';

test('투자 카드 문구: 알바·화덕·레시피·설비 상태', () => {
    const g = gameWith({ money: 45 });
    const alba = investInfo(g, 'alba');
    assert.equal(alba.state, 'ok');
    assert.equal(alba.levelText, '0 / 2명');
    assert.equal(alba.priceText, '₩ 25');
    const fire = investInfo(g, 'fire');
    assert.equal(fire.state, 'ok');
    assert.equal(fire.effectText, '굽기 1.20초 → 1.00초');
    assert.equal(fire.noteText, 'Lv 10에서 ×1.5');
    assert.equal(investInfo(g, 'recipe').state, 'money'); // 60 필요
    assert.equal(investInfo(g, 'recipe').noteText, 'Lv 10에서 ×2');
    const eq = investInfo(g, 'equip');
    assert.equal(eq.state, 'locked');
    assert.equal(eq.priceText, '잠금');
    g.state.fireLv = 10;
    assert.equal(investInfo(g, 'fire').state, 'maxed');
    assert.equal(investInfo(g, 'fire').priceText, '최대');
    g.state.stage = 2;
    const eq2 = investInfo(g, 'equip');
    assert.equal(eq2.title, '자동 뒤집개');
    assert.equal(eq2.priceText, '₩ 7,500');
});

test('오늘의 투자: 최대 2개, 한도·잠금 제외, 회수 시간 순', () => {
    const g = gameWith({ money: 1000 });
    const picks = todaysPicks(g);
    assert.equal(picks.length, 2);
    assert.ok(!picks.includes('equip')); // 1단계는 설비 없음
    g.state.alba = 2; // 알바 한도
    assert.ok(!todaysPicks(g).includes('alba'));
});

test('진행도·확장·프랜차이즈 문구 (§2.4)', () => {
    const g = gameWith({ money: 15000 });
    const p = progressInfo(g);
    assert.equal(p.title, '1 / 11 기본 붕어빵'); // 스테이지 = 붕어빵 종류
    assert.equal(p.nextText, '다음: 팥 붕어빵');
    assert.equal(p.percentText, '50%');
    assert.equal(expandInfo(g).enabled, false);
    assert.equal(expandInfo(g).text, '팥 붕어빵 개발 ₩ 30,000');
    g.state.money = 30000;
    assert.equal(expandInfo(g).enabled, true);
    assert.equal(expandInfo(g).text, '새 메뉴 개발 → 팥 붕어빵');
    assert.equal(franchiseInfo(g).text, '대형가게에서 해금 →');
    const g5 = gameWith({ stage: 5, runRevenue: 5e12 });
    assert.equal(progressInfo(g5).title, '5 / 11 황금 붕어빵');
    assert.equal(progressInfo(g5).nextText, '다음: 공장 (준비 중)');
    assert.equal(expandInfo(g5).visible, false);
    assert.equal(franchiseInfo(g5).state, 'progress');
    assert.equal(franchiseInfo(g5).text, '프랜차이즈 개점 50%');
    g5.state.runRevenue = 1e13;
    const f = franchiseInfo(g5);
    assert.equal(f.state, 'ready');
    assert.equal(f.text, '프랜차이즈 개점 (+5 포인트)');
    assert.equal(f.enabled, true);
});

test('안내 문구: 첫 플레이 유도 → 알바 고용 → 자동', () => {
    const g = gameWith();
    assert.equal(hintText(g), '단계가 차면 바로 탭! 이어 탭하면 콤보');
    g.state.money = 25;
    assert.equal(hintText(g), '알바를 고용하면 자동으로 구워요!');
    g.buy('alba');
    assert.equal(hintText(g), '알바가 자동으로 굽는 중 · 단계마다 탭하면 매출 추가');
});

test('로드맵 6~11 카드는 준비 중 토스트만', () => {
    const cards = roadmapCards();
    assert.equal(cards.length, 6);
    assert.equal(cards[0].index, 6);
    assert.equal(cards[5].index, 11);
    assert.ok(cards.every(c => c.toast.includes('준비 중')));
});

test('FP 업그레이드 목록', () => {
    const g = gameWith({ fp: 5 });
    const list = fpUpInfos(g);
    assert.equal(list.length, 3);
    assert.equal(list[0].costText, '3 FP');
    assert.equal(list[0].canBuy, true);
    assert.equal(list[1].canBuy, true); // 4 ≤ 5
    assert.equal(list[2].costText, '3 FP');
});

test('백그라운드 복귀 정산 resume(): 숨긴 시간만큼 한 번', () => {
    const st = new MemoryStorage();
    const t = { now: 1_700_000_000_000 };
    const s = new GameSession(st, () => t.now);
    s.start();
    s.game.state.alba = 2;
    s.saveNow(); // 숨김 시점 저장
    t.now += 600_000; // 10분
    const rep = s.resume();
    assert.ok(rep && rep.gained > 0);
    assert.equal(s.resume(), null); // 즉시 다시 복귀해도 이중 정산 없음
});

test('굽기 단계 탭: 5행 문구·병목 표시', () => {
    const g = gameWith({ money: 100 });
    const rows = stepRows(g);
    assert.deepEqual(rows.map(r => r.name), ['반죽 알바', '앙금 알바', '화덕 알바', '뒤집기 알바', '포장 알바']); // 알바 종류
    assert.deepEqual(rows.map(r => r.task), ['반죽 넣기', '설탕 넣기', '굽기', '뒤집기', '완성']); // 1단계 붕어빵의 속은 설탕
    assert.equal(rows[0].timeText, '0.60초 → 0.50초');
    assert.equal(rows[0].priceText, '₩ 8');
    assert.equal(rows[2].timeText, '1.20초 → 1.00초');
    assert.ok(rows[2].bottleneck && rows.filter(r => r.bottleneck).length === 1); // 굽기가 가장 느림
    g.state.fireLv = 10; // 굽기가 빨라지면 병목이 옮겨 간다(반죽·팥 0.6초 동률 → 첫 번째)
    assert.equal(stepRows(g).find(r => r.bottleneck)!.kind, 'dough');
});

test('굽기 버튼 문구·콤보 문구', () => {
    const g = gameWith();
    assert.equal(tapStepText(g), '1. 반죽 넣기!');
    g.tap();
    assert.equal(tapStepText(g), '2. 설탕 넣기');
    g.tick(0.7);
    assert.equal(tapStepText(g), '2. 설탕 넣기!');
    assert.equal(comboText(g), '');
    g.tap(); // 콤보 2
    g.tick(1.3); // 굽기 단계(1.2초) 준비
    g.tap();
    assert.equal(comboText(g), '콤보 3 · 수익 ×1.10');
});

test('붕어빵 종류 스테이지: 단계마다 속 재료 이름과 굽는 시간 배율이 바뀐다', () => {
    const g = gameWith({ stage: 2 });
    assert.equal(tapStepText(g), '1. 반죽 넣기!');
    g.tap();
    assert.equal(tapStepText(g), '2. 팥 넣기'); // 팥 붕어빵
    assert.equal(stepRows(g)[1].task, '팥 넣기');
    // 2단계 붕어빵은 1.25배 오래 굽는다 → 한 판 3.75초
    assert.ok(Math.abs(cycleSec(g.state) - 3.75) < 1e-9);
    g.state.stage = 5; // 황금 붕어빵 2배
    assert.ok(Math.abs(cycleSec(g.state) - 6) < 1e-9);
    assert.equal(stepRows(g)[1].task, '황금 앙금 넣기');
});
