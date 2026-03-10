# Spec: 子ども感染症レーダー モバイルアプリ

## Overview
保護者が子供の感染症リスクを素早く確認できるモバイルアプリ。毎朝10秒で平常/注意を判断でき、保育園からの通知時には3分以内に登園判断の材料を提供する。

## Requirements

### Functional Requirements
1. **初回プロフィール設定**
   - 子供の年齢選択（0-1歳/2-3歳/4-6歳/7歳以上）
   - 居住地区・市の選択（ドロップダウン）
   - localStorageに保存（サーバー送信なし）
   - 30秒以内に完了

2. **毎朝のルーティンチェック**
   - アプリ起動時に即座に診断結果表示
   - ✅平常 または ⚠️注意 の2段階表示
   - 平常時は10秒以内に判断完了
   - 注意時はNovaの診断詳細を表示

3. **保育園通知時の詳細確認**
   - Novaによる具体的なリスク診断
   - 地域の流行状況マップ表示
   - 具体的な予防アクション提示
   - 3分以内に登園判断材料を提供

4. **異常検知の先行通知（将来機能）**
   - 公式データより早い段階での検知
   - プッシュ通知による早期アラート

### Non-Functional Requirements
- **パフォーマンス**: 起動から診断表示まで3秒以内
- **プライバシー**: 個人情報はデバイスローカルのみ保存
- **UX**: 不安を煽らない言葉選び
- **免責**: 医療診断ではないことを明示

### Out of Scope
- 症状入力による診断機能（医療行為に該当）
- 詳細住所の入力（個人情報保護）
- 毎回のプロフィール入力（UX摩擦）
- 病院紹介機能（医療情報の正確性担保困難）

## Design

### Architecture
```
mobile/
├── app/                    # Expo Router pages
│   ├── (tabs)/            # Tab navigation
│   │   ├── index.tsx      # ホーム（診断結果）
│   │   └── map.tsx        # 地域マップ
│   ├── _layout.tsx        # Root layout
│   ├── onboarding.tsx     # 初回プロフィール設定
│   └── detail.tsx         # 診断詳細
├── components/            # Reusable components
│   ├── DiagnosisCard.tsx  # 診断結果カード
│   ├── ProfileForm.tsx    # プロフィール入力
│   └── MapView.tsx        # 地域マップ
├── lib/                   # Utilities
│   ├── storage.ts         # localStorage wrapper
│   └── api.ts             # API client
└── constants/             # App constants
```

### Data Models
```typescript
interface UserProfile {
  ageGroup: '0-1' | '2-3' | '4-6' | '7+';
  region: string;
  childName?: string;
}

interface DiagnosisResult {
  status: 'normal' | 'caution';
  message: string;
  actions?: string[];
  timestamp: Date;
}
```

### UI/UX Flow
1. **初回起動** → プロフィール設定 → ホーム画面
2. **2回目以降** → ホーム画面（診断結果即表示）
3. **注意時** → 詳細ボタン → Nova診断詳細 → 地域マップ（オプション）

## Tasks

### Phase 1: 基本構造とプロフィール設定
- [ ] mobile/ディレクトリ作成とExpo初期設定
- [ ] プロフィール設定画面（onboarding.tsx）
- [ ] localStorage wrapper実装
- [ ] ホーム画面の基本レイアウト

### Phase 2: 診断結果表示
- [ ] 診断結果カードコンポーネント
- [ ] 平常/注意の2段階表示UI
- [ ] Nova API連携（モック）
- [ ] 診断詳細画面

### Phase 3: 地域マップ
- [ ] 地域マップコンポーネント
- [ ] 流行状況データ表示
- [ ] インタラクティブマップUI

### Phase 4: 通知機能（将来）
- [ ] プッシュ通知設定
- [ ] 異常検知アラート
- [ ] 通知履歴表示

## Testing Strategy
- **Early Phase**: 基本フロー（プロフィール設定→診断表示）のみテスト
- **Mid Phase**: 60%以上のカバレッジ、エッジケース含む

## Success Metrics
- 平常時の判断時間: 10秒以内
- 注意時の情報取得: 3分以内
- 初回設定完了率: 80%以上
- 毎朝の利用継続率: 70%以上（1週間後）

## References
- #[[file:requirements.txt]] - ユーザーストーリー詳細
- Kids-Outbreak-Radar/ - Replitで作成した既存フロントエンド
