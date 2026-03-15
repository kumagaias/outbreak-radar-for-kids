import React, { useEffect, useRef } from "react";
import { View, StyleSheet } from "react-native";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

interface WebMapProps {
  center: { latitude: number; longitude: number };
  zoom: number;
  outbreakData: Array<{
    area: string;
    level: "low" | "medium" | "high";
    diseaseId: string;
  }>;
  polygonMap: Record<string, Array<Array<{ latitude: number; longitude: number }>>>;
  onRegionPress: (area: string) => void;
}

export default function WebMap({
  center,
  zoom,
  outbreakData,
  polygonMap,
  onRegionPress,
}: WebMapProps) {
  const mapRef = useRef<L.Map | null>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    // Initialize map
    const map = L.map(mapContainerRef.current, {
      center: [center.latitude, center.longitude],
      zoom: zoom,
      zoomControl: true,
    });

    // Add grayscale tile layer
    L.tileLayer("https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
      subdomains: "abcd",
      maxZoom: 20,
    }).addTo(map);

    mapRef.current = map;

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, []);

  // Update polygons when outbreak data changes
  useEffect(() => {
    if (!mapRef.current) return;

    const map = mapRef.current;

    // Clear existing layers (except base layer)
    map.eachLayer((layer) => {
      if (layer instanceof L.Polygon) {
        map.removeLayer(layer);
      }
    });

    // Add outbreak polygons
    outbreakData.forEach((outbreak) => {
      const polygons = polygonMap[outbreak.area];
      if (!polygons || polygons.length === 0) return;

      const color = getLevelColor(outbreak.level);
      const fillColor = getLevelFillColor(outbreak.level);

      polygons.forEach((polygon) => {
        const latLngs = polygon.map((coord) => [coord.latitude, coord.longitude] as [number, number]);
        
        const polygonLayer = L.polygon(latLngs, {
          color: color,
          fillColor: fillColor,
          fillOpacity: 0.5,
          weight: 3,
          fill: true,
        }).addTo(map);

        polygonLayer.on("click", () => {
          onRegionPress(outbreak.area);
        });

        polygonLayer.bindTooltip(outbreak.area, {
          permanent: false,
          direction: "center",
        });
      });
    });
  }, [outbreakData, polygonMap, onRegionPress]);

  const getLevelColor = (level: "low" | "medium" | "high") => {
    switch (level) {
      case "high":
        return "#EF4444";
      case "medium":
        return "#F59E0B";
      case "low":
        return "#FCD34D";
    }
  };

  const getLevelFillColor = (level: "low" | "medium" | "high") => {
    switch (level) {
      case "high":
        return "#EF4444";
      case "medium":
        return "#F59E0B";
      case "low":
        return "#FCD34D";
    }
  };

  return (
    <View style={styles.container}>
      <div
        ref={mapContainerRef}
        style={{
          width: "100%",
          height: "100%",
          borderRadius: 0,
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    width: "100%",
    height: "100%",
  },
});
