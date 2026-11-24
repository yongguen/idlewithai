// 큰 수 표현. 프로토타입은 double로 충분하다(Prototype_Plan §4.9).
// 6~11단계 도입 시 이 파일의 별칭과 함수만 BigNum으로 교체한다.
export type Num = number;

// [표기 시작값, 나눌 값, 단위]. 1만~99만은 쉼표 정수가 읽기 쉬워 만 단위를 100만부터 쓴다.
const UNITS: Array<[number, number, string]> = [
    [1e16, 1e16, '경'],
    [1e12, 1e12, '조'],
    [1e8, 1e8, '억'],
    [1e6, 1e4, '만'],
];

/** 한국식 표기: 100만 미만 정수(쉼표) / 만·억·조·경 소수점 2자리 / 1e20 이상 지수. */
export function formatNum(n: Num): string {
    if (!Number.isFinite(n) || n <= 0) return '0';
    if (n >= 1e20) {
        const exp = Math.floor(Math.log10(n));
        const man = n / Math.pow(10, exp);
        return `${man.toFixed(2)}e${exp}`;
    }
    for (const [from, v, u] of UNITS) {
        if (n >= from) {
            // 3.999..→"4.00" 반올림이 다음 단위 경계를 넘지 않게 내림 처리
            const x = Math.floor((n / v) * 100 + 1e-9) / 100;
            return `${x.toFixed(2)}${u}`;
        }
    }
    return Math.floor(n + 1e-9).toLocaleString('en-US');
}

/** 초 → hh:mm:ss (오프라인 자리 비운 시간 표기). */
export function formatDuration(sec: number): string {
    const s = Math.max(0, Math.floor(sec));
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const p = (x: number) => (x < 10 ? '0' + x : '' + x);
    return `${p(h)}:${p(m)}:${p(s % 60)}`;
}

/** NaN·Infinity·음수 보정. */
export function cleanNum(v: unknown, fallback = 0, max = Number.MAX_VALUE): number {
    if (typeof v !== 'number' || !Number.isFinite(v) || v < 0) return fallback;
    return Math.min(v, max);
}
