// 밸런스 상수. 출처: Docs/Prototype_Plan.md §4. 수치 조정은 이 파일의 표만 건드린다.

export const STAGE_COUNT = 5;

export interface StageDef {
    id: number;
    /** 이 단계의 붕어빵 종류(스테이지 구분 기준) */
    name: string;
    /** 점포 이름(배경·가게 연출) */
    store: string;
    /** 속 재료 이름(2단계 '○○ 넣기') */
    filling: string;
    /** 이 붕어빵의 굽는 시간 배율. 단단한 붕어빵일수록 오래 걸린다(벽돌의 체력에 해당) */
    timeMult: number;
    /** 판당 기본 수익 V */
    value: number;
    albaCap: number;
    /** 화덕·레시피 레벨 한도 */
    levelCap: number;
    /** 다음 단계로 점포 확장하는 비용. 마지막 단계는 0(환생으로 연결) */
    expandCost: number;
    /** 이 단계에서 구매하는 설비 이름. 1단계는 없음 */
    equipName: string;
    /** 화면에 그릴 알바 수 상한(나머지는 배지 숫자) */
    albaShown: number;
    /** 손님 줄 길이 */
    customers: number;
}

export const STAGES: StageDef[] = [
    { id: 1, name: '기본 붕어빵',   store: '리어카',   filling: '설탕',     timeMult: 1.00, value: 8,     albaCap: 2,  levelCap: 10, expandCost: 30000,   equipName: '',            albaShown: 0, customers: 1 },
    { id: 2, name: '팥 붕어빵',     store: '포장마차', filling: '팥',       timeMult: 1.25, value: 75,    albaCap: 4,  levelCap: 20, expandCost: 3000000, equipName: '자동 뒤집개',   albaShown: 4, customers: 2 },
    { id: 3, name: '슈크림 붕어빵', store: '구멍가게', filling: '슈크림',   timeMult: 1.50, value: 720,   albaCap: 6,  levelCap: 30, expandCost: 4e8,     equipName: '반죽 디스펜서', albaShown: 2, customers: 3 },
    { id: 4, name: '치즈 붕어빵',   store: '동네가게', filling: '치즈',     timeMult: 1.75, value: 7350,  albaCap: 8,  levelCap: 40, expandCost: 6e10,    equipName: '컨베이어 화덕', albaShown: 2, customers: 5 },
    { id: 5, name: '황금 붕어빵',   store: '대형가게', filling: '황금 앙금', timeMult: 2.00, value: 80000, albaCap: 10, levelCap: 50, expandCost: 0,       equipName: '포장 라인',     albaShown: 3, customers: 7 },
];

/** 6~11단계는 로드맵 표시 전용. 진입 경로 없음. */
export const ROADMAP: string[] = ['공장', '아파트형 공장', '공장도시', '공장국가', '공장행성', '공장우주'];

/** 굽기 5단계. baseSec 합 = B.bakeSec(3초). 스탯 레벨이 오르면 해당 단계 시간이 줄어든다(화력배수 공식 공용). */
export type StepKind = 'dough' | 'filling' | 'bake' | 'flip' | 'finish';
export interface StepDef { kind: StepKind; name: string; short: string; baseSec: number; /** 이 단계를 맡는 알바 종류(스탯 = 그 알바의 숙련도) */ role: string; }
export const STEPS: StepDef[] = [
    { kind: 'dough',   name: '반죽 넣기', short: '반죽',   baseSec: 0.6, role: '반죽 알바' },
    { kind: 'filling', name: '팥 넣기',   short: '팥',     baseSec: 0.6, role: '앙금 알바' },
    { kind: 'bake',    name: '굽기',      short: '굽기',   baseSec: 1.2, role: '화덕 알바' },
    { kind: 'flip',    name: '뒤집기',    short: '뒤집기', baseSec: 0.3, role: '뒤집기 알바' },
    { kind: 'finish',  name: '완성',      short: '완성',   baseSec: 0.3, role: '포장 알바' },
];
export const STEP_KINDS: StepKind[] = STEPS.map(s => s.kind);

export const B = {
    // 구매 비용
    albaBase: 25, albaGrowth: 2.4,
    fireBase: 40, fireGrowth: 1.5,
    recipeBase: 60, recipeGrowth: 1.55,
    equipCostRate: 0.25, // × 해당 단계 진입 비용
    equipMult: 1.6,
    // 생산
    fireStep: 0.20, fireMilestone: 1.5, // 10레벨마다 속도 ×1.5
    recipeStep: 0.25, recipeMilestone: 2, // 10레벨마다 수익 ×2
    milestoneEvery: 10,
    bakeSec: 3.0,
    // 직접 굽기 콤보: 단계가 준비된 뒤 graceSec 안에 탭하면 콤보 +1, 늦으면 1로 리셋. 수익 ×(1+comboStep×(콤보-1)), 콤보 comboMax에서 상한
    comboGraceSec: 0.6, comboStep: 0.05, comboMax: 21,
    maxTapPerSec: 8,
    // 황금 불판
    heatPerTap: 8, heatMax: 100, heatHoldSec: 1.5, heatDecayPerSec: 10,
    goldenSec: 8, goldenMult: 3,
    // 환생
    rebirthTarget: 1e13, rebirthFpBase: 5, franchiseStep: 0.20,
    // 오프라인
    offlineRate: 0.5, offlineBaseCapSec: 2 * 3600, offlineMinShowSec: 30,
    // 저장
    saveKey: 'bungeoppang.save.v1', saveVersion: 1,
    autoSaveSec: 5,
};

export type FpUpKind = 'train' | 'recipe' | 'night';
export const FP_UPGRADES: Record<FpUpKind, { name: string; desc: string; costs: number[] }> = {
    train:  { name: '본사 교육',   desc: '환생 후 시작 알바 +1명',     costs: [3, 5, 8, 12, 18] },
    recipe: { name: '비법 레시피', desc: '레시피 한도 전 단계 +5',     costs: [4, 6, 9, 14, 20] },
    night:  { name: '야간 영업',   desc: '오프라인 보상 한도 +1시간',  costs: [3, 4, 6, 9, 13] },
};
export const FP_UP_KINDS: FpUpKind[] = ['train', 'recipe', 'night'];
export const FP_UP_MAX = 5;
