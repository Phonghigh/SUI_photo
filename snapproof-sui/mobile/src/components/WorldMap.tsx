import React, { useRef, useEffect } from "react";
import { View, StyleSheet, Platform, Text } from "react-native";
import MapView, { Marker, PROVIDER_GOOGLE } from "react-native-maps";
import { darkMapStyle } from "../constants/mapStyle";
import { C } from "../theme/tokens";

export interface Proof {
  id: string;
  objectId?: string;
  latitude: number;
  longitude: number;
  location: string;
  time: string;
  verified: boolean;
  hot?: boolean;
}

interface Props {
  proofs: Proof[];
  selectedId?: string;
  onSelect: (p: Proof) => void;
}

export const WorldMap = ({ proofs, selectedId, onSelect }: Props) => {
  const mapRef = useRef<MapView>(null);

  useEffect(() => {
    if (selectedId) {
      const p = proofs.find((x) => x.id === selectedId);
      if (p && mapRef.current) {
        mapRef.current.animateToRegion({
          latitude: p.latitude,
          longitude: p.longitude,
          latitudeDelta: 0.05,
          longitudeDelta: 0.05,
        });
      }
    }
  }, [selectedId]);

  return (
    <View style={styles.container}>
      <MapView
        ref={mapRef}
        provider={PROVIDER_GOOGLE}
        style={styles.map}
        customMapStyle={darkMapStyle}
        initialRegion={{
          latitude: 20,
          longitude: 0,
          latitudeDelta: 120,
          longitudeDelta: 120,
        }}
      >
        {proofs.map((p) => {
          if (p.latitude === undefined || p.longitude === undefined) return null;
          return (
            <Marker
              key={p.id}
              coordinate={{ latitude: p.latitude, longitude: p.longitude }}
              onPress={() => onSelect(p)}
            >
              <View style={styles.markerContainer}>
                <View
                  style={[
                    styles.dot,
                    { backgroundColor: p.verified ? C.mint : C.coral },
                    selectedId === p.id && styles.dotSelected,
                  ]}
                />
                {p.hot && <View style={styles.pulse} />}
              </View>
            </Marker>
          );
        })}
      </MapView>

    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    height: 380,
    width: "100%",
    borderRadius: 20,
    overflow: "hidden",
    backgroundColor: "#050813",
  },
  map: {
    ...StyleSheet.absoluteFillObject,
  },
  markerContainer: {
    alignItems: "center",
    justifyContent: "center",
    width: 30,
    height: 30,
  },
  dot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: "#fff",
  },
  dotSelected: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderColor: C.cyan,
    borderWidth: 3,
  },
  pulse: {
    position: "absolute",
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: "rgba(240,86,110,0.3)",
    borderWidth: 1,
    borderColor: "rgba(240,86,110,0.5)",
  },
});
