import { _decorator, Button, Component, Label, Node } from 'cc';
import { franchiseInfo } from '../core/Presenter';
import { ConfirmPopupView } from './ConfirmPopupView';
import { GameController } from './GameController';
import { onClick, offClick, setActive, setText } from './UiUtil';

const { ccclass, property } = _decorator;

/** 프랜차이즈 띠(y 1660~1770): 잠금 → 진행 % → 개점 가능. 가능할 때 누르면 확인 팝업. */
@ccclass('FranchiseBandView')
export class FranchiseBandView extends Component {
    @property({ type: Button, tooltip: '띠 전체 버튼. 가능할 때만 interactable' }) button: Button | null = null;
    @property({ type: Label }) label: Label | null = null;
    @property({ type: Node, tooltip: '환생 가능/추천 때 강조 노드(선택)' }) readyGlow: Node | null = null;
    @property({ type: Node, tooltip: '잠금 중 보이는 자물쇠/화살표(선택)' }) lockIcon: Node | null = null;

    onEnable() { onClick(this.button, this.onTap, this); }
    onDisable() { offClick(this.button, this.onTap, this); }

    private onTap() {
        const g = GameController.I?.game;
        if (!g || !g.canRebirth()) return;
        const fp = g.rebirthPreview();
        ConfirmPopupView.I?.open(
            '프랜차이즈 개점',
            `지금 개점하면 +${fp} 포인트를 얻고\n매출·단계·알바·강화가 초기화됩니다.\n(영구 배수와 업그레이드는 유지)`,
            () => g.rebirth(),
        );
    }

    update() {
        const g = GameController.I?.game;
        if (!g) return;
        const info = franchiseInfo(g);
        setText(this.label, info.text);
        if (this.button) this.button.interactable = info.enabled;
        setActive(this.readyGlow, info.state === 'ready' && info.recommended);
        setActive(this.lockIcon, info.state === 'locked');
    }
}
