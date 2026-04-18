---
name: maps-implementation
description: Implementing Maps in React Native/Expo using react-native-maps. Markers, POI, and route visualization.
---

# Maps Implementation

Implementation of the evidence map for **SnapProof**.

## 1. Core Component
Use `react-native-maps` for the map view.

```typescript
import MapView, { Marker } from 'react-native-maps';

<MapView
  style={styles.map}
  initialRegion={region}
>
  {proofs.map(proof => (
    <Marker
      key={proof.id}
      coordinate={proof.location}
      title={proof.title}
      description={proof.timestamp}
    />
  ))}
</MapView>
```

## 2. Key Features
- **Markers**: Represent each verified proof on the map.
- **Custom Callouts**: Show a small thumbnail of the photo when a marker is tapped.
- **Clustering**: (Future) Use `react-native-clusterer` for high-density areas.

## 3. Integration
- Sync map region with user's current location from `expo-location`.
- Deep-link to Google Maps for external navigation if needed.

## 4. Styling
- Use custom map styles for a premium, branded look.
- Handle map loading states gracefully.
