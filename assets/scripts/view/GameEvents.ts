// GameController.events(EventTarget)로 흘러나오는 이벤트 이름. 페이로드는 core/Game.ts의 GameEvent.
export const GameEvents = {
    /** 컨트롤러 초기화 완료(payload 없음) */
    READY: 'game:ready',
    TAP: 'game:tap',                 // { amount, golden, step, combo, cycleDone }
    TAP_EARLY: 'game:tap-early',     // { step } 단계가 준비되기 전 탭
    COMBO_BREAK: 'game:combo-break',
    AUTO_BAKE: 'game:auto-bake',     // { batches, perBatch, golden }
    PURCHASE: 'game:purchase',       // { kind, cost }
    FP_UPGRADE: 'game:fp-upgrade',   // { kind, level }
    EXPAND: 'game:expand',           // { stage }
    REBIRTH: 'game:rebirth',         // { fpGained, rebirths }
    GOLDEN_START: 'game:golden-start',
    GOLDEN_END: 'game:golden-end',
    STATE_RESET: 'game:state-reset',
    /** 오프라인 정산 결과(OfflineReport). 시작 시 + 백그라운드 복귀 시 */
    OFFLINE: 'game:offline',
    /** 사운드 설정 변경(boolean) */
    SOUND_CHANGED: 'game:sound-changed',
} as const;
