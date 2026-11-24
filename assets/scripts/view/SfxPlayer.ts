import { _decorator, AudioClip, AudioSource, Component } from 'cc';
import type { StepKind } from '../core/Balance';
import { GameController } from './GameController';
import { GameEvents } from './GameEvents';

const { ccclass, property } = _decorator;

/**
 * 효과음. 클립이 비어 있으면 아무것도 하지 않는다. 설정의 사운드 off를 따른다.
 * 굽기 단계마다 다른 소리(퍽·뽁·지글·휙·띵)가 나서 '굽는 리듬'이 귀로도 들린다. 콤보 10 이상 완성은 반짝이는 소리.
 */
@ccclass('SfxPlayer')
export class SfxPlayer extends Component {
    @property({ type: AudioSource, tooltip: '같은 노드의 AudioSource. 비우면 자동 탐색' }) source: AudioSource | null = null;
    @property({ type: AudioClip, tooltip: 'sfx_dough 반죽 넣기' }) doughClip: AudioClip | null = null;
    @property({ type: AudioClip, tooltip: 'sfx_filling 속 넣기' }) fillingClip: AudioClip | null = null;
    @property({ type: AudioClip, tooltip: 'sfx_bake 굽기(지글지글)' }) bakeClip: AudioClip | null = null;
    @property({ type: AudioClip, tooltip: 'sfx_flip 뒤집기' }) flipClip: AudioClip | null = null;
    @property({ type: AudioClip, tooltip: 'sfx_finish 완성(띵)' }) finishClip: AudioClip | null = null;
    @property({ type: AudioClip, tooltip: 'sfx_finish_big 콤보 10+ 완성' }) finishBigClip: AudioClip | null = null;
    @property({ type: AudioClip, tooltip: 'sfx_early 단계가 안 찼는데 탭' }) earlyClip: AudioClip | null = null;
    @property({ type: AudioClip, tooltip: 'sfx_buy' }) buyClip: AudioClip | null = null;
    @property({ type: AudioClip, tooltip: 'sfx_expand 새 메뉴 개발·환생' }) expandClip: AudioClip | null = null;
    @property({ type: AudioClip, tooltip: 'sfx_golden' }) goldenClip: AudioClip | null = null;

    onEnable() {
        if (!this.source) this.source = this.getComponent(AudioSource);
        const ev = GameController.I?.events;
        ev?.on(GameEvents.TAP, this.onTap, this);
        ev?.on(GameEvents.TAP_EARLY, this.onEarly, this);
        ev?.on(GameEvents.PURCHASE, this.onBuy, this);
        ev?.on(GameEvents.FP_UPGRADE, this.onBuy, this);
        ev?.on(GameEvents.EXPAND, this.onExpand, this);
        ev?.on(GameEvents.REBIRTH, this.onExpand, this);
        ev?.on(GameEvents.GOLDEN_START, this.onGolden, this);
    }

    onDisable() {
        const ev = GameController.I?.events;
        ev?.off(GameEvents.TAP, this.onTap, this);
        ev?.off(GameEvents.TAP_EARLY, this.onEarly, this);
        ev?.off(GameEvents.PURCHASE, this.onBuy, this);
        ev?.off(GameEvents.FP_UPGRADE, this.onBuy, this);
        ev?.off(GameEvents.EXPAND, this.onExpand, this);
        ev?.off(GameEvents.REBIRTH, this.onExpand, this);
        ev?.off(GameEvents.GOLDEN_START, this.onGolden, this);
    }

    private play(clip: AudioClip | null) {
        const gc = GameController.I;
        if (!clip || !this.source || !gc || !gc.game.state.settings.sound) return;
        this.source.playOneShot(clip, 1);
    }

    private stepClip(step: StepKind, combo: number): AudioClip | null {
        switch (step) {
            case 'dough': return this.doughClip;
            case 'filling': return this.fillingClip;
            case 'bake': return this.bakeClip;
            case 'flip': return this.flipClip;
            case 'finish': return combo >= 10 && this.finishBigClip ? this.finishBigClip : this.finishClip;
        }
    }
    private onTap(e: { step: StepKind; combo: number }) { this.play(this.stepClip(e.step, e.combo)); }
    private onEarly() { this.play(this.earlyClip); }
    private onBuy() { this.play(this.buyClip); }
    private onExpand() { this.play(this.expandClip); }
    private onGolden() { this.play(this.goldenClip); }
}
