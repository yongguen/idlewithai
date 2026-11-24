import { test } from 'node:test';
import assert from 'node:assert/strict';
import { B } from '../assets/scripts/core/Balance';
import { createNewState, sanitizeState } from '../assets/scripts/core/GameState';
import { MemoryStorage, SaveManager } from '../assets/scripts/core/Save';
import type { KeyValueStorage } from '../assets/scripts/core/Save';
import { GameSession } from '../assets/scripts/core/Session';
import { autoPerSec } from '../assets/scripts/core/Economy';
import { near } from './helpers';

const KEY = B.saveKey;
const BAK = B.saveKey + '.bak';
const T0 = 1_700_000_000_000;

function sample() {
    const s = createNewState(T0);
    Object.assign(s, {
        stage: 3, money: 12345.5, runRevenue: 99999, totalRevenue: 123456, alba: 4, fireLv: 12, recipeLv: 15,
        equip: 2, fp: 5, rebirths: 1, playSec: 321,
    });
    s.fpUp.train = 1;
    s.settings.sound = false;
    s.stats.taps = 50;
    return s;
}

test('키 이름은 bungeoppang.save.v1', () => {
    assert.equal(KEY, 'bungeoppang.save.v1');
});

test('저장 → 로드 왕복 동일', () => {
    const st = new MemoryStorage();
    const sm = new SaveManager(st);
    const s = sample();
    assert.equal(sm.save(s, T0), true);
    const r = new SaveManager(st).load(T0 + 1);
    assert.equal(r.source, 'main');
    assert.equal(r.warning, '');
    assert.deepEqual(r.state, s);
});

test('저장 없음 → 새 게임(경고 없음)', () => {
    const r = new SaveManager(new MemoryStorage()).load(T0);
    assert.equal(r.source, 'new');
    assert.equal(r.warning, '');
    assert.equal(r.state.stage, 1);
});

test('두 번째 저장부터 직전 저장이 .bak에 남는다', () => {
    const st = new MemoryStorage();
    const sm = new SaveManager(st);
    const a = sample();
    sm.save(a, T0);
    assert.equal(st.getItem(BAK), null);
    const b = sample();
    b.money = 777;
    sm.save(b, T0 + 1000);
    assert.equal(JSON.parse(st.getItem(BAK) as string).money, 12345.5);
    assert.equal(JSON.parse(st.getItem(KEY) as string).money, 777);
});

test('깨진 JSON → .bak 복구(예외 없음)', () => {
    const st = new MemoryStorage();
    const sm = new SaveManager(st);
    sm.save(sample(), T0);
    const b = sample(); b.money = 5;
    sm.save(b, T0 + 1);
    st.setItem(KEY, '{broken json');
    const r = new SaveManager(st).load(T0 + 2);
    assert.equal(r.source, 'backup');
    assert.equal(r.state.money, 12345.5);
    assert.ok(r.warning.length > 0);
});

test('손상된 저장이 정상 .bak을 덮어쓰지 않는다', () => {
    const st = new MemoryStorage();
    const sm = new SaveManager(st);
    sm.save(sample(), T0);
    sm.save(sample(), T0 + 1); // .bak 생성
    st.setItem(KEY, 'garbage');
    sm.save(sample(), T0 + 2);
    assert.notEqual(JSON.parse(st.getItem(BAK) as string), null);
    assert.equal(JSON.parse(st.getItem(BAK) as string).v, 1);
});

test('둘 다 깨짐 → 새 게임 + 경고', () => {
    const st = new MemoryStorage();
    st.setItem(KEY, 'x');
    st.setItem(BAK, '[1,2');
    const r = new SaveManager(st).load(T0);
    assert.equal(r.source, 'new');
    assert.ok(r.warning.length > 0);
    assert.equal(r.state.money, 0);
});

test('v 불일치 → .bak 시도, 없으면 새 게임', () => {
    const st = new MemoryStorage();
    st.setItem(KEY, JSON.stringify({ ...sample(), v: 2 }));
    const r = new SaveManager(st).load(T0);
    assert.equal(r.source, 'new');
    assert.ok(r.warning.length > 0);
    st.setItem(BAK, JSON.stringify(sample()));
    const r2 = new SaveManager(st).load(T0);
    assert.equal(r2.source, 'backup');
    assert.equal(r2.state.stage, 3);
});

test('필드 누락은 기본값으로 채움', () => {
    const s = sanitizeState({ v: 1, money: 500 }, T0)!;
    assert.equal(s.money, 500);
    assert.equal(s.stage, 1);
    assert.equal(s.alba, 0);
    assert.deepEqual(s.fpUp, { train: 0, recipe: 0, night: 0 });
    assert.equal(s.settings.sound, true);
    assert.equal(s.stats.taps, 0);
});

test('NaN·Infinity·음수·문자열·범위 밖 값 보정', () => {
    const raw = JSON.parse(`{"v":1,"money":-5,"runRevenue":1e999,"totalRevenue":"abc","stage":99,"alba":-3,
        "fireLv":1e9,"recipeLv":null,"equip":50,"fp":-1,"rebirths":2.9,"fpUp":{"train":99,"recipe":-1},
        "playSec":1e999,"settings":{"sound":false},"savedAt":-1}`);
    const s = sanitizeState(raw, T0)!;
    assert.equal(s.money, 0);
    assert.ok(Number.isFinite(s.runRevenue));
    assert.ok(s.runRevenue <= Number.MAX_VALUE);
    assert.ok(Number.isFinite(s.totalRevenue));
    assert.equal(s.stage, 5);
    assert.equal(s.alba, 0);
    assert.equal(s.fireLv, 50); // 5단계 한도
    assert.equal(s.recipeLv, 0);
    assert.equal(s.equip, 4);
    assert.equal(s.fp, 0);
    assert.equal(s.rebirths, 2);
    assert.equal(s.fpUp.train, 5);
    assert.equal(s.fpUp.recipe, 0);
    assert.equal(s.playSec, 0);
    assert.equal(s.settings.sound, false);
    assert.equal(s.savedAt, T0);
    for (const v of [null, undefined, 5, 'x', [], true]) {
        // 배열·원시값은 새 게임으로
        assert.equal(sanitizeState(v as any, T0), null);
    }
});

test('저장소 접근 불가: 예외 없이 메모리만 사용, available=false', () => {
    const bad: KeyValueStorage = {
        getItem() { throw new Error('denied'); },
        setItem() { throw new Error('denied'); },
        removeItem() { throw new Error('denied'); },
    };
    const sm = new SaveManager(bad);
    assert.equal(sm.available, false);
    assert.doesNotThrow(() => sm.save(sample(), T0));
    assert.doesNotThrow(() => sm.load(T0));
    assert.doesNotThrow(() => sm.clear());
    assert.equal(new SaveManager(null).available, false);
    assert.equal(new SaveManager(undefined).available, false);
});

test('저장 중 쓰기 예외(용량 초과 등)는 삼키고 available을 내린다', () => {
    const base = new MemoryStorage();
    let fail = false;
    const flaky: KeyValueStorage = {
        getItem: k => base.getItem(k),
        setItem: (k, v) => { if (fail) throw new Error('quota'); base.setItem(k, v); },
        removeItem: k => base.removeItem(k),
    };
    const sm = new SaveManager(flaky);
    assert.equal(sm.available, true);
    fail = true;
    assert.equal(sm.save(sample(), T0), false);
    assert.equal(sm.available, false);
});

test('저장 초기화는 두 키를 모두 삭제', () => {
    const st = new MemoryStorage();
    const sm = new SaveManager(st);
    sm.save(sample(), T0);
    sm.save(sample(), T0 + 1);
    sm.clear();
    assert.equal(st.getItem(KEY), null);
    assert.equal(st.getItem(BAK), null);
});

// ── 세션: 불러오기 → 오프라인 정산 → 저장 ──
function clockAt(t: { now: number }) { return () => t.now; }

test('세션: 재접속 시 오프라인 정산 1회, 즉시 재시작하면 이중 정산 없음', () => {
    const st = new MemoryStorage();
    const t = { now: T0 };
    const s1 = new GameSession(st, clockAt(t));
    assert.equal(s1.start(), null); // 새 게임: 정산 없음
    s1.game.state.alba = 2;
    s1.game.state.money = 1000;
    s1.saveNow();
    const rate = autoPerSec(s1.game.state);

    t.now = T0 + 3600_000;
    const s2 = new GameSession(st, clockAt(t));
    const rep = s2.start();
    assert.ok(rep);
    assert.ok(near(rep!.gained, rate * 3600 * 0.5));
    assert.ok(near(s2.game.state.money, 1000 + rep!.gained));
    assert.equal(s2.loadSource, 'main');

    const s3 = new GameSession(st, clockAt(t)); // 같은 시각 재시작
    assert.equal(s3.start(), null);
    assert.ok(near(s3.game.state.money, s2.game.state.money));
});

test('세션: 구매·확장·환생·FP 업그레이드 직후 자동 저장, 5초 주기 저장', () => {
    const st = new MemoryStorage();
    const t = { now: T0 };
    const s = new GameSession(st, clockAt(t));
    s.start();
    s.game.state.money = 100;
    s.game.buy('alba');
    assert.equal(JSON.parse(st.getItem(KEY) as string).alba, 1);
    // 주기 저장
    s.game.state.money = 4242;
    s.autoSave(4.9);
    assert.notEqual(JSON.parse(st.getItem(KEY) as string).money, 4242);
    s.autoSave(0.2);
    assert.equal(JSON.parse(st.getItem(KEY) as string).money, 4242);
});

test('세션: 깨진 저장으로 시작해도 게임이 동작, 경고 노출', () => {
    const st = new MemoryStorage();
    st.setItem(KEY, '###');
    const s = new GameSession(st, () => T0);
    assert.doesNotThrow(() => s.start());
    assert.equal(s.loadSource, 'new');
    assert.ok(s.warning.length > 0);
    assert.equal(s.game.tap(), 8);
});

test('세션: 저장 불가 환경에서도 시작·진행·저장 호출이 멈추지 않는다', () => {
    const s = new GameSession(null, () => T0);
    s.start();
    assert.equal(s.saveAvailable, false);
    s.game.tap();
    assert.doesNotThrow(() => s.saveNow());
    assert.doesNotThrow(() => s.autoSave(10));
});

test('세션: resetAll은 두 키를 지우고 새 게임으로 시작', () => {
    const st = new MemoryStorage();
    const s = new GameSession(st, () => T0);
    s.start();
    s.game.state.money = 100; s.game.buy('alba'); s.game.buy('alba');
    s.resetAll();
    assert.equal(s.game.state.alba, 0);
    assert.equal(JSON.parse(st.getItem(KEY) as string).alba, 0);
    assert.equal(st.getItem(BAK), null);
});

test('구저장(굽기 단계 스탯 필드 없음)은 0으로 읽고 화덕 레벨은 굽기 단계로 유지', () => {
    const old = createNewState(0) as any;
    delete old.doughLv; delete old.fillingLv; delete old.flipLv; delete old.finishLv;
    old.fireLv = 7; old.stage = 2; old.alba = 2;
    const s = sanitizeState(JSON.parse(JSON.stringify(old)))!;
    assert.deepEqual([s.doughLv, s.fillingLv, s.flipLv, s.finishLv], [0, 0, 0, 0]);
    assert.equal(s.fireLv, 7);
});

test('단계 스탯은 단계 한도·음수·NaN으로 보정', () => {
    const raw = createNewState(0) as any;
    raw.doughLv = 999; raw.fillingLv = -4; raw.flipLv = 'x'; raw.finishLv = 3.9;
    const s = sanitizeState(JSON.parse(JSON.stringify(raw)))!; // 1단계 한도 10
    assert.deepEqual([s.doughLv, s.fillingLv, s.flipLv, s.finishLv], [10, 0, 0, 3]);
});
