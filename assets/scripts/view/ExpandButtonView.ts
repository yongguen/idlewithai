import { _decorator, Button, Component, Label, Node, Sprite, SpriteFrame } from 'cc';
import { expandInfo } from '../core/Presenter';
import { GameController } from './GameController';
import { onClick, offClick, setActive, setFrame, setText } from './UiUtil';

const { ccclass, property } = _decorator;

/** 점포 확장 버튼(1~4단계에서만 보임). 가능해지면 활성(깜빡임 노드 선택). */
@ccclass('ExpandButtonView')
export class ExpandButtonView extends Component {
    @property({ type: Button, tooltip: '점포 확장 버튼' }) button: Button | null = null;
    @property({ type: Label, tooltip: "'점포 확장 → 포장마차' 또는 비용 안내" }) label: Label | null = null;
    @property({ type: Node, tooltip: '가능할 때 켜지는 강조 노드(선택)' }) readyGlow: Node | null = null;
    @property({ type: Node, tooltip: '5단계에서 숨길 루트. 비우면 이 노드' }) root: Node | null = null;
    @property({ type: Sprite, tooltip: '버튼 이미지(ui_btn_primary/disabled 교체). 선택' }) buttonSprite: Sprite | null = null;
    @property({ type: SpriteFrame }) enabledFrame: SpriteFrame | null = null;
    @property({ type: SpriteFrame }) disabledFrame: SpriteFrame | null = null;

    onEnable() { onClick(this.button, this.onTap, this); }
    onDisable() { offClick(this.button, this.onTap, this); }
    private onTap() { GameController.I?.game.expand(); }

    update() {
        const g = GameController.I?.game;
        if (!g) return;
        const info = expandInfo(g);
        setActive(this.root ?? this.node, info.visible);
        setText(this.label, info.text);
        if (this.button) this.button.interactable = info.enabled;
        setActive(this.readyGlow, info.enabled);
        setFrame(this.buttonSprite, info.enabled ? this.enabledFrame : this.disabledFrame);
    }
}
