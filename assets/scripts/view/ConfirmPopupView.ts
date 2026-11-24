import { _decorator, Button, Label } from 'cc';
import { PopupView } from './PopupView';
import { onClick, offClick, setText } from './UiUtil';

const { ccclass, property } = _decorator;

/** 확인/취소 팝업(환생 확인, 저장 초기화 2단계). 씬에 하나만 두고 `ConfirmPopupView.I?.open(...)`로 호출. */
@ccclass('ConfirmPopupView')
export class ConfirmPopupView extends PopupView {
    static I: ConfirmPopupView | null = null;

    @property({ type: Label }) titleLabel: Label | null = null;
    @property({ type: Label }) bodyLabel: Label | null = null;
    @property({ type: Button, tooltip: '확인(실행) 버튼' }) confirmButton: Button | null = null;
    @property({ type: Button, tooltip: '취소 버튼. closeButton과 같아도 된다' }) cancelButton: Button | null = null;

    private onYes: (() => void) | null = null;

    onLoad() { ConfirmPopupView.I = this; }
    onDestroy() { if (ConfirmPopupView.I === this) ConfirmPopupView.I = null; }

    onEnable() {
        super.onEnable();
        onClick(this.confirmButton, this.confirm, this);
        onClick(this.cancelButton, this.close, this);
    }

    onDisable() {
        super.onDisable();
        offClick(this.confirmButton, this.confirm, this);
        offClick(this.cancelButton, this.close, this);
    }

    open(title: string, body: string, onYes: () => void) {
        setText(this.titleLabel, title);
        setText(this.bodyLabel, body);
        this.onYes = onYes;
        this.show();
    }

    private confirm() {
        const f = this.onYes;
        this.onYes = null;
        this.close();
        if (f) f();
    }
}
