import { _decorator, Button, Component, Label } from 'cc';
import { B } from '../core/Balance';
import { formatDuration, formatNum } from '../core/Num';
import { fpSummary, fpUpInfos, franchiseInfo, roadmapCards } from '../core/Presenter';
import type { FpUpKind } from '../core/Balance';
import { ConfirmPopupView } from './ConfirmPopupView';
import { GameController } from './GameController';
import { ToastView } from './ToastView';
import { onClick, offClick, setText } from './UiUtil';

const { ccclass, property } = _decorator;

const FP_KINDS: FpUpKind[] = ['train', 'recipe', 'night'];

/** 본사 탭: 프랜차이즈 환생 패널, 영구 업그레이드 3종, 로드맵 6~11 잠금 카드, 통계. */
@ccclass('HeadquartersView')
export class HeadquartersView extends Component {
    // 환생 패널
    @property({ type: Label, tooltip: "'보유 FP 3 / 총 5'" }) fpLabel: Label | null = null;
    @property({ type: Label, tooltip: "'판당 수익 ×2.00'" }) multLabel: Label | null = null;
    @property({ type: Label, tooltip: "'지금 개점하면 +N 포인트' 또는 조건 안내" }) previewLabel: Label | null = null;
    @property({ type: Button, tooltip: '프랜차이즈 개점(환생) 버튼 — 가능할 때만 활성' }) rebirthButton: Button | null = null;
    // 영구 업그레이드: 3개, 순서 = 본사 교육 / 비법 레시피 / 야간 영업
    @property({ type: [Label], tooltip: '업그레이드 이름+설명 Label 3개' }) fpUpNameLabels: Label[] = [];
    @property({ type: [Label], tooltip: "'Lv 1 / 5' Label 3개" }) fpUpLevelLabels: Label[] = [];
    @property({ type: [Label], tooltip: "'5 FP' / '최대' Label 3개" }) fpUpCostLabels: Label[] = [];
    @property({ type: [Button], tooltip: '구매 버튼 3개' }) fpUpButtons: Button[] = [];
    // 로드맵
    @property({ type: [Button], tooltip: '로드맵 잠금 카드 6개(6~11단계). 누르면 준비 중 토스트' }) roadmapButtons: Button[] = [];
    // 통계
    @property({ type: Label, tooltip: "'누적 매출 …'" }) totalRevenueLabel: Label | null = null;
    @property({ type: Label, tooltip: "'플레이 시간 hh:mm:ss'" }) playTimeLabel: Label | null = null;
    @property({ type: Label, tooltip: "'환생 n회'" }) rebirthsLabel: Label | null = null;
    @property({ type: Label, tooltip: "'이번 회차 누적 …'" }) runRevenueLabel: Label | null = null;

    private fpHandlers: Array<() => void> = [];
    private roadHandlers: Array<() => void> = [];

    onEnable() {
        onClick(this.rebirthButton, this.onRebirth, this);
        this.fpHandlers = FP_KINDS.map(k => () => GameController.I?.game.buyFpUp(k));
        this.fpUpButtons.forEach((b, i) => onClick(b, this.fpHandlers[i], this));
        const cards = roadmapCards();
        this.roadHandlers = cards.map(c => () => ToastView.I?.show(c.toast));
        this.roadmapButtons.forEach((b, i) => onClick(b, this.roadHandlers[i], this));
    }

    onDisable() {
        offClick(this.rebirthButton, this.onRebirth, this);
        this.fpUpButtons.forEach((b, i) => offClick(b, this.fpHandlers[i], this));
        this.roadmapButtons.forEach((b, i) => offClick(b, this.roadHandlers[i], this));
    }

    private onRebirth() {
        const g = GameController.I?.game;
        if (!g || !g.canRebirth()) return;
        ConfirmPopupView.I?.open(
            '프랜차이즈 개점',
            `지금 개점하면 +${g.rebirthPreview()} 포인트를 얻고\n매출·단계·알바·강화가 초기화됩니다.\n(영구 배수와 업그레이드는 유지)`,
            () => g.rebirth(),
        );
    }

    update() {
        const g = GameController.I?.game;
        if (!g) return;
        const s = g.state;
        const sum = fpSummary(g);
        setText(this.fpLabel, `보유 FP ${sum.available} / 총 ${sum.total}`);
        setText(this.multLabel, sum.multText);
        const f = franchiseInfo(g);
        setText(this.previewLabel,
            f.state === 'ready' ? `지금 개점하면 +${g.rebirthPreview()} 포인트${f.recommended ? ' (추천)' : ''}`
                : f.state === 'locked' ? '대형가게에 도달하면 개점할 수 있어요'
                    : `이번 회차 누적 ${formatNum(s.runRevenue)} / ${formatNum(B.rebirthTarget)}`);
        if (this.rebirthButton) this.rebirthButton.interactable = f.enabled;

        fpUpInfos(g).forEach((info, i) => {
            setText(this.fpUpNameLabels[i] ?? null, `${info.name} — ${info.desc}`);
            setText(this.fpUpLevelLabels[i] ?? null, info.levelText);
            setText(this.fpUpCostLabels[i] ?? null, info.costText);
            const b = this.fpUpButtons[i];
            if (b) b.interactable = info.canBuy;
        });

        setText(this.totalRevenueLabel, `누적 매출 ₩ ${formatNum(s.totalRevenue)}`);
        setText(this.runRevenueLabel, `이번 회차 ₩ ${formatNum(s.runRevenue)}`);
        setText(this.playTimeLabel, `플레이 시간 ${formatDuration(s.playSec)}`);
        setText(this.rebirthsLabel, `환생 ${s.rebirths}회`);
    }
}
