import { _decorator, Component, Label, Node, ProgressBar, Sprite, SpriteFrame, tween, Vec3 } from 'cc';
import { B } from '../core/Balance';
import { formatNum } from '../core/Num';
import { hintText, tapStepText } from '../core/Presenter';
import { GameController } from './GameController';
import { setActive, setFrame, setProgress, setText } from './UiUtil';

const { ccclass, property } = _decorator;

/** 굽기 버튼 + 불 게이지 + 안내 문구 + 황금 불판 표시. 터치 시작 즉시 반응한다(클릭 이벤트 아님). */
@ccclass('TapButtonView')
export class TapButtonView extends Component {
    @property({ type: Node, tooltip: '터치를 받는 굽기 버튼 노드(Button 컴포넌트 불필요, UITransform 필요)' }) tapNode: Node | null = null;
    @property({ type: Sprite, tooltip: '굽기 버튼 이미지(ui_btn_primary) — 눌림 상태 교체 대상' }) buttonSprite: Sprite | null = null;
    @property({ type: SpriteFrame, tooltip: 'ui_btn_primary' }) normalFrame: SpriteFrame | null = null;
    @property({ type: SpriteFrame, tooltip: 'ui_btn_primary_pressed' }) pressedFrame: SpriteFrame | null = null;
    @property({ type: Label, tooltip: "'지금 단계 + 벌 금액 (예: 2. 팥 넣기!  +8)'" }) tapLabel: Label | null = null;
    @property({ type: Label, tooltip: '안내 문구(상황별)' }) hintLabel: Label | null = null;
    @property({ type: ProgressBar, tooltip: '불 게이지(ui_heat_track/fill). 선택' }) heatBar: ProgressBar | null = null;
    @property({ type: Node, tooltip: '황금 불판 중에만 켜지는 노드(오라·문구). 선택' }) goldenRoot: Node | null = null;
    @property({ type: Label, tooltip: '황금 불판 남은 시간 표시. 선택' }) goldenTimerLabel: Label | null = null;

    onEnable() {
        const n = this.tapNode;
        if (!n) return;
        n.on(Node.EventType.TOUCH_START, this.onDown, this);
        n.on(Node.EventType.TOUCH_END, this.onUp, this);
        n.on(Node.EventType.TOUCH_CANCEL, this.onUp, this);
    }

    onDisable() {
        const n = this.tapNode;
        if (!n || !n.isValid) return;
        n.off(Node.EventType.TOUCH_START, this.onDown, this);
        n.off(Node.EventType.TOUCH_END, this.onUp, this);
        n.off(Node.EventType.TOUCH_CANCEL, this.onUp, this);
    }

    private onDown() {
        const gc = GameController.I;
        if (!gc) return;
        gc.game.tap();
        setFrame(this.buttonSprite, this.pressedFrame);
        if (this.tapNode) {
            this.tapNode.setScale(0.96, 0.96, 1);
            tween(this.tapNode).to(0.08, { scale: new Vec3(1, 1, 1) }).start();
        }
    }

    private onUp() {
        setFrame(this.buttonSprite, this.normalFrame);
    }

    update() {
        const gc = GameController.I;
        if (!gc) return;
        const g = gc.game;
        setText(this.tapLabel, `${tapStepText(g)}  +${formatNum(g.nextTapValue())}`);
        setText(this.hintLabel, hintText(g));
        setProgress(this.heatBar, g.isGolden ? 1 : g.heat / B.heatMax);
        setActive(this.goldenRoot, g.isGolden);
        if (g.isGolden) setText(this.goldenTimerLabel, `${Math.ceil(g.goldenLeft)}초`);
    }
}
