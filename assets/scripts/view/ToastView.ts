import { _decorator, Component, Label, Node, tween, UIOpacity } from 'cc';

const { ccclass, property } = _decorator;

/** 한 줄 토스트. `ToastView.I?.show('...')`. 로드맵 '준비 중' 안내 등에 쓴다. */
@ccclass('ToastView')
export class ToastView extends Component {
    static I: ToastView | null = null;

    @property({ type: Label }) label: Label | null = null;
    @property({ type: Node, tooltip: '토스트 배경+라벨 루트(기본 비활성). 비우면 이 노드' }) root: Node | null = null;
    @property({ tooltip: '표시 시간(초)' }) duration = 1.6;

    onLoad() { ToastView.I = this; }
    onDestroy() { if (ToastView.I === this) ToastView.I = null; }

    show(text: string) {
        const r = this.root ?? this.node;
        if (this.label) this.label.string = text;
        r.active = true;
        const op = r.getComponent(UIOpacity) ?? r.addComponent(UIOpacity);
        op.opacity = 255;
        tween(op).stop();
        tween(op).delay(this.duration).to(0.3, { opacity: 0 }).call(() => { r.active = false; }).start();
    }
}
