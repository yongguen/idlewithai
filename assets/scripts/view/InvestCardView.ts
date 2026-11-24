import { _decorator, Button, CCInteger, Component, Enum, Label, Node, Sprite, SpriteFrame, tween, Vec3 } from 'cc';
import { investInfo, todaysPicks } from '../core/Presenter';
import type { BuyKind } from '../core/Game';
import { GameController } from './GameController';
import { GameEvents } from './GameEvents';
import { onClick, offClick, setActive, setFrame, setText } from './UiUtil';

const { ccclass, property } = _decorator;

export enum CardKind { Alba = 0, Fire = 1, Recipe = 2, Equip = 3 }
const KIND_OF: BuyKind[] = ['alba', 'fire', 'recipe', 'equip'];
/** 아이콘 번호: 알바 0 / 굽기 단계 스탯(화덕 아이콘) 1 / 레시피 2 / 설비 3 */
const iconIndex = (k: BuyKind): number => (k === 'alba' ? 0 : k === 'recipe' ? 2 : k === 'equip' ? 3 : 1);

/**
 * 투자 카드 1장. 같은 프리팹을 알바/화덕/레시피/설비 + '오늘의 투자' 슬롯에 재사용한다.
 * useTodayPick=true면 효율(회수 시간) 상위 pickSlot번째 항목을 자동으로 보여준다.
 */
@ccclass('InvestCardView')
export class InvestCardView extends Component {
    @property({ type: Enum(CardKind), tooltip: '고정 카드일 때 구매 종류' }) kind: CardKind = CardKind.Alba;
    @property({ tooltip: "'오늘의 투자' 슬롯이면 체크(kind 무시)" }) useTodayPick = false;
    @property({ type: CCInteger, tooltip: "오늘의 투자 슬롯 번호(0=1순위, 1=2순위)" }) pickSlot = 0;

    @property({ type: Button, tooltip: '구매 버튼(카드 전체 또는 가격 칩). 클릭 핸들러는 코드가 연결' }) buyButton: Button | null = null;
    @property({ type: Label }) titleLabel: Label | null = null;
    @property({ type: Label, tooltip: "'Lv 3 → 4' / '2 / 4명'" }) levelLabel: Label | null = null;
    @property({ type: Label, tooltip: "'굽는 속도 +20%'" }) effectLabel: Label | null = null;
    @property({ type: Label, tooltip: "'Lv 10에서 ×1.5'" }) noteLabel: Label | null = null;
    @property({ type: Label, tooltip: "'₩ 1,200' / '최대' / '잠금'" }) priceLabel: Label | null = null;
    @property({ type: Sprite, tooltip: '카드 배경 Sprite(상태별 교체). 선택' }) cardBg: Sprite | null = null;
    @property({ type: SpriteFrame, tooltip: 'ui_card_bg' }) bgNormal: SpriteFrame | null = null;
    @property({ type: SpriteFrame, tooltip: 'ui_card_locked' }) bgLocked: SpriteFrame | null = null;
    @property({ type: Sprite, tooltip: '아이콘 Sprite. 선택' }) iconSprite: Sprite | null = null;
    @property({ type: [SpriteFrame], tooltip: '[0]icon_staff [1]icon_fire [2]icon_recipe [3]icon_equip' }) iconFrames: SpriteFrame[] = [];
    @property({ type: Node, tooltip: '구매 가능일 때 깜빡이는 하이라이트(선택)' }) readyGlow: Node | null = null;
    @property({ type: Node, tooltip: '잠금/숨김 시 가릴 내용 루트(선택). 비우면 숨기지 않음' }) contentRoot: Node | null = null;

    private current: BuyKind = 'alba';
    private acc = 1; // 카드 갱신은 0.1초 간격(회수 시간 계산이 상태 복제를 하므로 프레임마다 돌리지 않는다)

    onEnable() {
        onClick(this.buyButton, this.onBuy, this);
        GameController.I?.events.on(GameEvents.PURCHASE, this.onPurchase, this);
    }

    onDisable() {
        offClick(this.buyButton, this.onBuy, this);
        GameController.I?.events.off(GameEvents.PURCHASE, this.onPurchase, this);
    }

    private resolveKind(): BuyKind | null {
        const g = GameController.I?.game;
        if (!g) return null;
        if (!this.useTodayPick) return KIND_OF[this.kind];
        return todaysPicks(g)[this.pickSlot] ?? null;
    }

    private onBuy() {
        const g = GameController.I?.game;
        if (g) g.buy(this.current);
    }

    private onPurchase(e: { kind: BuyKind }) {
        if (e.kind !== this.current || !this.node.activeInHierarchy) return;
        // 구매 바운스
        this.node.setScale(1.06, 1.06, 1);
        tween(this.node).to(0.15, { scale: new Vec3(1, 1, 1) }).start();
    }

    update(dt: number) {
        this.acc += dt;
        if (this.acc < 0.1) return;
        this.acc = 0;
        const g = GameController.I?.game;
        if (!g) return;
        const k = this.resolveKind();
        setActive(this.contentRoot, k !== null);
        if (k === null) return;
        this.current = k;
        const info = investInfo(g, k);
        setText(this.titleLabel, info.title);
        setText(this.levelLabel, info.levelText);
        setText(this.effectLabel, info.effectText);
        setText(this.noteLabel, info.noteText);
        setText(this.priceLabel, info.priceText);
        setFrame(this.cardBg, info.state === 'locked' ? this.bgLocked : this.bgNormal);
        setFrame(this.iconSprite, this.iconFrames[iconIndex(k)] ?? null);
        if (this.buyButton) this.buyButton.interactable = info.state === 'ok';
        setActive(this.readyGlow, info.state === 'ok');
    }
}
