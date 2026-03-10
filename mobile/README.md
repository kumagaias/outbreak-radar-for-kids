# Outbreak Radar for Kids - Mobile App

子ども感染症レーダー モバイルアプリ

## Overview

保護者が子供の感染症リスクを素早く確認できるモバイルアプリ。毎朝10秒で平常/注意を判断でき、保育園からの通知時には3分以内に登園判断の材料を提供します。

## Features

- 初回プロフィール設定（年齢・地域）
- 毎朝のルーティンチェック（10秒以内）
- 保育園通知時の詳細確認（3分以内）
- 地域の流行状況マップ

## Tech Stack

- React Native (Expo)
- TypeScript
- Expo Router (file-based routing)
- React Query (data fetching)
- AsyncStorage (local storage)

## Getting Started

```bash
# Install dependencies
npm install

# Start development server
npm start

# Run on iOS
npm run ios

# Run on Android
npm run android
```

## Project Structure

```
mobile/
├── app/              # Expo Router pages
├── components/       # Reusable components
├── lib/              # Utilities and context
├── constants/        # App constants
└── assets/           # Images and fonts
```

## Development

This project is in Early phase - focus on speed and critical path testing only.

See `.kiro/specs/feature/issue-001-outbreak-radar-mobile-app.md` for detailed specifications.
