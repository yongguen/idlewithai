import { _decorator, Component, Label, ProgressBar } from 'cc';
import { formatNum } from '../core/Num';
import { progressInfo } from '../core/Presenter';
import { GameController } from './GameController';
import { setProgress, setText } from './UiUtil';

const { ccclass, property } = _decorator;

/** 헤더·매출 카드·진행도 바. 매출 숫자는 부드럽게 롤링한다. */
@ccclass('HudView')
export class HudView extends Component {
    @property({ type: Label, tooltip: '현재 매출 (예: 12,480)' }) moneyLabel: Label | null = null;
    @property({ type: Label, tooltip: '초당 매출 (예: +1,240/초)' }) incomeLabel: Label | null = null;
    @property({ type: Label, tooltip: "'n / 11 단계명'" }) stageLabel: Label | null = null;
    @property({ type: Label, tooltip: "'다음: 포장마차'" }) nextLabel: Label | null = null;
    @property({ type: Label, tooltip: '진행 % ' }) percentLabel: Label | null = null;
    @property({ type: ProgressBar, tooltip: 'ui_progress_track/fill을 쓴 진행도 바' }) progressBar: ProgressBar | null = null;
    @property({ tooltip: '롤링 속도(클수록 빠름)' }) rollSpeed = 10;

    private shown = 0;

    update(dt: number) {
        const gc = GameController.I;
        if (!gc) return;
        const g = gc.game;
        const target = g.state.money;
        // 큰 차이도 한 프레임에 비율로 따라간다. 거의 같으면 스냅.
        this.shown += (target - this.shown) * Math.min(1, dt * this.rollSpeed);
        if (Math.abs(target - this.shown) < Math.max(0.5, target * 1e-6)) this.shown = target;
        setText(this.moneyLabel, '₩ ' + formatNum(this.shown));
        setText(this.incomeLabel, `+${formatNum(g.incomePerSec())}/초`);
        const p = progressInfo(g);
        setText(this.stageLabel, p.title);
        setText(this.nextLabel, p.nextText);
        setText(this.percentLabel, p.percentText);
        setProgress(this.progressBar, p.ratio);
    }
}
