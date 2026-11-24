# 붕어빵 주식회사 — 코드 인수인계

- 작업일: 2026-11-24 / 엔진: Cocos Creator 3.8.8 (TypeScript) / 짝 문서: `Prototype_Plan.md`, `Resource_Manifest.md`, `Resource_Handoff.md`
- 범위: 순수 core 로직 + Cocos UI 바인딩 컴포넌트 + node 테스트. **씬·프리팹·오브젝트 배치·PNG는 건드리지 않았다.** 다음 Codex 씬 세션이 아래 "Inspector 연결"만 따라 붙이면 된다.
- 저장은 `sys.localStorage` → 브라우저 `localStorage` 순으로 쓰고, 둘 다 안 되면 메모리만 쓴다. **SQLite는 어디에도 없다.**

## 1. 구현 파일

### core — `assets/scripts/core/` (`cc` import 없음, node에서 그대로 실행)

| 파일 | 역할 |
|---|---|
| `Num.ts` | `Num`(=number) 별칭, `formatNum`(한국식 표기), `formatDuration`, `cleanNum`. 큰 수를 BigNum으로 바꿀 때 이 파일만 교체 |
| `Balance.ts` | 단계 표(`STAGES`), 비용·배수·황금 불판·환생·오프라인·저장 상수(`B`), 프랜차이즈 업그레이드 표. **수치 조정은 여기만** |
| `GameState.ts` | 저장 구조 `GameState`, `createNewState`, `sanitizeState`(누락·NaN·음수·한도 초과 보정, `v` 불일치는 null) |
| `Economy.ts` | 공식 순수 함수: 화력·레시피·설비·프랜차이즈 배수, `bakeValue`, `autoPerSec`, 비용, 한도, 환생 FP, FP 소비 계산 |
| `Game.ts` | 규칙 본체 `Game`: `tap`, `tick(dt)`, `buy`, `expand`, `rebirth`, `buyFpUp`, `applyOffline`, 이벤트 `on()` |
| `Save.ts` | `KeyValueStorage` 인터페이스, `MemoryStorage`, `SaveManager`(저장·`.bak`·복구·저장 불가 처리) |
| `Session.ts` | `GameSession` = Game + SaveManager. `start()`(불러오기→오프라인 정산→저장), `resume()`(백그라운드 복귀 정산), `autoSave(dt)`(5초), 구매·확장·환생·FP 업그레이드 직후 저장, `resetAll()` |
| `Presenter.ts` | 화면 문구·상태를 만드는 순수 함수(투자 카드, 오늘의 투자, 진행도, 확장·프랜차이즈 띠, 안내 문구, 로드맵, FP 업그레이드) |
| `index.ts` | 위 전부 re-export |

### view — `assets/scripts/view/` (Cocos 컴포넌트, 한 파일 한 컴포넌트)

`GameController` · `HudView` · `TapButtonView` · `StoreSceneView` · `InvestCardView` · `ExpandButtonView` · `FranchiseBandView` · `TabBarView` · `HeadquartersView` · `SettingsPopupView` · `OfflinePopupView` · `ConfirmPopupView`(+ 공통 `PopupView`) · `ToastView` · `FloatTextSpawner` · `SfxPlayer`, 그리고 유틸 `UiUtil.ts`, 이벤트 이름 `GameEvents.ts`.

### 테스트 — `tests/` (Cocos가 컴파일하지 않는 프로젝트 루트)

`economy` / `rebirth` / `offline` / `save` / `presenter` / `bot` `.test.ts`, 봇 `bot.ts`, 확장자 없는 import를 `.ts`로 해석하는 `register.mjs`. 실행: `npm test`(= `node --no-warnings --import ./tests/register.mjs --test tests/`). Node 22.15+ 필요(타입 스트리핑 + `registerHooks`), 이 머신은 v26.12.1.

> core 코딩 규칙: node가 그대로 읽도록 **`enum`·파라미터 프로퍼티·데코레이터 금지**, 타입 import는 `import type`. 어기면 `npm test`가 깨진다.

## 2. 설계 결정 (질문 없이 확정)

| # | 결정 | 이유 |
|---|---|---|
| C1 | `fp` = 환생으로 번 **총 FP**. 업그레이드 구매는 보유(소비 가능) FP만 줄이고 영구 배수 `1+0.2×fp`는 줄지 않는다 | 기획의 "총 FP" 문구. 소비 시 배수가 줄면 업그레이드가 손해 |
| C2 | 설비 `equip`은 구매 **개수**. 다음 설비 비용은 `0.25 × (equip+2)단계 진입 비용`, 구매 가능 조건은 `equip < stage-1` | 저장 스키마가 `equip: n` 하나. 건너뛴 설비를 나중에 사도 가격은 해당 단계 기준 |
| C3 | 직접 굽기는 초당 8회 제한(토큰 버킷, 버스트 8). 초과 입력은 무시(`tap()`이 0 반환) | 기획 §4.1 "최대 8회/초" |
| C4 | 황금 불판 중에는 게이지를 0이 아니라 가득 찬 채로 보이고, 탭이 게이지를 올리지 않는다. 종료 시 0 | 재발동 방지, 쿨다운 없음(§4.4) |
| C5 | 오프라인 정산은 수익을 `money`·`runRevenue`·`totalRevenue`에 모두 더한다. 부재 30초 미만은 지급하되 팝업 생략 | 새로고침마다 팝업이 뜨지 않게 |
| C6 | 프랜차이즈 업그레이드 3종을 P1이지만 core에 구현(시작 알바 +1/Lv, 레시피 한도 +5/Lv, 오프라인 한도 +1h/Lv). 시작 알바가 단계 한도를 넘을 수 있어 알바 한도는 "구매 한도"로만 취급 | 구현 비용이 작고 환생 가치를 보여줌 |
| C7 | 숫자 표기는 100만 미만을 쉼표 정수(`12,480`), 100만~1억 미만은 `만`(소수 2자리), 이후 억·조·경, 1e20 이상 지수 | 기획 §4.9 문구("1,000 미만 정수")와 예시(`12,480`)가 충돌해 예시를 따름 |
| C8 | 큰 dt는 컨트롤러가 0.25초로 자르고, 숨김→복귀 시간은 `GameSession.resume()`이 오프라인으로 정산 | 탭 전환 후 폭주·이중 정산 방지 |
| C9 | 클릭 핸들러는 `Button` 필드에 노드만 연결하면 코드가 붙인다(Inspector ClickEvent 수동 설정 불필요). 굽기 버튼만 `TOUCH_START` | 연결 실수 감소, 굽기 반응성 |

## 3. Inspector 연결 (다음 Codex 씬 세션용)

### 3.1 공통 전제

- Canvas 1080×1920, 해상도 정책 FIT_WIDTH(기획 D1). 좌표는 `Resource_Manifest.md` §8.
- **`GameController`는 씬에 한 개**, Canvas 또는 빈 루트 노드에 붙인다. `@executionOrder(-100)`이라 다른 View보다 먼저 초기화된다. View는 `GameController.I`로 접근하므로 View가 있는 씬에 Controller가 없으면 아무것도 갱신되지 않는다.
- 모든 `@property`는 비어 있어도 예외 없이 동작한다(해당 표시만 생략). 툴팁에 연결 대상 에셋명을 적어 두었다.
- Sprite `SLICED` 보더는 `Resource_Handoff.md`·`Resource_Manifest.md` §5 표의 9s 값을 쓴다(`ui_progress_track/fill`은 좌우 6px, `ui_card_price_chip`은 상하 18px로 수정된 값).
- 한 파일 한 컴포넌트다. 에디터가 `.ts.meta`를 만들면 Add Component에서 이름으로 찾는다.

### 3.2 컴포넌트별 필드

| 컴포넌트 | 붙일 곳 | 연결할 필드 |
|---|---|---|
| `GameController` | 루트 1개 | `maxFrameDt`(기본 0.25). 연결할 노드 없음 |
| `HudView` | HUD 루트 | `moneyLabel` `incomeLabel` `stageLabel`(`n / 11 단계명`) `nextLabel` `percentLabel` `progressBar`(ProgressBar, 바 Sprite는 `ui_progress_fill`) `rollSpeed` |
| `TapButtonView` | 굽기 버튼 영역 | `tapNode`(터치 받을 노드, UITransform 필요) `buttonSprite` `normalFrame`(`ui_btn_primary`) `pressedFrame`(`ui_btn_primary_pressed`) `tapLabel` `hintLabel` `heatBar`(`ui_heat_track/fill`) `goldenRoot`(황금 중에만 켜질 노드) `goldenTimerLabel` |
| `StoreSceneView` | 가게 장면 루트 | `storeNodes[5]` / `streetNodes[5]`(순서=단계) `staffNodes[≤4]` + `staffSprites[≤4]` `staffIdle` `staffBake[2]` `albaBadge` + `albaBadgeLabel` `customerNodes[≤7]` `equipNodes[4]` `moldNarrow`/`moldWide` `breadSprites[]` `breadFrames[4]`(plain, red_bean, custard, golden 순) `flameSprite` + `flameFrames[4]` `goldenGlow` `expandFx` |
| `InvestCardView` | 카드 프리팹 | `kind`(알바/화덕/레시피/설비) 또는 `useTodayPick`+`pickSlot` `buyButton` `titleLabel` `levelLabel` `effectLabel` `noteLabel` `priceLabel` `cardBg`+`bgNormal`(`ui_card_bg`)/`bgLocked`(`ui_card_locked`) `iconSprite`+`iconFrames[4]`(staff, fire, recipe, equip) `readyGlow` `contentRoot` |
| `ExpandButtonView` | 점포 확장 버튼 | `button` `label` `readyGlow` `root` `buttonSprite` `enabledFrame` `disabledFrame` |
| `FranchiseBandView` | 프랜차이즈 띠 | `button` `label` `readyGlow` `lockIcon` |
| `TabBarView` | 탭바 | `tabButtons[3]` `pages[3]`(매장/성장/본사) `dots[3]` `dotOn` `dotOff` `underline` `startTab` |
| `HeadquartersView` | 본사 탭 | `fpLabel` `multLabel` `previewLabel` `rebirthButton` `fpUpNameLabels[3]` `fpUpLevelLabels[3]` `fpUpCostLabels[3]` `fpUpButtons[3]`(본사 교육/비법 레시피/야간 영업 순) `roadmapButtons[6]` `totalRevenueLabel` `runRevenueLabel` `playTimeLabel` `rebirthsLabel` |
| `SettingsPopupView` | 설정 팝업 | `root`(팝업 전체, 기본 비활성) `closeButton` `openButton`(헤더 설정 버튼) `soundButton` `soundIcon` `soundOnFrame`/`soundOffFrame` `saveStatusLabel` `warningLabel` `offlineLogLabel` `resetButton` |
| `OfflinePopupView` | 오프라인 팝업 | `root` `closeButton` `gainLabel` `timeLabel` `capLabel` `adButton`(코드가 `interactable=false`로 고정 — 광고 2배 모형) |
| `ConfirmPopupView` | 확인 팝업, **씬에 1개** | `root` `titleLabel` `bodyLabel` `confirmButton` `cancelButton` `closeButton`(취소와 같아도 됨). 환생·저장 초기화가 `ConfirmPopupView.I`를 쓴다 |
| `ToastView` | 토스트, **씬에 1개** | `label` `root`(기본 비활성) `duration`. 로드맵 카드 '준비 중'이 `ToastView.I`를 쓴다 |
| `FloatTextSpawner` | 부유 텍스트 부모 노드 | `floatTextPrefab` `tapPoint`(시안 (663,706) 부근 빈 노드) `autoPoint`(알바 머리 위) `autoInterval` `rise` `life` |
| `SfxPlayer` | 오디오 노드 | `source`(AudioSource) `tapClip` `buyClip` `expandClip` `goldenClip`. 클립 비어 있으면 무음 — 음원은 아직 없음 |

팝업의 `root`는 dim(`ui_dim`, 알파 60%)과 패널(`ui_popup_bg`)을 포함하는 노드로, 시작 상태는 비활성이어도 된다. `OfflinePopupView`는 `start()`에서 시작 시 정산 결과가 없으면 스스로 닫는다.

### 3.3 프리팹 요구

| 프리팹 | 내용 |
|---|---|
| 부유 텍스트 | Label 하나(루트 또는 자식). 코드가 `UIOpacity`를 자동 추가 |
| 투자 카드 | `ui_card_bg` 배경 + 아이콘 + 제목/레벨/효과/노트 Label + `ui_card_price_chip` + 가격 Label + Button. `InvestCardView`를 붙이고 `kind`만 바꿔 4장(성장 탭), `useTodayPick`으로 2장(매장 탭 '오늘의 투자') 재사용 |
| 로드맵 카드 | `ui_card_locked` + `bg_roadmap_silhouette_s6~s11` + Button. 별도 컴포넌트 없음(`HeadquartersView.roadmapButtons`에 연결) |
| 팝업 3종·토스트 | 위 표대로 루트 노드 구성. 프리팹으로 만들어도 씬 직접 배치도 무방 |

### 3.4 화면/탭 구성 권장

공통부(HUD, 가게 장면, 굽기 버튼, 탭바)는 항상 켜 두고, `TabBarView.pages`에는 탭별 하단 영역만 넣는다. 매장=오늘의 투자 카드 2장+확장 버튼+프랜차이즈 띠, 성장=카드 4장(알바/화덕/레시피/설비), 본사=`HeadquartersView` 영역. 시안 y좌표(매출 145, 진행도 316, 점포 500~1140, 굽기 1097, 카드 1410, 띠 1660, 탭 1800)를 따른다.

### 3.5 이벤트(코드 확장용)

`GameController.I.events`(cc `EventTarget`)로 core 이벤트가 `GameEvents.*` 이름으로 흐른다: `TAP{amount,golden}` `AUTO_BAKE{batches,perBatch,golden}` `PURCHASE{kind,cost}` `FP_UPGRADE` `EXPAND{stage}` `REBIRTH{fpGained,rebirths}` `GOLDEN_START/END` `STATE_RESET` `OFFLINE`(OfflineReport) `SOUND_CHANGED`. 씬 세션이 파티클·애니를 더 붙이려면 이 이벤트를 구독하면 된다(`onEnable`에서 `on`, `onDisable`에서 `off`).

## 4. 검증 결과

| 항목 | 방법 | 결과 |
|---|---|---|
| core·테스트 | `npm test` | **58개 통과 / 실패 0** (약 0.4초) |
| 타입 | TypeScript 5.6.3 `tsc --noEmit`, `strict: true`, Cocos `cc.d.ts` 선언 포함, `assets/scripts/**` 전체(core+view) | **오류 0** (프로젝트 `tsconfig`는 `strict: false`라 더 느슨함) |
| 실행 가능성 | core/session/presenter/봇을 node에서 실제 실행(저장·오프라인·환생 왕복 포함) | 통과 |
| Cocos 런타임 | 씬이 없어 **미검증** | 아래 §5 |

테스트가 검증하는 것(Prototype_Plan §6.1 대응): 포맷 / 공식(Lv 0·1·10·25 손계산, BV·AUTO) / 구매(자금 부족·한도·차감액=비용·이벤트) / 확장(비용 충족 시만, 5단계 불가) / 환생(미달 불가, FP, 초기화·유지 항목, 추천 표시, 업그레이드 효과) / 오프라인(음수→0, 한도, `AUTO×0.5×시간`, 야간 영업, 구매·확장 없음, 이중 정산 없음) / 저장(왕복 동일, 깨진 JSON→`.bak`, 둘 다 깨짐→새 게임, `v` 불일치, 누락·NaN·Infinity·음수 보정, 저장소 예외, `.bak` 보호, 초기화) / 황금 불판·불 게이지·탭 제한 / 봇.

### 봇 시뮬 결과 (§4.8, 탐욕 봇, dt 0.1초, 황금 불판 포함)

| 구간 | 탭 0.5/s | 기획 목표 | 탭 2/s | 기획 목표 |
|---|---|---|---|---|
| 5단계 도달 | 16.2분 | 16 | 6.2분 | 13 |
| 환생 목표 1회차 | 21.9분 | 22 | 8.9분 | 18 |
| 환생 목표 2회차 | 10.9분 | 11 | 4.5분 | 9 |

- **0.5탭/초는 목표의 ±3% 이내**로, 확장 비용을 조정하지 않고 §4.2 표 그대로 통과했다(테스트로 ±25% 고정).
- **2탭/초는 목표를 충족하지 못한다(약 절반).** 직접 굽기를 `BV`×1판으로 둔 기획 공식에서는 초반(알바 한도 2명, SP 낮음)에 초당 2탭이 알바 약 6명분이라 탭이 지배적이다. 0.5탭/초 목표와 2탭/초 목표를 확장 비용만으로 동시에 맞추는 것은 불가능하다(0.5를 맞추면 2가 어긋남). 공식은 건드리지 않는다는 기획 규칙을 지켜 **수치를 조정하지 않았다.** 해결 후보: 탭 수익을 `BV×0.5`로 낮추거나 탭 수익에 화덕 속도 비례 보정, 또는 §4.8의 2탭/초 목표를 9~11분 급으로 수정. 기획 담당 결정이 필요하다. 테스트는 2탭/초에 대해 완주 가능·0.5보다 빠름·2회차가 더 빠름만 고정했다.
- 환생 후 2회차가 약 절반으로 줄어든다(§1 검증 질문 ③ 대응).
- 봇은 FP 업그레이드를 사지 않는다(기획 목표 조건과 같음).

## 5. 남은 점

1. **Cocos 런타임 미검증.** 씬이 없어 컴포넌트가 실제로 도는 것은 확인하지 못했다. `tsc`(strict)로 타입과 `cc` API 사용은 확인했다. 씬 세션이 `GameController`를 올린 뒤 Preview에서 콘솔 에러 0, 탭→알바 고용→확장→환생 흐름, 새로고침 복원, localStorage 차단 시 '저장 불가' 표시(Plan §6.2)를 확인해야 한다.
2. **방치만으로는 시작할 수 없다.** 첫 알바를 탭으로 번 ₩25로 사는 설계라 탭 0으로는 1회차가 진행되지 않는다(테스트로 고정). 환생 후에는 시작 알바 1명이라 방치 진행이 된다. §4.4 "방치로도 환생까지"는 2회차부터 성립한다.
3. **2탭/초 목표 불일치**(위 §4). 기획 결정 대기.
4. **음원·폰트 없음.** `SfxPlayer`는 클립이 비면 무음이고, 사운드 설정은 저장·토글된다. 한글 폰트는 번들하지 않아 Label은 시스템 폰트로 나온다(`Resource_Handoff.md` §남은 점 3과 동일).
5. 환생 연출·스태프 응원 모션·치즈 붕어빵 등 P2는 없다. 점포 확장 연출은 `StoreSceneView`의 낙하+페이드와 선택 노드 `expandFx` 토글까지만 구현했다(컨페티 파티클은 씬에서 `expandFx` 아래에 배치).
6. 광고 2배 버튼은 모형(비활성 고정), 변조 방지 없음(기획 D6, §4.7).
7. 자동 황금 불판 설정, 오프라인 정산 기록 목록(누적 합계만 표시)은 만들지 않았다.
8. 컴포넌트는 매 프레임 상태를 읽는 폴링 방식이다. `InvestCardView`는 0.1초 간격으로만 갱신한다(회수 시간 계산이 상태를 복제하므로). 프로파일링은 하지 않았다.
9. 에디터가 연 상태여서 `assets/scripts/**/*.ts.meta` 일부가 이미 생성되어 있다. 나머지도 에디터가 자동 생성하며 `.meta`는 `.ts`와 함께 커밋한다.

## 6. 굽기 5단계 시스템 (2026-11-24 추가)

한 판이 **반죽 넣기 → 팥 넣기 → 굽기 → 뒤집기 → 완성**을 거친다. 단계마다 스탯(레벨)이 있고, 올리면 그 단계 시간이 줄어든다.

- **시간·비용**: 기본 0.6 / 0.6 / 1.2 / 0.3 / 0.3초(합 3초, `Balance.STEPS`). 단계 시간 = 기본 / `fireMult(Lv)`(기존 화력배수 공식 공용). 비용 = `40 × (단계 시간 비중) × 1.5^Lv` → 5단계를 같은 레벨로 올리는 총비용은 예전 화덕 비용과 같다. 굽기 단계 스탯은 기존 `fireLv`를 그대로 쓴다(저장 호환). 새 필드 `doughLv/fillingLv/flipLv/finishLv`는 없으면 0(저장 버전 `v` 그대로).
- **자동**: `AUTO = 알바 × BV / 한 판 시간(5단계 합)`. 스탯 0이면 예전과 같다. 구매 종류(`BuyKind`)에 `dough/filling/flip/finish` 추가, `'fire'`는 굽기 단계.
- **직접 굽기(A안)**: 탭 = 현재 단계 수행. 단계 시간이 차기 전 탭은 무시(`tap-early`). 준비 후 `comboGraceSec`(0.6초) 안에 이어 탭하면 콤보 +1, 늦으면 1부터. 탭당 수익 = `BV × (1 + 0.05×(콤보-1))`, 콤보 21에서 ×2 상한. 단계 진행·콤보는 비저장(`Game.stepIndex/stepElapsed/combo`).
- **불 게이지**: 유효한 탭마다 +8, 유지 시간 1.5초(단계 시간이 1.2초라 늘림).
- **화면**: `StepChipsView`(굽기 버튼 안 5칩+게이지, 코드 생성), `StepsPageView`('굽기' 탭 5행, 코드 생성), 탭바는 4탭(매장/굽기/성장/본사), 성장 탭의 화덕 카드는 숨김(굽기 탭으로 이동). 두 View는 UI를 런타임에 `Graphics`/`Label`로 만든다(`UiBuild.ts`).
- **봇 결과**(탐욕 봇, 단계 스탯 구매 포함): 0.5탭/초 → 5단계 14.0분, 환생 18.6분, 2회차 9.3분(목표 16/22/11, ±25% 이내). 숙련 봇(준비되면 즉시 탭) → 환생 5.2분. 2탭/초 시도 봇 8.2분.
- **씬 작업 팁**: 씬 파일을 직접 고치면 `asset-db refresh-asset` 후 리로드·빌드해야 반영된다. 에디터 MCP(`localhost:3000`)의 `builder command-build`는 **객체 옵션**일 때만 동작했다.

### 6.1 개정 (붕어빵 종류 스테이지·알바 종류·굽는 쾌감)

- **스테이지 = 붕어빵 종류**: `Balance.STAGES`에 `name`(기본/팥/슈크림/치즈/황금 붕어빵), `store`(점포 이름), `filling`(속 재료), `timeMult`(1/1.25/1.5/1.75/2)를 추가. `value`는 개정 전 값 × `timeMult`(8/75/720/7350/80000)라 초당 수익 비율은 그대로.
- **데미지 = 시간 단축**: `stepSec = baseSec × timeMult / m(Lv)`. 단계 이름은 `stepName`/`stepShort`(속 넣기는 '팥 넣기' 등으로 바뀜).
- **알바 종류**: `STEPS[].role`(반죽·앙금·화덕·뒤집기·포장 알바). 탭 이름 '알바', '굽기'→'알바 채용'(인원)과 구분. `Presenter.stepRows`가 `name`(알바 종류)과 `task`(맡은 단계)를 준다.
- **굽는 쾌감**: `BakeFxView`(입자·의성어·붕어빵 뜀·화면 흔들림, 코드 생성), `SfxPlayer`(단계별 소리 10종, `assets/audio/*.wav`). 합성기는 `tools/make_sfx.py`(순수 파이썬). 씬: `Canvas/BakeFx`(SceneArt 바로 뒤), `Audio/SfxPlayer`에 클립 연결.
- **스테이지 외형**: `StoreSceneView.STAGE_BREAD=[0,1,2,2,3]`, 4단계(치즈)는 슈크림 프레임 + 치즈색 tint.
- **검증**: 테스트 68개 통과(붕어빵 종류·알바 종류 케이스 추가), strict `tsc` 통과, 웹 빌드에서 문구·연출 확인. 소리는 합성 파일 생성과 클립 연결까지만 확인했고 **실제 청취는 하지 않았다**(브라우저 첫 터치 뒤 재생).
