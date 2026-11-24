import { _decorator, Color, Component, Graphics, Node, tween, UIOpacity, Vec3 } from 'cc';
import type { StepKind } from '../core/Balance';
import { GameController } from './GameController';
import { GameEvents } from './GameEvents';
import { C, makeLabel, makeNode } from './UiBuild';

const { ccclass, property } = _decorator;

interface Particle {
    node: Node;
    op: UIOpacity;
    vx: number; vy: number; g: number;
    age: number; life: number;
    spin: number; s0: number; s1: number;
}

const WORD: Record<StepKind, string> = { dough: '푹!', filling: '쏙!', bake: '지글지글', flip: '휙!', finish: '완성!' };
/** 속 재료 색(스테이지 1~5): 설탕·팥·슈크림·치즈·황금 앙금 */
const FILLING = [new Color(255, 245, 210, 255), new Color(150, 55, 55, 255), new Color(255, 218, 80, 255), new Color(255, 178, 50, 255), new Color(255, 205, 60, 255)];
const SPARK = new Color(255, 150, 50, 255);
const STAR = new Color(255, 214, 70, 255);
const FLOUR = new Color(255, 240, 205, 255);

/**
 * 굽는 쾌감 연출. 탭마다 단계별 입자(반죽 가루·속 재료 방울·불똥·휙 줄기·금별)와 의성어를 틀 위에 터뜨리고,
 * 완성 때 붕어빵이 차례로 튀어 오르며 화면이 살짝 흔들린다. 콤보가 높을수록 입자와 글자가 커진다.
 * 씬에는 빈 노드 하나(Canvas 아래, SceneArt 바로 뒤)에 붙이면 된다. 모든 입자는 코드로 만든다.
 */
@ccclass('BakeFxView')
export class BakeFxView extends Component {
    @property({ tooltip: '입자가 터지는 위치(Canvas 중심 기준 로컬 좌표). 틀 위: 시안 (625, 850) → (85, 110)' }) originX = 85;
    @property({ tooltip: '입자가 터지는 위치 y' }) originY = 118;

    private parts: Particle[] = [];
    private art: Node | null = null;
    private artBase = new Vec3();
    private breads: Node[] = [];
    private breadBase: Vec3[] = [];
    private shaking = false;

    onLoad() {
        const canvas = this.node.parent;
        this.art = canvas?.getChildByName('SceneArt') ?? null;
        if (this.art) {
            this.artBase = this.art.position.clone();
            for (let i = 0; i < 4; i++) {
                const b = this.art.getChildByName(`Bread${i}`);
                if (b) { this.breads.push(b); this.breadBase.push(b.position.clone()); }
            }
        }
    }

    onEnable() {
        const ev = GameController.I?.events;
        ev?.on(GameEvents.TAP, this.onTap, this);
        ev?.on(GameEvents.GOLDEN_START, this.onGolden, this);
    }
    onDisable() {
        const ev = GameController.I?.events;
        ev?.off(GameEvents.TAP, this.onTap, this);
        ev?.off(GameEvents.GOLDEN_START, this.onGolden, this);
    }

    private onTap(e: { step: StepKind; combo: number; cycleDone: boolean; golden: boolean }) {
        const stage = GameController.I?.game.state.stage ?? 1;
        const big = Math.min(1 + e.combo * 0.06, 2.2); // 콤보가 높을수록 커진다
        const n = (k: number) => Math.round(k * big);
        switch (e.step) {
            case 'dough': this.burst(FLOUR, n(7), 90, -60, 16, 0.8, 0.55, false); this.hop(0, 8); break;
            case 'filling': this.burst(FILLING[stage - 1], n(8), 60, 520, 12, 0.5, 0.6, true); this.hop(1, 8); break;
            case 'bake': this.burst(SPARK, n(12), 200, 520, 9, 0.5, 0.75, false); this.hop(2, 10); break;
            case 'flip': this.streaks(n(5)); this.hop(3, 34); this.hop(1, 34); this.hop(0, 34); this.hop(2, 34); break;
            case 'finish':
                this.star(n(16), 260);
                this.breads.forEach((_, i) => this.scheduleOnce(() => this.hop(i, 46), i * 0.05));
                this.shake(e.combo >= 10 ? 14 : 8);
                break;
        }
        this.word(WORD[e.step], e.step === 'finish' ? 84 : 62, e.step === 'finish' ? C.orangeDeep : C.brown);
        if (e.combo >= 5 && e.combo % 5 === 0) this.word(`콤보 ${e.combo}!`, 70 + Math.min(e.combo, 20) * 2, C.orange, 90);
    }

    private onGolden() {
        this.star(30, 360);
        this.shake(16);
        this.word('황금 불판!', 96, C.orange, 60);
    }

    // ── 입자 ──
    private spawn(color: Color, size: number, star = false): Particle {
        const node = makeNode('fx', this.node, this.originX, this.originY, size * 2, size * 2);
        const g = node.addComponent(Graphics);
        g.fillColor = color;
        if (star) {
            const pts = 5;
            for (let i = 0; i < pts * 2; i++) {
                const r = i % 2 === 0 ? size : size * 0.45;
                const a = (Math.PI * i) / pts - Math.PI / 2;
                if (i === 0) g.moveTo(Math.cos(a) * r, Math.sin(a) * r); else g.lineTo(Math.cos(a) * r, Math.sin(a) * r);
            }
            g.close();
        } else {
            g.circle(0, 0, size);
        }
        g.fill();
        const op = node.addComponent(UIOpacity);
        const p: Particle = { node, op, vx: 0, vy: 0, g: 0, age: 0, life: 0.6, spin: 0, s0: 1, s1: 1 };
        this.parts.push(p);
        return p;
    }

    /** 동그란 입자 터뜨리기. spread: 퍼짐 속도, grav: 중력(+면 아래로), up: 위에서 떨어뜨릴지 */
    private burst(color: Color, n: number, spread: number, grav: number, size: number, s0: number, life: number, fromAbove: boolean) {
        for (let i = 0; i < n; i++) {
            const p = this.spawn(color, size * 1.5 * (0.7 + Math.random() * 0.6));
            const a = fromAbove ? -Math.PI / 2 + (Math.random() - 0.5) * 0.9 : Math.random() * Math.PI * 2;
            const sp = spread * (0.4 + Math.random() * 0.8);
            if (fromAbove) p.node.setPosition(this.originX + (Math.random() - 0.5) * 90, this.originY + 90, 0);
            p.vx = fromAbove ? (Math.random() - 0.5) * 60 : Math.cos(a) * sp;
            p.vy = fromAbove ? -120 - Math.random() * 80 : Math.sin(a) * sp + 60;
            p.g = -grav * (fromAbove ? 0.6 : 1);
            p.life = life * (0.7 + Math.random() * 0.5);
            p.s0 = s0; p.s1 = 1.0;
        }
    }
    private star(n: number, spread: number) {
        for (let i = 0; i < n; i++) {
            const p = this.spawn(STAR, 20 + Math.random() * 14, true);
            const a = Math.random() * Math.PI * 2, sp = spread * (0.35 + Math.random() * 0.8);
            p.vx = Math.cos(a) * sp; p.vy = Math.sin(a) * sp + 160; p.g = -520;
            p.life = 0.7 + Math.random() * 0.5; p.spin = (Math.random() - 0.5) * 540; p.s0 = 0.4; p.s1 = 1.1;
        }
    }
    private streaks(n: number) {
        for (let i = 0; i < n; i++) {
            const p = this.spawn(Color.WHITE, 8 + Math.random() * 6);
            p.node.setPosition(this.originX - 130 + i * 55, this.originY + 20, 0);
            p.vx = 130 + Math.random() * 90; p.vy = 120 + Math.random() * 60; p.g = -300;
            p.life = 0.4; p.s0 = 1.4; p.s1 = 0.3;
        }
    }

    // ── 글자·붕어빵 뜀·흔들림 ──
    private word(text: string, size: number, color: Color, dy = 0) {
        const lbl = makeLabel('word', this.node, text, this.originX + (Math.random() - 0.5) * 60, this.originY + 80 + dy, 420, size * 1.4, size, color, true);
        const op = lbl.node.addComponent(UIOpacity);
        lbl.node.setScale(0.5, 0.5, 1);
        tween(lbl.node).to(0.12, { scale: new Vec3(1.15, 1.15, 1) }, { easing: 'backOut' }).to(0.08, { scale: Vec3.ONE })
            .by(0.5, { position: new Vec3(0, 70, 0) }).call(() => lbl.node.destroy()).start();
        tween(op).delay(0.3).to(0.35, { opacity: 0 }).start();
    }
    private hop(i: number, h: number) {
        const b = this.breads[i];
        if (!b || !b.isValid) return;
        const base = this.breadBase[i];
        tween(b).to(0.07, { position: new Vec3(base.x, base.y + h, base.z) }, { easing: 'quadOut' })
            .to(0.16, { position: base.clone() }, { easing: 'bounceOut' }).start();
    }
    private shake(amp: number) {
        const art = this.art;
        if (!art || !art.isValid || this.shaking) return;
        this.shaking = true;
        const b = this.artBase;
        tween(art)
            .to(0.04, { position: new Vec3(b.x + amp, b.y - amp * 0.4, b.z) })
            .to(0.05, { position: new Vec3(b.x - amp, b.y + amp * 0.4, b.z) })
            .to(0.05, { position: new Vec3(b.x + amp * 0.5, b.y, b.z) })
            .to(0.05, { position: b.clone() })
            .call(() => { this.shaking = false; }).start();
    }

    update(dt: number) {
        for (let i = this.parts.length - 1; i >= 0; i--) {
            const p = this.parts[i];
            p.age += dt;
            const k = p.age / p.life;
            if (k >= 1 || !p.node.isValid) {
                if (p.node.isValid) p.node.destroy();
                this.parts.splice(i, 1);
                continue;
            }
            p.vy += p.g * dt;
            const pos = p.node.position;
            p.node.setPosition(pos.x + p.vx * dt, pos.y + p.vy * dt, 0);
            const s = p.s0 + (p.s1 - p.s0) * Math.min(1, k * 3);
            p.node.setScale(s, s, 1);
            if (p.spin) p.node.angle += p.spin * dt;
            p.op.opacity = 255 * (k < 0.55 ? 1 : 1 - (k - 0.55) / 0.45);
        }
    }
}
