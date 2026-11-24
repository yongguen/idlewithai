import { _decorator, Component, Graphics, Label, Node, tween, Vec3 } from 'cc';
import { STEPS } from '../core/Balance';
import { stepShort } from '../core/Economy';
import { GameController } from './GameController';
import { GameEvents } from './GameEvents';
import { C, fillRound, makeGraphics, makeLabel } from './UiBuild';

const { ccclass, property } = _decorator;

const CHIP_W = 176;
const CHIP_H = 36;
const GAP = 14;

/**
 * 굽기 버튼 안에 5단계 칩(반죽·팥·굽기·뒤집기·완성)을 코드로 만든다. 굽기 버튼 노드에 붙인다.
 * 이번 바퀴에서 끝낸 단계=황토, 지금 단계=주황 게이지가 차오르다 가득 차면 '탭!', 나머지=회색.
 */
@ccclass('StepChipsView')
export class StepChipsView extends Component {
    @property({ tooltip: '칩 줄의 로컬 y(굽기 버튼 중심 기준). 버튼 아래쪽에 둔다' }) rowY = -50;

    private chips: { root: Node; g: Graphics; label: Label }[] = [];
    private sigs: string[] = [];

    onLoad() {
        const total = STEPS.length * CHIP_W + (STEPS.length - 1) * GAP;
        STEPS.forEach((d, i) => {
            const x = -total / 2 + CHIP_W / 2 + i * (CHIP_W + GAP);
            const g = makeGraphics(`StepChip${i}`, this.node, x, this.rowY, CHIP_W, CHIP_H);
            const label = makeLabel('Text', g.node, `${i + 1} ${d.short}`, 0, 0, CHIP_W - 12, CHIP_H, 24, C.muted, true);
            this.chips.push({ root: g.node, g, label });
            this.sigs.push('');
        });
    }

    onEnable() { GameController.I?.events.on(GameEvents.TAP_EARLY, this.onEarly, this); }
    onDisable() { GameController.I?.events.off(GameEvents.TAP_EARLY, this.onEarly, this); }

    /** 너무 일찍 탭하면 지금 칩이 살짝 흔들린다 */
    private onEarly() {
        const gc = GameController.I;
        const chip = gc ? this.chips[gc.game.stepIndex] : null;
        if (!chip || !chip.root.isValid) return;
        const p = chip.root.position;
        tween(chip.root)
            .to(0.03, { position: new Vec3(p.x - 6, p.y, p.z) })
            .to(0.06, { position: new Vec3(p.x + 6, p.y, p.z) })
            .to(0.03, { position: new Vec3(p.x, p.y, p.z) })
            .start();
    }

    update() {
        const g = GameController.I?.game;
        if (!g) return;
        this.chips.forEach((c, i) => {
            const state = i < g.stepIndex ? 'done' : i === g.stepIndex ? 'cur' : 'wait';
            const ratio = state === 'cur' ? Math.round(g.stepReadyRatio() * 20) / 20 : state === 'done' ? 1 : 0;
            const sig = `${state}|${ratio}|${g.state.stage}`;
            if (sig === this.sigs[i]) return;
            this.sigs[i] = sig;
            const gr = c.g;
            gr.clear();
            const ready = state === 'cur' && ratio >= 1;
            fillRound(gr, state === 'done' ? C.tan : ready ? C.orange : C.track, CHIP_W, CHIP_H, 18);
            if (state === 'cur' && !ready && ratio > 0.05) {
                fillRound(gr, C.orange, Math.max(CHIP_H, CHIP_W * ratio), CHIP_H, 18, -CHIP_W / 2);
            }
            c.label.color = state === 'wait' ? C.muted : C.white;
            c.label.string = `${i + 1} ${stepShort(g.state, STEPS[i].kind)}${ready ? '!' : ''}`;
        });
    }
}
