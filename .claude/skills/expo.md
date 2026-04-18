---
name: expo
description: General Expo development focusing on Camera, Location, and File Handling for SnapProof.
---

# Expo Development Skill

Use this skill when implementing core device features in the SnapProof app.

## 1. Camera & Media
- Implementation via `expo-camera`.
- Saving to gallery via `expo-media-library`.

## 2. Geolocation
- Accurate tracking via `expo-location`.
- Must handle foreground and background location permissions appropriately.

## 3. File System
- Use `expo-file-system` to manage the local proof queue.
- Temporary storage of images before hashing and upload.

## 4. Notifications
- `expo-notifications` for alerting the user on proof verification or nearby incidents.

## 5. EAS & Environment
- Manage `eas.json` for different environments (testnet, production).
- Use `expo-constants` for app metadata.
