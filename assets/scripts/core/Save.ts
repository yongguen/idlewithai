// 저장·불러오기. localStorage 한 키(JSON) + 직전 저장 .bak. SQLite 사용 안 함.
// `cc`를 import하지 않는다 — 저장소는 KeyValueStorage로 주입(Cocos는 sys.localStorage 어댑터).
import { B } from './Balance';
import { createNewState, sanitizeState } from './GameState';
import type { GameState } from './GameState';

export interface KeyValueStorage {
    getItem(key: string): string | null;
    setItem(key: string, value: string): void;
    removeItem(key: string): void;
}

/** 저장소를 못 쓰는 환경(사생활 보호 모드 등)의 대체. 메모리에만 남는다. */
export class MemoryStorage implements KeyValueStorage {
    private m = new Map<string, string>();
    getItem(k: string) { return this.m.has(k) ? (this.m.get(k) as string) : null; }
    setItem(k: string, v: string) { this.m.set(k, v); }
    removeItem(k: string) { this.m.delete(k); }
}

export type LoadSource = 'new' | 'main' | 'backup';
export interface LoadResult {
    state: GameState;
    source: LoadSource;
    /** 설정 탭에 한 줄로 보여줄 경고 */
    warning: string;
}

export class SaveManager {
    /** false면 메모리만 사용 — '저장 불가' 표시 */
    available: boolean;
    private storage: KeyValueStorage;
    private bakKey = B.saveKey + '.bak';

    constructor(storage: KeyValueStorage | null | undefined) {
        this.available = SaveManager.probe(storage);
        this.storage = this.available ? (storage as KeyValueStorage) : new MemoryStorage();
    }

    private static probe(st: KeyValueStorage | null | undefined): boolean {
        if (!st) return false;
        try {
            const k = B.saveKey + '.probe';
            st.setItem(k, '1');
            const ok = st.getItem(k) === '1';
            st.removeItem(k);
            return ok;
        } catch {
            return false;
        }
    }

    private parse(raw: string | null, now: number): GameState | null {
        if (raw === null) return null;
        try {
            return sanitizeState(JSON.parse(raw), now);
        } catch {
            return null;
        }
    }

    load(now: number): LoadResult {
        let mainRaw: string | null = null;
        let bakRaw: string | null = null;
        try {
            mainRaw = this.storage.getItem(B.saveKey);
            bakRaw = this.storage.getItem(this.bakKey);
        } catch {
            this.available = false;
        }
        const main = this.parse(mainRaw, now);
        if (main) return { state: main, source: 'main', warning: '' };
        const bak = this.parse(bakRaw, now);
        if (bak) return { state: bak, source: 'backup', warning: '저장 데이터가 손상되어 직전 저장본을 불러왔습니다.' };
        const broken = mainRaw !== null || bakRaw !== null;
        return {
            state: createNewState(now),
            source: 'new',
            warning: broken ? '저장 데이터를 읽을 수 없어 새 게임으로 시작했습니다.' : '',
        };
    }

    /** 성공 여부 반환. 예외는 삼키고 available을 내린다. */
    save(state: GameState, now: number): boolean {
        state.savedAt = now;
        try {
            const prev = this.storage.getItem(B.saveKey);
            // 직전 저장이 유효할 때만 .bak으로 보관(손상본이 정상 백업을 덮지 않게)
            if (prev !== null && this.parse(prev, now)) this.storage.setItem(this.bakKey, prev);
            this.storage.setItem(B.saveKey, JSON.stringify(state));
            return true;
        } catch {
            this.available = false;
            return false;
        }
    }

    clear() {
        try {
            this.storage.removeItem(B.saveKey);
            this.storage.removeItem(this.bakKey);
        } catch {
            this.available = false;
        }
    }
}
