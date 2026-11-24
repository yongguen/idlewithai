import { _decorator, Button, Label } from 'cc';
import type { OfflineReport } from '../core/Game';
import { formatDuration, formatNum } from '../core/Num';
import { GameController } from './GameController';
import { GameEvents } from './GameEvents';
import { PopupView } from './PopupView';
import { setText } from './UiUtil';

const { ccclass, property } = _decorator;

/** 오프라인 정산 팝업. 시작 시 1회 + 백그라운드 복귀 시. 광고 2배 버튼은 비활성 모형(D6). */
@ccclass('OfflinePopupView')
export class OfflinePopupView extends PopupView {
    @property({ type: Label, tooltip: "'+N 매출'" }) gainLabel: Label | null = null;
    @property({ type: Label, tooltip: "'자리 비운 시간 hh:mm:ss'" }) timeLabel: Label | null = null;
    @property({ type: Label, tooltip: "'한도 도달' 문구(한도를 넘었을 때만 표시)" }) capLabel: Label | null = null;
    @property({ type: Button, tooltip: "광고 2배 모형 버튼. interactable=false로 고정된다(광고 미구현)" }) adButton: Button | null = null;

    onEnable() {
        super.onEnable();
        GameController.I?.events.on(GameEvents.OFFLINE, this.present, this);
    }

    onDisable() {
        super.onDisable();
        GameController.I?.events.off(GameEvents.OFFLINE, this.present, this);
    }

    start() {
        if (this.adButton) this.adButton.interactable = false;
        const rep = GameController.I?.takePendingOffline();
        if (rep) this.present(rep);
        else this.close();
    }

    private present(rep: OfflineReport) {
        setText(this.gainLabel, `+₩ ${formatNum(rep.gained)}`);
        setText(this.timeLabel, `자리 비운 시간 ${formatDuration(rep.appliedSec)}`);
        setText(this.capLabel, rep.capped ? `최대 ${formatDuration(rep.appliedSec)}까지만 정산돼요 (한도 도달)` : '');
        this.show();
    }
}
