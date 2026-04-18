---
name: expo-camera-workflow
description: Camera integration, photo capture, and storage workflows in Expo React Native. Use for SnapProof photo evidence collection.
---

# Expo Camera Workflow

This skill guides the implementation of a robust camera flow for photo evidence.

## 1. Setup & Permissions
Always request permissions before showing the camera.

```typescript
import { CameraView, useCameraPermissions } from 'expo-camera';

const [permission, requestPermission] = useCameraPermissions();

if (!permission?.granted) {
  // Show UI to request permission
}
```

## 2. Camera Implementation
```typescript
const cameraRef = useRef<CameraView>(null);

const takePicture = async () => {
  if (cameraRef.current) {
    const photo = await cameraRef.current.takePictureAsync({
      quality: 1.0,
      skipProcessing: false,
    });
    return photo.uri;
  }
};

return (
  <CameraView 
    ref={cameraRef} 
    style={styles.camera} 
    facing="back"
  />
);
```

## 3. Workflow Steps
1. **Capture**: Take the photo and get the local URI.
2. **Hash**: Generate a SHA-256 hash of the image file immediately.
3. **Geo-tag**: Bundle the GPS coordinates and timestamp with the hash.
4. **Storage**: Save to local filesystem (using `expo-file-system`) then queue for Walrus upload.

## 4. Best Practices
- **Stability**: Ensure the camera unmounts properly when not in use to save battery.
- **Quality**: Use high quality (1.0) for evidence photos.
- **Offline First**: Save the photo and metadata locally first in case of network issues.
