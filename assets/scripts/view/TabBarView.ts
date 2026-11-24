import { _decorator, Button, Component, Node, Sprite, SpriteFrame, tween, Vec3 } from 'cc';
import { onClick, offClick, setActive, setFrame } from './UiUtil';

const { ccclass, property } = _decorator;

/** 하단 3탭(매장/성장/본사). 페이지 노드 active 토글, 점 스프라이트 교체, 밑줄 이동. */
@ccclass('TabBarView')
export class TabBarView extends Component {
    @property({ type: [Button], tooltip: '탭 버튼 3개: 0 매장 / 1 성장 / 2 본사' }) tabButtons: Button[] = [];
    @property({ type: [Node], tooltip: '탭 페이지 루트 3개(같은 순서). 매장 탭 요소는 항상 보이는 공통부와 분리해 둔다' }) pages: Node[] = [];
    @property({ type: [Sprite], tooltip: '탭 점 Sprite 3개(ui_tab_dot)' }) dots: Sprite[] = [];
    @property({ type: SpriteFrame, tooltip: 'ui_tab_dot_on' }) dotOn: SpriteFrame | null = null;
    @property({ type: SpriteFrame, tooltip: 'ui_tab_dot_off' }) dotOff: SpriteFrame | null = null;
    @property({ type: Node, tooltip: '선택 탭 밑줄(ui_tab_underline). 선택된 탭 버튼 x로 이동' }) underline: Node | null = null;
    @property({ tooltip: '시작 탭' }) startTab = 0;

    private index = -1;
    private handlers: Array<() => void> = [];

    onEnable() {
        this.handlers = this.tabButtons.map((_, i) => () => this.select(i));
        this.tabButtons.forEach((b, i) => onClick(b, this.handlers[i], this));
        this.select(this.index >= 0 ? this.index : this.startTab, true);
    }

    onDisable() {
        this.tabButtons.forEach((b, i) => offClick(b, this.handlers[i], this));
    }

    select(i: number, instant = false) {
        this.index = i;
        this.pages.forEach((p, k) => setActive(p, k === i));
        this.dots.forEach((d, k) => setFrame(d, k === i ? this.dotOn : this.dotOff));
        const target = this.tabButtons[i];
        if (this.underline && target) {
            const p = this.underline.position;
            const to = new Vec3(target.node.position.x, p.y, p.z);
            if (instant) this.underline.setPosition(to);
            else tween(this.underline).to(0.15, { position: to }).start();
        }
    }
}
