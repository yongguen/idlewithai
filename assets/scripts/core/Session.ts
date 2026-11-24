// Game + SaveManager 묶음: 시작(불러오기→오프라인 정산), 주기·이벤트 저장, 초기화.
// 시계는 주입(Date.now) — 테스트에서 가짜 시계를 쓴다. `cc` 의존 없음.
import { B } from './Balance';
import { Game } from './Game';
import type { OfflineReport } from './Game';
import { SaveManager } from './Save';
import type { KeyValueStorage, LoadSource } from './Save';

export class GameSession {
    readonly game: Game;
    readonly saver: SaveManager;
    /** start()가 만든 오프라인 정산 결과. UI가 한 번 읽고 팝업을 띄운다. */
    offline: OfflineReport | null = null;
    loadSource: LoadSource = 'new';
    warning = '';
    private sinceSave = 0;
    private clock: () => number;

    constructor(storage: KeyValueStorage | null | undefined, clock: () => number = Date.now) {
        this.clock = clock;
        this.saver = new SaveManager(storage);
        this.game = new Game(undefined, clock());
    }

    get saveAvailable() { return this.saver.available; }

    /** 저장 불러오기 + 오프라인 정산. 한 번만 호출한다. */
    start(): OfflineReport | null {
        const now = this.clock();
        const res = this.saver.load(now);
        this.loadSource = res.source;
        this.warning = res.warning;
        this.game.state = res.state;
        this.offline = null;
        if (res.source !== 'new') {
            const rep = this.game.applyOffline(now);
            this.offline = rep.show ? rep : null;
        }
        this.game.on(e => {
            if (e.type === 'purchase' || e.type === 'expand' || e.type === 'rebirth' || e.type === 'fp-upgrade') {
                this.saveNow();
            }
        });
        this.saveNow(); // 정산 직후 savedAt 갱신 → 같은 시간 이중 정산 방지
        return this.offline;
    }

    /**
     * 앱이 백그라운드에 있던 시간 정산(브라우저 탭 숨김·모바일 전환). 숨길 때 saveNow()를 해 두었다는 전제.
     * 팝업 대상이면 결과를 반환한다.
     */
    resume(): OfflineReport | null {
        const rep = this.game.applyOffline(this.clock());
        this.saveNow();
        this.offline = rep.show ? rep : null;
        return this.offline;
    }

    /** 매 프레임 dt(초) 전달 — 5초 주기 자동 저장 */
    autoSave(dt: number) {
        this.sinceSave += dt;
        if (this.sinceSave >= B.autoSaveSec) this.saveNow();
    }

    saveNow(): boolean {
        this.sinceSave = 0;
        return this.saver.save(this.game.state, this.clock());
    }

    /** 저장 초기화(UI에서 2단계 확인 후 호출) */
    resetAll() {
        this.saver.clear();
        this.game.reset(this.clock());
        this.offline = null;
        this.warning = '';
        this.saveNow();
    }
}
