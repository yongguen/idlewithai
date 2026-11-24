import { _decorator, Button, Label, Sprite, SpriteFrame } from 'cc';
import { formatDuration, formatNum } from '../core/Num';
import { ConfirmPopupView } from './ConfirmPopupView';
import { GameController } from './GameController';
import { PopupView } from './PopupView';
import { onClick, offClick, setFrame, setText } from './UiUtil';

const { ccclass, property } = _decorator;

/** 설정 팝업: 사운드 on/off, 저장 상태·경고, 마지막 오프라인 정산, 저장 초기화(2단계 확인). 열기 버튼은 openButton. */
@ccclass('SettingsPopupView')
export class SettingsPopupView extends PopupView {
    @property({ type: Button, tooltip: '헤더 설정 버튼(icon_settings). 누르면 팝업이 열린다' }) openButton: Button | null = null;
    @property({ type: Button, tooltip: '사운드 토글 버튼' }) soundButton: Button | null = null;
    @property({ type: Sprite, tooltip: '사운드 아이콘 Sprite' }) soundIcon: Sprite | null = null;
    @property({ type: SpriteFrame, tooltip: 'icon_sound_on' }) soundOnFrame: SpriteFrame | null = null;
    @property({ type: SpriteFrame, tooltip: 'icon_sound_off' }) soundOffFrame: SpriteFrame | null = null;
    @property({ type: Label, tooltip: "'저장됨' / '저장 불가 — 이 브라우저에서는 진행이 보존되지 않아요'" }) saveStatusLabel: Label | null = null;
    @property({ type: Label, tooltip: '불러오기 경고(손상 복구 등). 없으면 빈 문자열' }) warningLabel: Label | null = null;
    @property({ type: Label, tooltip: '누적 오프라인 정산 기록' }) offlineLogLabel: Label | null = null;
    @property({ type: Button, tooltip: '저장 초기화 버튼' }) resetButton: Button | null = null;

    onEnable() {
        super.onEnable();
        onClick(this.openButton, this.open, this);
        onClick(this.soundButton, this.toggleSound, this);
        onClick(this.resetButton, this.askReset, this);
    }

    onDisable() {
        super.onDisable();
        offClick(this.openButton, this.open, this);
        offClick(this.soundButton, this.toggleSound, this);
        offClick(this.resetButton, this.askReset, this);
    }

    open() {
        this.refresh();
        this.show();
    }

    private toggleSound() {
        const gc = GameController.I;
        if (gc) gc.setSound(!gc.game.state.settings.sound);
        this.refresh();
    }

    /** 2단계 확인: 1차 → 2차 모두 확인해야 삭제 */
    private askReset() {
        const gc = GameController.I;
        const popup = ConfirmPopupView.I;
        if (!gc || !popup) return;
        popup.open('저장 초기화', '저장된 진행 상황을 모두 지울까요?', () => {
            popup.open('정말 초기화할까요?', '되돌릴 수 없습니다.\n영구 배수와 환생 기록도 사라져요.', () => {
                gc.session.resetAll();
                this.close();
            });
        });
    }

    private refresh() {
        const gc = GameController.I;
        if (!gc) return;
        const s = gc.game.state;
        setFrame(this.soundIcon, s.settings.sound ? this.soundOnFrame : this.soundOffFrame);
        setText(this.saveStatusLabel, gc.session.saveAvailable ? '저장됨 (브라우저 저장소)' : '저장 불가 — 이 환경에서는 진행이 보존되지 않아요');
        setText(this.warningLabel, gc.session.warning);
        setText(this.offlineLogLabel, `오프라인 정산 누적 ₩ ${formatNum(s.stats.offlineEarned)} (${formatDuration(s.stats.offlineSec)})`);
    }
}
