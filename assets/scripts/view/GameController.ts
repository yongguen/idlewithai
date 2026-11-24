import { _decorator, Component, EventTarget, game as ccGame, Game as CcGame, sys } from 'cc';
import { Game } from '../core/Game';
import type { GameEvent, OfflineReport } from '../core/Game';
import type { KeyValueStorage } from '../core/Save';
import { GameSession } from '../core/Session';
import { GameEvents } from './GameEvents';

const { ccclass, property, executionOrder } = _decorator;

/** 저장소: Cocos sys.localStorage → 브라우저 localStorage → 없으면 null(메모리만, '저장 불가' 표시). SQLite 사용 안 함. */
function resolveStorage(): KeyValueStorage | null {
    try {
        if (sys && sys.localStorage) return sys.localStorage as KeyValueStorage;
    } catch { /* 접근 불가 환경 */ }
    try {
        const ls = (globalThis as any).localStorage;
        if (ls) return ls as KeyValueStorage;
    } catch { /* 사생활 보호 모드 등 */ }
    return null;
}

/**
 * 씬 루트에 한 개만 붙이는 진입점. core(Game/Session)를 소유하고 매 프레임 tick, 저장, 백그라운드 정산,
 * core 이벤트 → `events`(EventTarget) 중계를 맡는다. 다른 View는 `GameController.I`로 접근한다.
 * executionOrder(-100): 다른 View의 onLoad/onEnable보다 먼저 초기화된다.
 */
@ccclass('GameController')
@executionOrder(-100)
export class GameController extends Component {
    static I: GameController | null = null;

    @property({ tooltip: '한 프레임에 진행할 최대 시간(초). 탭 전환 직후 큰 dt를 잘라낸다(그 시간은 백그라운드 정산이 처리)' })
    maxFrameDt = 0.25;

    readonly events = new EventTarget();
    session!: GameSession;
    private pendingOffline: OfflineReport | null = null;
    private pageHideHandler = () => this.session?.saveNow();

    get game(): Game { return this.session.game; }

    onLoad() {
        GameController.I = this;
        this.session = new GameSession(resolveStorage());
        this.pendingOffline = this.session.start();
        this.session.game.on((e: GameEvent) => this.events.emit('game:' + e.type, e));
        ccGame.on(CcGame.EVENT_HIDE, this.onHide, this);
        ccGame.on(CcGame.EVENT_SHOW, this.onShow, this);
        if (typeof window !== 'undefined' && window.addEventListener) {
            window.addEventListener('pagehide', this.pageHideHandler);
        }
    }

    start() {
        this.events.emit(GameEvents.READY);
    }

    onDestroy() {
        ccGame.off(CcGame.EVENT_HIDE, this.onHide, this);
        ccGame.off(CcGame.EVENT_SHOW, this.onShow, this);
        if (typeof window !== 'undefined' && window.removeEventListener) {
            window.removeEventListener('pagehide', this.pageHideHandler);
        }
        if (GameController.I === this) GameController.I = null;
    }

    update(dt: number) {
        const d = Math.min(dt, this.maxFrameDt);
        this.session.game.tick(d);
        this.session.autoSave(d);
    }

    /** 시작 시 정산 결과를 한 번만 꺼낸다(팝업이 start()에서 호출) */
    takePendingOffline(): OfflineReport | null {
        const r = this.pendingOffline;
        this.pendingOffline = null;
        return r;
    }

    private onHide() { this.session.saveNow(); }
    private onShow() {
        const rep = this.session.resume();
        if (rep) this.events.emit(GameEvents.OFFLINE, rep);
    }

    setSound(on: boolean) {
        this.session.game.state.settings.sound = on;
        this.session.saveNow();
        this.events.emit(GameEvents.SOUND_CHANGED, on);
    }
}
