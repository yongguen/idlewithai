import { _decorator, Color, Component, Label, Node, Sprite, SpriteFrame, tween, UIOpacity } from 'cc';
import { GameController } from './GameController';
import { GameEvents } from './GameEvents';
import { setActive, setFrame, setText } from './UiUtil';

const { ccclass, property } = _decorator;

/** 스테이지(1~5) → breadFrames 번호(plain 0 / red_bean 1 / custard 2 / golden 3) */
const STAGE_BREAD = [0, 1, 2, 2, 3];
const CHEESE = new Color(255, 200, 120, 255);

/**
 * 가게 장면(y 500~1140). 단계별 점포·거리 교체, 알바·손님 수, 설비, 붕어빵 변형, 불꽃 프레임, 황금 오라.
 * 모든 단계가 같은 슬롯 레이아웃을 쓴다. 노드는 씬에서 미리 배치하고 이 컴포넌트는 active만 토글한다.
 */
@ccclass('StoreSceneView')
export class StoreSceneView extends Component {
    @property({ type: [Node], tooltip: '단계 1~5 점포 노드(store_s1~s5). 순서 = 단계' }) storeNodes: Node[] = [];
    @property({ type: [Node], tooltip: '단계 1~5 거리 노드(bg_street_s1~s5). 순서 = 단계' }) streetNodes: Node[] = [];
    @property({ type: [Node], tooltip: '알바 슬롯 최대 4개(char_staff). 단계의 표시 인원만큼 켜짐' }) staffNodes: Node[] = [];
    @property({ type: [Sprite], tooltip: '알바 슬롯의 Sprite(굽기 동작 프레임 교체용). staffNodes와 같은 순서' }) staffSprites: Sprite[] = [];
    @property({ type: SpriteFrame, tooltip: 'char_staff_idle' }) staffIdle: SpriteFrame | null = null;
    @property({ type: [SpriteFrame], tooltip: 'char_staff_bake_00, _01' }) staffBake: SpriteFrame[] = [];
    @property({ type: Node, tooltip: '알바 수가 표시 한도를 넘을 때 켜지는 배지(char_staff_badge)' }) albaBadge: Node | null = null;
    @property({ type: Label, tooltip: '배지 안 Label(예: ×6)' }) albaBadgeLabel: Label | null = null;
    @property({ type: [Node], tooltip: '손님 슬롯 최대 7개. 단계의 손님 수만큼 켜짐' }) customerNodes: Node[] = [];
    @property({ type: [Node], tooltip: '설비 4개(자동 뒤집개/디스펜서/컨베이어/포장 라인). 구매 수만큼 켜짐' }) equipNodes: Node[] = [];
    @property({ type: Node, tooltip: '틀 판 2칸(equip_mold_plate) — 1~2단계' }) moldNarrow: Node | null = null;
    @property({ type: Node, tooltip: '틀 판 4칸(equip_mold_plate_wide) — 3~5단계' }) moldWide: Node | null = null;
    @property({ type: [Sprite], tooltip: '틀 위 완성 붕어빵 Sprite들(레시피 단계·황금 불판에 따라 교체)' }) breadSprites: Sprite[] = [];
    @property({ type: [SpriteFrame], tooltip: '[0]plain [1]red_bean [2]custard [3]golden 순서로 bread_*_done' }) breadFrames: SpriteFrame[] = [];
    @property({ type: Sprite, tooltip: '화덕 불꽃 Sprite(fx_flame)' }) flameSprite: Sprite | null = null;
    @property({ type: [SpriteFrame], tooltip: 'fx_flame_00~03' }) flameFrames: SpriteFrame[] = [];
    @property({ type: Node, tooltip: '황금 불판 중에만 켜지는 오라(fx_golden_glow)' }) goldenGlow: Node | null = null;
    @property({ type: Node, tooltip: '점포 확장 연출 시 1.2초 켜지는 효과 노드(컨페티 등). 선택' }) expandFx: Node | null = null;

    private sig = '';
    private t = 0;

    onEnable() {
        GameController.I?.events.on(GameEvents.EXPAND, this.onExpand, this);
        GameController.I?.events.on(GameEvents.REBIRTH, this.onRebirth, this);
    }

    onDisable() {
        GameController.I?.events.off(GameEvents.EXPAND, this.onExpand, this);
        GameController.I?.events.off(GameEvents.REBIRTH, this.onRebirth, this);
    }

    private onRebirth() { this.sig = ''; }

    /** 확장 연출: 새 점포가 위에서 내려오며 페이드 인(0.8~1.2초, 암전 없음) */
    private onExpand(e: { stage: number }) {
        const node = this.storeNodes[e.stage - 1];
        if (node) {
            const op = node.getComponent(UIOpacity) ?? node.addComponent(UIOpacity);
            const p = node.position.clone();
            node.setPosition(p.x, p.y + 160, p.z);
            op.opacity = 0;
            tween(node).to(0.9, { position: p }, { easing: 'bounceOut' }).start();
            tween(op).to(0.6, { opacity: 255 }).start();
        }
        if (this.expandFx) {
            this.expandFx.active = true;
            this.scheduleOnce(() => { if (this.expandFx) this.expandFx.active = false; }, 1.2);
        }
    }

    update(dt: number) {
        const gc = GameController.I;
        if (!gc) return;
        const g = gc.game;
        const s = g.state;
        const def = g.stage;
        this.t += dt;

        // 스테이지 = 붕어빵 종류: 기본 / 팥 / 슈크림 / 치즈(슈크림 틀에 치즈색) / 황금. 황금 불판 중에는 황금 붕어빵
        const breadIdx = g.isGolden ? 3 : STAGE_BREAD[s.stage - 1];
        const sig = `${s.stage}|${s.alba}|${s.equip}|${breadIdx}`;
        if (sig !== this.sig) {
            this.sig = sig;
            this.storeNodes.forEach((n, i) => setActive(n, i === s.stage - 1));
            this.streetNodes.forEach((n, i) => setActive(n, i === s.stage - 1));
            const shown = Math.min(s.alba, def.albaShown, this.staffNodes.length);
            this.staffNodes.forEach((n, i) => setActive(n, i < shown));
            const over = s.alba > def.albaShown && def.albaShown > 0;
            setActive(this.albaBadge, over);
            setText(this.albaBadgeLabel, `×${s.alba}`);
            this.customerNodes.forEach((n, i) => setActive(n, i < def.customers));
            this.equipNodes.forEach((n, i) => setActive(n, i < s.equip));
            setActive(this.moldNarrow, s.stage <= 2);
            setActive(this.moldWide, s.stage > 2);
            const f = this.breadFrames[breadIdx] ?? null;
            const tint = !g.isGolden && s.stage === 4 ? CHEESE : Color.WHITE;
            this.breadSprites.forEach(b => { setFrame(b, f); if (b) b.color = tint; });
        }
        setActive(this.goldenGlow, g.isGolden);

        // 프레임 애니: 불꽃 8fps, 알바 굽기 4fps(알바가 있을 때만)
        if (this.flameSprite && this.flameFrames.length) {
            setFrame(this.flameSprite, this.flameFrames[Math.floor(this.t * 8) % this.flameFrames.length]);
        }
        if (s.alba > 0 && this.staffBake.length) {
            const fr = this.staffBake[Math.floor(this.t * 4) % this.staffBake.length];
            this.staffSprites.forEach(sp => setFrame(sp, fr));
        } else {
            this.staffSprites.forEach(sp => setFrame(sp, this.staffIdle));
        }
    }
}
