import { _decorator, Component, instantiate, Label, Node, Prefab, tween, UIOpacity, Vec3 } from 'cc';
import { formatNum } from '../core/Num';
import { GameController } from './GameController';
import { GameEvents } from './GameEvents';

const { ccclass, property } = _decorator;

/** '+N' 부유 텍스트. 프리팹을 풀링해 재사용한다. 탭/자동 굽기/구매 이벤트를 직접 듣는다. */
@ccclass('FloatTextSpawner')
export class FloatTextSpawner extends Component {
    @property({ type: Prefab, tooltip: 'Label이 루트이거나 자식에 있는 부유 텍스트 프리팹' }) floatTextPrefab: Prefab | null = null;
    @property({ type: Node, tooltip: '탭 +N이 뜨는 기준 위치(시안 (663,706) 부근 빈 노드)' }) tapPoint: Node | null = null;
    @property({ type: Node, tooltip: '알바 자동 굽기 +N이 뜨는 기준 위치(알바 머리 위). 비우면 tapPoint' }) autoPoint: Node | null = null;
    @property({ tooltip: '자동 굽기 팝업 최소 간격(초)' }) autoInterval = 0.5;
    @property({ tooltip: '떠오르는 높이(px)' }) rise = 120;
    @property({ tooltip: '지속 시간(초)' }) life = 0.9;

    private pool: Node[] = [];
    private autoCool = 0;

    onEnable() {
        const ev = GameController.I?.events;
        ev?.on(GameEvents.TAP, this.onTap, this);
        ev?.on(GameEvents.AUTO_BAKE, this.onAuto, this);
    }

    onDisable() {
        const ev = GameController.I?.events;
        ev?.off(GameEvents.TAP, this.onTap, this);
        ev?.off(GameEvents.AUTO_BAKE, this.onAuto, this);
    }

    update(dt: number) {
        if (this.autoCool > 0) this.autoCool -= dt;
    }

    private onTap(e: { amount: number; golden: boolean }) {
        if (e.amount > 0) this.spawn(`+${formatNum(e.amount)}`, this.tapPoint, 40);
    }

    private onAuto(e: { perBatch: number; batches: number }) {
        if (this.autoCool > 0) return;
        this.autoCool = this.autoInterval;
        this.spawn(`+${formatNum(e.perBatch * e.batches)}`, this.autoPoint ?? this.tapPoint, 20);
    }

    spawn(text: string, at: Node | null, jitter: number) {
        if (!this.floatTextPrefab || !at) return;
        const node = this.pool.pop() ?? instantiate(this.floatTextPrefab);
        node.parent = this.node;
        node.active = true;
        const label = node.getComponent(Label) ?? node.getComponentInChildren(Label);
        if (label) label.string = text;
        const op = node.getComponent(UIOpacity) ?? node.addComponent(UIOpacity);
        op.opacity = 255;
        const p = at.position;
        node.setPosition(p.x + (Math.random() - 0.5) * 2 * jitter, p.y, p.z);
        tween(node)
            .by(this.life, { position: new Vec3(0, this.rise, 0) })
            .call(() => { node.active = false; this.pool.push(node); })
            .start();
        tween(op).delay(this.life * 0.4).to(this.life * 0.6, { opacity: 0 }).start();
    }
}
