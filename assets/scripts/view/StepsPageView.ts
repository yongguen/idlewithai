import { _decorator, Component, Graphics, HorizontalTextAlignment, Label, Node } from 'cc';
import { STEPS } from '../core/Balance';
import { cycleText, stepRows } from '../core/Presenter';
import type { StepRowInfo } from '../core/Presenter';
import { GameController } from './GameController';
import { GameEvents } from './GameEvents';
import { C, fillRound, makeGraphics, makeLabel, makeNode } from './UiBuild';

const { ccclass } = _decorator;

const ROW_H = 58;
const ROW_PITCH = 66;
const ROW_W = 972;

interface Row {
    g: Graphics;
    name: Label;
    level: Label;
    time: Label;
    chipG: Graphics;
    price: Label;
    tag: Label;
    sig: string;
}

/**
 * '알바' 탭 페이지(알바 종류 5명 × 담당 단계의 숙련도)를 코드로 만든다. Pages 아래 빈 노드에 붙인다(원점=화면 중앙, 1080×1920 디자인 좌표).
 * 행마다 단계 이름·레벨·시간(현재→다음)·가격 칩. 가장 느린 단계에 '병목' 표시. 가격 칩을 누르면 구매.
 */
@ccclass('StepsPageView')
export class StepsPageView extends Component {
    private rows: Row[] = [];
    private header!: Label;
    private sub!: Label;
    private acc = 1;

    private lx = (x: number) => x - 540;
    private ly = (y: number) => 960 - y;

    onLoad() {
        this.header = makeLabel('Header', this.node, '', 0, this.ly(1422), 900, 40, 30, C.brown, true);
        this.sub = makeLabel('Sub', this.node, '알바가 숙련될수록 맡은 단계의 굽는 시간이 줄어요', 0, this.ly(1452), 900, 28, 22, C.muted);
        STEPS.forEach((d, i) => {
            const y = this.ly(1500 + i * ROW_PITCH);
            const g = makeGraphics(`StepRow${i}`, this.node, 0, y, ROW_W, ROW_H);
            const L = HorizontalTextAlignment.LEFT;
            makeLabel('Idx', g.node, `${i + 1}`, -ROW_W / 2 + 36, 0, 40, 40, 30, C.orangeDeep, true);
            const name = makeLabel('Name', g.node, d.name, -ROW_W / 2 + 70 + 125, 8, 250, 30, 28, C.brown, true, L); // 왼쪽 정렬: 박스 중심 = 시작점 + 폭/2
            const level = makeLabel('Level', g.node, '', -ROW_W / 2 + 70 + 125, -17, 250, 24, 21, C.muted, false, L);
            const time = makeLabel('Time', g.node, '', 60, 0, 330, 36, 26, C.brown, true);
            const tag = makeLabel('Tag', g.node, '', -130, 0, 70, 24, 21, C.orangeDeep, true);
            const chip = makeNode('Buy', g.node, ROW_W / 2 - 130, 0, 220, 46);
            const chipG = chip.addComponent(Graphics);
            const price = makeLabel('Price', chip, '', 0, 0, 200, 40, 26, C.white, true);
            chip.on(Node.EventType.TOUCH_END, () => GameController.I?.game.buy(STEPS[i].kind === 'bake' ? 'fire' : STEPS[i].kind), this);
            this.rows.push({ g, name, level, time, chipG, price, tag, sig: '' });
        });
    }

    onEnable() { GameController.I?.events.on(GameEvents.PURCHASE, this.onChange, this); this.acc = 1; }
    onDisable() { GameController.I?.events.off(GameEvents.PURCHASE, this.onChange, this); }
    private onChange() { this.acc = 1; }

    update(dt: number) {
        this.acc += dt;
        if (this.acc < 0.1) return;
        this.acc = 0;
        const g = GameController.I?.game;
        if (!g) return;
        const infos = stepRows(g);
        const slow = infos.find(r => r.bottleneck);
        const head = `${cycleText(g)}${slow ? ` · 병목: ${slow.name}` : ''}`;
        if (this.header.string !== head) this.header.string = head;
        infos.forEach((info, i) => this.draw(this.rows[i], info));
    }

    private draw(r: Row, info: StepRowInfo) {
        const sig = `${info.name}|${info.task}|${info.levelText}|${info.timeText}|${info.priceText}|${info.state}|${info.bottleneck}`;
        if (sig === r.sig) return;
        r.sig = sig;
        r.name.string = info.name;
        r.level.string = `${info.task} · ${info.levelText}`;
        r.time.string = info.timeText;
        r.price.string = info.priceText;
        r.tag.string = info.bottleneck ? '병목' : '';
        r.g.clear();
        fillRound(r.g, info.bottleneck ? C.orange : C.track, ROW_W, ROW_H, 16);
        fillRound(r.g, C.card, ROW_W - 6, ROW_H - 6, 14);
        r.chipG.clear();
        const buyable = info.state === 'ok';
        fillRound(r.chipG, buyable ? C.orange : C.track, 220, 46, 23);
        r.price.color = buyable ? C.white : C.muted;
    }
}
