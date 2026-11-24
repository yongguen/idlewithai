import { _decorator, Button, Component, Node, tween, UIOpacity } from 'cc';
import { onClick, offClick } from './UiUtil';

const { ccclass, property } = _decorator;

/** 팝업 공통: dim + 패널 루트를 열고 닫는다. 서브클래스는 open 시 내용을 채운다. */
@ccclass('PopupView')
export class PopupView extends Component {
    @property({ type: Node, tooltip: '팝업 전체 루트(ui_dim 포함). 기본 비활성으로 두면 된다' }) root: Node | null = null;
    @property({ type: Button, tooltip: '닫기/확인 버튼(선택)' }) closeButton: Button | null = null;

    onEnable() { onClick(this.closeButton, this.close, this); }
    onDisable() { offClick(this.closeButton, this.close, this); }

    get isOpen() { return !!this.root && this.root.active; }

    protected show() {
        const r = this.root ?? this.node;
        r.active = true;
        const op = r.getComponent(UIOpacity) ?? r.addComponent(UIOpacity);
        op.opacity = 0;
        tween(op).to(0.15, { opacity: 255 }).start();
    }

    close() {
        const r = this.root ?? this.node;
        r.active = false;
    }
}
