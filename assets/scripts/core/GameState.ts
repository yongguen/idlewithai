import { B, FP_UP_MAX, STAGES, STAGE_COUNT } from './Balance';
import type { Num } from './Num';
import { cleanNum } from './Num';

export interface GameState {
    v: number;
    savedAt: number;
    stage: number;
    money: Num;
    runRevenue: Num;
    totalRevenue: Num;
    alba: number;
    /** 굽기 단계 스탯(=화덕). 저장 호환을 위해 이름 유지 */
    fireLv: number;
    doughLv: number;
    fillingLv: number;
    flipLv: number;
    finishLv: number;
    recipeLv: number;
    /** 이번 회차에 구매한 설비 수 (단계 2~5에 하나씩) */
    equip: number;
    /** 지금까지 환생으로 번 총 FP (소비해도 줄지 않는다. 영구 배수 기준) */
    fp: number;
    rebirths: number;
    fpUp: { train: number; recipe: number; night: number };
    heat: number;
    playSec: number;
    settings: { sound: boolean };
    stats: { taps: number; goldenCount: number; offlineEarned: Num; offlineSec: number };
}

export function createNewState(now = 0): GameState {
    return {
        v: B.saveVersion,
        savedAt: now,
        stage: 1,
        money: 0,
        runRevenue: 0,
        totalRevenue: 0,
        alba: 0,
        fireLv: 0,
        doughLv: 0,
        fillingLv: 0,
        flipLv: 0,
        finishLv: 0,
        recipeLv: 0,
        equip: 0,
        fp: 0,
        rebirths: 0,
        fpUp: { train: 0, recipe: 0, night: 0 },
        heat: 0,
        playSec: 0,
        settings: { sound: true },
        stats: { taps: 0, goldenCount: 0, offlineEarned: 0, offlineSec: 0 },
    };
}

const int = (v: unknown, def: number, min: number, max: number) =>
    Math.min(max, Math.max(min, Math.floor(cleanNum(v, def, max))));

/**
 * 외부(저장소)에서 읽은 임의 값을 유효한 상태로 보정한다.
 * 객체가 아니거나 v가 다르면 null — 호출 측이 백업/새 게임으로 넘어간다.
 * 필드 누락은 기본값, NaN/Infinity/음수는 보정.
 */
export function sanitizeState(raw: unknown, now = 0): GameState | null {
    if (!raw || typeof raw !== 'object') return null;
    const r = raw as Record<string, any>;
    if (r.v !== B.saveVersion) return null;
    const d = createNewState(now);
    const up = (r.fpUp && typeof r.fpUp === 'object' ? r.fpUp : {}) as Record<string, unknown>;
    const st = (r.stats && typeof r.stats === 'object' ? r.stats : {}) as Record<string, unknown>;
    const money = cleanNum(r.money, 0);
    const runRevenue = Math.max(cleanNum(r.runRevenue, 0), 0);
    const out: GameState = {
        v: B.saveVersion,
        savedAt: cleanNum(r.savedAt, now),
        stage: int(r.stage, 1, 1, STAGE_COUNT),
        money,
        runRevenue,
        totalRevenue: Math.max(cleanNum(r.totalRevenue, 0), runRevenue),
        alba: int(r.alba, 0, 0, 15),
        fireLv: int(r.fireLv, 0, 0, 100),
        doughLv: int(r.doughLv, 0, 0, 100),
        fillingLv: int(r.fillingLv, 0, 0, 100),
        flipLv: int(r.flipLv, 0, 0, 100),
        finishLv: int(r.finishLv, 0, 0, 100),
        recipeLv: int(r.recipeLv, 0, 0, 100),
        equip: int(r.equip, 0, 0, STAGE_COUNT - 1),
        fp: int(r.fp, 0, 0, 1e9),
        rebirths: int(r.rebirths, 0, 0, 1e9),
        fpUp: {
            train: int(up.train, 0, 0, FP_UP_MAX),
            recipe: int(up.recipe, 0, 0, FP_UP_MAX),
            night: int(up.night, 0, 0, FP_UP_MAX),
        },
        heat: 0,
        playSec: cleanNum(r.playSec, 0),
        settings: { sound: (r.settings as any)?.sound !== false },
        stats: {
            taps: cleanNum(st.taps, 0),
            goldenCount: cleanNum(st.goldenCount, 0),
            offlineEarned: cleanNum(st.offlineEarned, 0),
            offlineSec: cleanNum(st.offlineSec, 0),
        },
    };
    // 단계 한도를 넘는 값(변조·버전 차이)은 한도로 내린다.
    const def = STAGES[out.stage - 1];
    out.fireLv = Math.min(out.fireLv, def.levelCap);
    out.doughLv = Math.min(out.doughLv, def.levelCap);
    out.fillingLv = Math.min(out.fillingLv, def.levelCap);
    out.flipLv = Math.min(out.flipLv, def.levelCap);
    out.finishLv = Math.min(out.finishLv, def.levelCap);
    out.recipeLv = Math.min(out.recipeLv, def.levelCap + 5 * out.fpUp.recipe);
    out.equip = Math.min(out.equip, out.stage - 1);
    out.alba = Math.min(out.alba, Math.max(def.albaCap, 1 + out.fpUp.train));
    return out;
}
