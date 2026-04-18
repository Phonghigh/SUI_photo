---
name: react-native-expo
description: Core Expo and React Native architecture, project setup, and best practices. Use for project scaffolding and structural decisions.
---

# React Native & Expo Architecture

Guidelines for the **SnapProof** mobile application.

## 1. Project Scaffolding
- Use **Expo SDK 52+**.
- Utilize **Expo Router** for file-based navigation.
- Use **TypeScript** for all components and services.

## 2. Architecture Patterns
- **Feature-based structure**: Organize by modules (e.g., `features/camera`, `features/proofs`).
- **Offline-First**: Use a local database (SQLite) or storage queue to handle pending proof submissions.
- **Clean Code**: Keep UI components separate from blockchain/native logic.

## 3. Native Modules & Expo
- Use **Expo Config Plugins** for native configuration (`app.json`).
- Prefer Expo SDK libraries (Camera, Location, FileSystem) over raw React Native libraries where possible.
- Use **EAS Build** for creating development clients and production builds.

## 4. Performance & UX
- Use `react-native-reanimated` for smooth animations.
- Use `react-native-safe-area-context` for modern edge-to-edge layouts.
- Optimize image handling to avoid memory leaks during photo processing.
