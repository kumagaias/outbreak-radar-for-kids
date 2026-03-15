import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Platform,
  Modal,
  Animated,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { Colors } from "@/constants/colors";
import { useProfile } from "@/lib/profile-context";
import { t } from "@/lib/i18n";
import {
  DISEASES,
  getDiseaseName,
  getDiseaseDescription,
  type Disease,
  type OutbreakData,
} from "@/lib/mock-data";
import { fetchOutbreakData } from "@/lib/outbreak-data-service";

// Conditionally import MapView and GeoJSON only on native platforms
let MapView: any;
let Polygon: any;
let PROVIDER_GOOGLE: any;
let japanPrefectures: any;
let usStates: any;
let WebMap: any;

if (Platform.OS !== "web") {
  const MapModule = require("react-native-maps");
  MapView = MapModule.default;
  Polygon = MapModule.Polygon;
  PROVIDER_GOOGLE = MapModule.PROVIDER_GOOGLE;
  
  // Import accurate GeoJSON data
  japanPrefectures = require("@/assets/geojson/japan-prefectures.json");
  usStates = require("@/assets/geojson/us-states.json");
} else {
  // Import Web map component
  WebMap = require("@/components/WebMap").default;
  
  // Import GeoJSON data for web
  japanPrefectures = require("@/assets/geojson/japan-prefectures.json");
  usStates = require("@/assets/geojson/us-states.json");
}

// Helper function to convert GeoJSON coordinates to react-native-maps format
function convertGeoJSONToCoordinates(coordinates: number[][][]): Array<{ latitude: number; longitude: number }> {
  return coordinates[0].map(([lng, lat]) => ({ latitude: lat, longitude: lng }));
}

// Prefecture name mapping (English to Japanese)
const PREFECTURE_NAME_MAP: Record<string, string> = {
  "Hokkaidō": "北海道",
  "Hokkaido": "北海道",
  "Aomori": "青森県",
  "Iwate": "岩手県",
  "Miyagi": "宮城県",
  "Akita": "秋田県",
  "Yamagata": "山形県",
  "Fukushima": "福島県",
  "Ibaraki": "茨城県",
  "Tochigi": "栃木県",
  "Gunma": "群馬県",
  "Saitama": "埼玉県",
  "Chiba": "千葉県",
  "Tokyo": "東京都",
  "Kanagawa": "神奈川県",
  "Niigata": "新潟県",
  "Toyama": "富山県",
  "Ishikawa": "石川県",
  "Fukui": "福井県",
  "Yamanashi": "山梨県",
  "Nagano": "長野県",
  "Gifu": "岐阜県",
  "Shizuoka": "静岡県",
  "Aichi": "愛知県",
  "Mie": "三重県",
  "Shiga": "滋賀県",
  "Kyōto": "京都府",
  "Kyoto": "京都府",
  "Kyoto Fu": "京都府",
  "Ōsaka": "大阪府",
  "Osaka": "大阪府",
  "Osaka Fu": "大阪府",
  "Hyōgo": "兵庫県",
  "Hyogo": "兵庫県",
  "Nara": "奈良県",
  "Wakayama": "和歌山県",
  "Tottori": "鳥取県",
  "Shimane": "島根県",
  "Okayama": "岡山県",
  "Hiroshima": "広島県",
  "Yamaguchi": "山口県",
  "Tokushima": "徳島県",
  "Kagawa": "香川県",
  "Ehime": "愛媛県",
  "Kōchi": "高知県",
  "Kochi": "高知県",
  "Fukuoka": "福岡県",
  "Saga": "佐賀県",
  "Nagasaki": "長崎県",
  "Kumamoto": "熊本県",
  "Ōita": "大分県",
  "Oita": "大分県",
  "Miyazaki": "宮崎県",
  "Kagoshima": "鹿児島県",
  "Okinawa": "沖縄県",
};

// Build polygon map from accurate GeoJSON (supports both Polygon and MultiPolygon)
const buildPolygonMap = (country: "JP" | "US") => {
  const map: Record<string, Array<Array<{ latitude: number; longitude: number }>>> = {};
  
  // Check if GeoJSON data is available
  if (!japanPrefectures || !usStates) {
    return map;
  }
  
  if (country === "JP") {
    // Use japan-prefectures.json
    japanPrefectures.features.forEach((feature: any) => {
      const nameEn = feature.properties.nam || feature.properties.name;
      const nameJa = feature.properties.nam_ja || PREFECTURE_NAME_MAP[nameEn] || nameEn;
      
      if (feature.geometry.type === "Polygon") {
        map[nameJa] = [convertGeoJSONToCoordinates(feature.geometry.coordinates)];
      } else if (feature.geometry.type === "MultiPolygon") {
        map[nameJa] = feature.geometry.coordinates.map((coords: number[][][]) => 
          convertGeoJSONToCoordinates([coords[0]])
        );
      }
    });
  } else {
    // Use us-states.json
    usStates.features.forEach((feature: any) => {
      const name = feature.properties.name;
      
      if (feature.geometry.type === "Polygon") {
        map[name] = [convertGeoJSONToCoordinates(feature.geometry.coordinates)];
      } else if (feature.geometry.type === "MultiPolygon") {
        map[name] = feature.geometry.coordinates.map((coords: number[][][]) => 
          convertGeoJSONToCoordinates([coords[0]])
        );
      }
    });
  }
  
  return map;
};

// Center coordinates for each region
const REGION_COORDS: Record<string, { latitude: number; longitude: number }> = {
  "東京都": { latitude: 35.6762, longitude: 139.6503 },
  "神奈川県": { latitude: 35.4478, longitude: 139.6425 },
  "大阪府": { latitude: 34.6937, longitude: 135.5023 },
  "埼玉県": { latitude: 35.8569, longitude: 139.6489 },
  "千葉県": { latitude: 35.6074, longitude: 140.1065 },
  "北海道": { latitude: 43.0642, longitude: 141.3469 },
  "福岡県": { latitude: 33.6064, longitude: 130.4183 },
  "California": { latitude: 36.7783, longitude: -119.4179 },
  "New York": { latitude: 40.7128, longitude: -74.0060 },
  "Texas": { latitude: 31.9686, longitude: -99.9018 },
  "Florida": { latitude: 27.9944, longitude: -81.7603 },
};

export default function MapScreen() {
  const insets = useSafeAreaInsets();
  const { profile } = useProfile();
  const [selectedDisease, setSelectedDisease] = useState<string | null>(null);
  const [selectedArea, setSelectedArea] = useState<string | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(300)).current;
  const webTopInset = Platform.OS === "web" ? 45 : 0;
  
  // Real outbreak data state
  const [allOutbreakData, setAllOutbreakData] = useState<OutbreakData[]>([]);
  const [isLoadingData, setIsLoadingData] = useState(false);

  // Load real outbreak data
  useEffect(() => {
    if (profile) {
      loadOutbreakData();
    }
  }, [profile]);

  const loadOutbreakData = async () => {
    if (!profile) return;

    setIsLoadingData(true);
    try {
      const realData = await fetchOutbreakData(profile.area, profile.country as 'JP' | 'US');
      setAllOutbreakData(realData);
    } catch (error) {
      console.error('Error fetching outbreak data:', error);
      setAllOutbreakData([]);
    } finally {
      setIsLoadingData(false);
    }
  };

  // Auto-select first disease on mount
  useEffect(() => {
    if (!profile || selectedDisease) return;

    // Always select first disease by default
    if (DISEASES.length > 0) {
      setSelectedDisease(DISEASES[0].id);
    }
  }, [profile, selectedDisease]);

  // Modal animation
  useEffect(() => {
    if (modalVisible) {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.spring(slideAnim, {
          toValue: 0,
          tension: 65,
          friction: 11,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 150,
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: 300,
          duration: 150,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [modalVisible, fadeAnim, slideAnim]);

  const handleRegionPress = (outbreak: OutbreakData) => {
    setSelectedArea(outbreak.area);
    setModalVisible(true);
  };

  const closeModal = () => {
    setModalVisible(false);
    setTimeout(() => setSelectedArea(null), 200);
  };

  if (!profile) {
    return null;
  }

  const strings = t(profile.country);
  const outbreakData = selectedDisease
    ? allOutbreakData.filter(d => d.diseaseId === selectedDisease)
    : [];

  // Get polygon map for current country
  const polygonMap = buildPolygonMap(profile.country);

  // Get user's region coordinates or default
  const userCoords = REGION_COORDS[profile.area] || 
    (profile.country === "JP" 
      ? { latitude: 35.6762, longitude: 139.6503 } // Tokyo
      : { latitude: 37.0902, longitude: -95.7129 }); // US center

  const getLevelColor = (level: "low" | "medium" | "high") => {
    switch (level) {
      case "high":
        return "#EF4444"; // Red
      case "medium":
        return "#F59E0B"; // Orange
      case "low":
        return "#FCD34D"; // Yellow
    }
  };

  const getLevelFillColor = (level: "low" | "medium" | "high") => {
    switch (level) {
      case "high":
        return "rgba(239, 68, 68, 0.4)"; // Red with transparency
      case "medium":
        return "rgba(245, 158, 11, 0.4)"; // Orange with transparency
      case "low":
        return "rgba(252, 211, 77, 0.35)"; // Yellow with transparency
    }
  };

  const getLevelLabel = (level: "low" | "medium" | "high") => {
    switch (level) {
      case "high":
        return strings.common.highRisk;
      case "medium":
        return strings.common.mediumRisk;
      case "low":
        return strings.common.lowRisk;
    }
  };

  // Grayscale map style with emphasized administrative boundaries
  const mapStyle = [
    {
      elementType: "geometry",
      stylers: [{ color: "#f5f5f5" }],
    },
    {
      elementType: "labels.icon",
      stylers: [{ visibility: "off" }],
    },
    {
      elementType: "labels.text.fill",
      stylers: [{ color: "#616161" }],
    },
    {
      elementType: "labels.text.stroke",
      stylers: [{ color: "#f5f5f5" }],
    },
    {
      featureType: "administrative",
      elementType: "geometry",
      stylers: [{ visibility: "on" }],
    },
    {
      featureType: "administrative.land_parcel",
      elementType: "labels",
      stylers: [{ visibility: "off" }],
    },
    {
      featureType: "administrative.province",
      elementType: "geometry.stroke",
      stylers: [{ color: "#333333" }, { weight: 2.5 }, { visibility: "on" }],
    },
    {
      featureType: "administrative.locality",
      elementType: "geometry.stroke",
      stylers: [{ visibility: "off" }],
    },
    {
      featureType: "administrative.neighborhood",
      elementType: "geometry.stroke",
      stylers: [{ visibility: "off" }],
    },
    {
      featureType: "administrative.country",
      elementType: "geometry.stroke",
      stylers: [{ color: "#333333" }, { weight: 2 }, { visibility: "on" }],
    },
    {
      featureType: "landscape",
      elementType: "geometry",
      stylers: [{ color: "#f5f5f5" }],
    },
    {
      featureType: "poi",
      stylers: [{ visibility: "off" }],
    },
    {
      featureType: "road",
      stylers: [{ visibility: "off" }],
    },
    {
      featureType: "transit",
      stylers: [{ visibility: "off" }],
    },
    {
      featureType: "water",
      elementType: "geometry",
      stylers: [{ color: "#b8d4e8" }],
    },
    {
      featureType: "water",
      elementType: "geometry.stroke",
      stylers: [{ color: "#4a90c4" }, { weight: 1.5 }],
    },
    {
      featureType: "water",
      elementType: "labels.text",
      stylers: [{ visibility: "off" }],
    },
  ];

  return (
    <View style={[styles.container, { paddingTop: insets.top + webTopInset }]}>
      {/* Legend */}
      {selectedDisease && outbreakData.length > 0 && (
        <View style={styles.legend}>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: "#EF4444" }]} />
            <Text style={styles.legendText}>{strings.map.legendHigh}</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: "#F59E0B" }]} />
            <Text style={styles.legendText}>{strings.map.legendMedium}</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: "#FCD34D" }]} />
            <Text style={styles.legendText}>{strings.map.legendLow}</Text>
          </View>
        </View>
      )}

      {/* Map View */}
      <View style={styles.mapContainer}>
        {!selectedDisease ? (
          <View style={styles.emptyState}>
            <Ionicons name="map-outline" size={64} color={Colors.textTertiary} />
            <Text style={styles.emptyTitle}>{strings.map.selectDisease}</Text>
            <Text style={styles.emptyText}>
              {strings.map.selectDiseaseDesc}
            </Text>
          </View>
        ) : Platform.OS === "web" ? (
          <WebMap
            center={userCoords}
            zoom={profile.country === "JP" ? 6 : 5}
            outbreakData={outbreakData}
            polygonMap={polygonMap}
            onRegionPress={(area) => {
              const outbreak = outbreakData.find((o) => o.area === area);
              if (outbreak) handleRegionPress(outbreak);
            }}
          />
        ) : (
          <MapView
            style={styles.map}
            provider={PROVIDER_GOOGLE}
            customMapStyle={mapStyle}
            initialRegion={{
              latitude: userCoords.latitude,
              longitude: userCoords.longitude,
              latitudeDelta: profile.country === "JP" ? 3 : 6,
              longitudeDelta: profile.country === "JP" ? 3 : 6,
            }}
            showsPointsOfInterest={false}
            showsBuildings={false}
            showsTraffic={false}
            showsIndoors={false}
          >
            {outbreakData.map((outbreak) => {
              const polygons = polygonMap[outbreak.area];
              if (!polygons || polygons.length === 0) return null;

              const disease = DISEASES.find((d) => d.id === outbreak.diseaseId);
              if (!disease) return null;

              // Render all polygons for this area (handles MultiPolygon)
              return polygons.map((polygon, index) => (
                <Polygon
                  key={`${outbreak.area}-${outbreak.diseaseId}-${index}`}
                  coordinates={polygon}
                  fillColor={getLevelFillColor(outbreak.level)}
                  strokeColor={getLevelColor(outbreak.level)}
                  strokeWidth={3}
                  tappable={true}
                  onPress={() => handleRegionPress(outbreak)}
                />
              ));
            })}
          </MapView>
        )}
      </View>

      {/* Disease Filter */}
      <View style={styles.diseaseFilter}>
        <View style={styles.diseaseFilterContent}>
          {DISEASES.map((disease) => (
            <Pressable
              key={disease.id}
              style={styles.diseaseItem}
              onPress={() =>
                setSelectedDisease(
                  selectedDisease === disease.id ? null : disease.id
                )
              }
            >
              <View style={[
                styles.checkbox,
                { borderColor: disease.color, backgroundColor: selectedDisease === disease.id ? disease.color : 'transparent' }
              ]}>
                {selectedDisease === disease.id && (
                  <Ionicons name="checkmark" size={14} color={Colors.white} />
                )}
              </View>
              <Text
                style={[
                  styles.diseaseText,
                  { color: Colors.text },
                ]}
              >
                {getDiseaseName(disease, profile.country)}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      {/* Region Detail Modal */}
      <Modal
        visible={modalVisible}
        transparent
        animationType="none"
        onRequestClose={closeModal}
      >
        <Pressable style={styles.modalOverlay} onPress={closeModal}>
          <Animated.View
            style={[
              styles.modalBackdrop,
              { opacity: fadeAnim },
            ]}
          />
        </Pressable>
        <Animated.View
          style={[
            styles.modalContent,
            {
              transform: [{ translateY: slideAnim }],
            },
          ]}
        >
          {selectedArea && profile && (
            <>
              <View style={styles.modalHeader}>
                <View style={styles.modalHandle} />
                <Pressable style={styles.closeButton} onPress={closeModal}>
                  <Ionicons name="close" size={24} color={Colors.text} />
                </Pressable>
              </View>

              <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
                <Text style={styles.modalTitle}>{selectedArea}</Text>
                
                {(() => {
                  const areaOutbreaks = allOutbreakData.filter(d => d.area === selectedArea);
                  
                  if (areaOutbreaks.length === 0) {
                    return (
                      <View style={styles.noDataContainer}>
                        <Ionicons name="information-circle-outline" size={48} color={Colors.textTertiary} />
                        <Text style={styles.noDataText}>
                          {profile.country === "JP" ? "この地域の感染症情報はありません" : "No outbreak data for this area"}
                        </Text>
                      </View>
                    );
                  }

                  return areaOutbreaks.map((outbreak, index) => {
                    const disease = DISEASES.find((d) => d.id === outbreak.diseaseId);
                    if (!disease) return null;

                    return (
                      <View key={outbreak.diseaseId} style={[styles.diseaseCard, index > 0 && styles.diseaseCardSpacing]}>
                        <View style={styles.diseaseHeader}>
                          <View style={[styles.diseaseIcon, { backgroundColor: disease.color + "20" }]}>
                            <Ionicons name={disease.icon as any} size={24} color={disease.color} />
                          </View>
                          <Text style={styles.diseaseName}>
                            {getDiseaseName(disease, profile.country)}
                          </Text>
                        </View>

                        <View style={[
                          styles.riskBadge,
                          { backgroundColor: getLevelColor(outbreak.level) + "15" }
                        ]}>
                          <Text style={[
                            styles.riskBadgeText,
                            { color: getLevelColor(outbreak.level) }
                          ]}>
                            {getLevelLabel(outbreak.level)}
                          </Text>
                        </View>

                        <View style={styles.statsContainer}>
                          <View style={styles.statItem}>
                            <Text style={styles.statValue}>{outbreak.cases}</Text>
                            <Text style={styles.statLabel}>{strings.home.cases}</Text>
                          </View>
                          <View style={styles.statDivider} />
                          <View style={styles.statItem}>
                            <Text style={[
                              styles.statValue,
                              { color: outbreak.weeklyChange > 0 ? Colors.danger : Colors.success }
                            ]}>
                              {outbreak.weeklyChange > 0 ? "+" : ""}{outbreak.weeklyChange}%
                            </Text>
                            <Text style={styles.statLabel}>
                              {profile.country === "JP" ? "週間変化" : "Weekly Change"}
                            </Text>
                          </View>
                        </View>

                        {/* Additional Metrics */}
                        {(outbreak.sewerageVirusLevel !== undefined || 
                          outbreak.hospitalizations !== undefined || 
                          outbreak.schoolClosures !== undefined) && (
                          <View style={styles.metricsContainer}>
                            {outbreak.sewerageVirusLevel !== undefined && (
                              <View style={styles.metricItem}>
                                <View style={styles.metricHeader}>
                                  <Ionicons name="water" size={16} color={Colors.textSecondary} />
                                  <Text style={styles.metricLabel}>
                                    {profile.country === "JP" ? "下水道ウイルス濃度" : "Sewerage Virus Level"}
                                  </Text>
                                </View>
                                <View style={styles.metricBar}>
                                  <View style={[
                                    styles.metricBarFill,
                                    { 
                                      width: `${outbreak.sewerageVirusLevel}%`,
                                      backgroundColor: outbreak.sewerageVirusLevel > 70 ? Colors.danger : 
                                                      outbreak.sewerageVirusLevel > 40 ? Colors.warning : 
                                                      Colors.success
                                    }
                                  ]} />
                                </View>
                                <Text style={styles.metricValue}>{outbreak.sewerageVirusLevel}/100</Text>
                              </View>
                            )}

                            {outbreak.hospitalizations !== undefined && (
                              <View style={styles.metricItem}>
                                <View style={styles.metricHeader}>
                                  <Ionicons name="medical" size={16} color={Colors.textSecondary} />
                                  <Text style={styles.metricLabel}>
                                    {profile.country === "JP" ? "入院者数" : "Hospitalizations"}
                                  </Text>
                                </View>
                                <Text style={styles.metricValueLarge}>{outbreak.hospitalizations}{profile.country === "JP" ? "人" : ""}</Text>
                              </View>
                            )}

                            {outbreak.schoolClosures !== undefined && (
                              <View style={styles.metricItem}>
                                <View style={styles.metricHeader}>
                                  <Ionicons name="school" size={16} color={Colors.textSecondary} />
                                  <Text style={styles.metricLabel}>
                                    {profile.country === "JP" ? "学級閉鎖" : "School Closures"}
                                  </Text>
                                </View>
                                <Text style={styles.metricValueLarge}>{outbreak.schoolClosures}{profile.country === "JP" ? "件" : ""}</Text>
                              </View>
                            )}

                            {outbreak.peakWeek && (
                              <View style={styles.metricItem}>
                                <View style={styles.metricHeader}>
                                  <Ionicons name="trending-up" size={16} color={Colors.danger} />
                                  <Text style={styles.metricLabel}>
                                    {profile.country === "JP" ? "ピーク予測" : "Peak Forecast"}
                                  </Text>
                                </View>
                                <Text style={[styles.metricValueLarge, { color: Colors.danger }]}>{outbreak.peakWeek}</Text>
                              </View>
                            )}
                          </View>
                        )}

                        <View style={styles.descriptionSection}>
                          <Text style={styles.sectionTitle}>
                            {profile.country === "JP" ? "感染症について" : "About"}
                          </Text>
                          <Text style={styles.descriptionText}>
                            {getDiseaseDescription(disease, profile.country)}
                          </Text>
                        </View>
                      </View>
                    );
                  });
                })()}

                <View style={styles.updateInfo}>
                  <Ionicons name="time-outline" size={14} color={Colors.textSecondary} />
                  <Text style={styles.updateText}>
                    {profile.country === "JP" ? "最終更新: " : "Last updated: "}
                    {new Date().toLocaleDateString(
                      profile.country === "JP" ? "ja-JP" : "en-US"
                    )}
                  </Text>
                </View>
              </ScrollView>
            </>
          )}
        </Animated.View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  diseaseFilter: {
    backgroundColor: Colors.surface,
    borderTopWidth: 1,
    borderTopColor: Colors.borderLight,
    paddingVertical: 12,
    paddingHorizontal: 24,
  },
  diseaseFilterContent: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  diseaseItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  diseaseText: {
    fontSize: 14,
    fontFamily: "Inter_500Medium",
  },
  mapContainer: {
    flex: 1,
    height: '100%',
  },
  map: {
    flex: 1,
  },
  emptyState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 40,
  },
  emptyTitle: {
    fontSize: 18,
    fontFamily: "Inter_700Bold",
    color: Colors.text,
    marginTop: 16,
    marginBottom: 8,
    textAlign: "center",
  },
  emptyText: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: Colors.textSecondary,
    textAlign: "center",
    lineHeight: 20,
  },
  legend: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 20,
    paddingVertical: 6,
    paddingHorizontal: 24,
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  legendItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  legendDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  legendText: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
    color: Colors.text,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: "flex-end",
  },
  modalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
  },
  modalContent: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: "80%",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 8,
  },
  modalHeader: {
    alignItems: "center",
    paddingTop: 12,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  modalHandle: {
    width: 40,
    height: 4,
    backgroundColor: Colors.border,
    borderRadius: 2,
    marginBottom: 12,
  },
  closeButton: {
    position: "absolute",
    right: 16,
    top: 12,
    padding: 8,
  },
  modalBody: {
    padding: 24,
  },
  modalTitle: {
    fontSize: 28,
    fontFamily: "Inter_700Bold",
    color: Colors.text,
    marginBottom: 16,
  },
  diseaseHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 12,
  },
  diseaseIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  diseaseName: {
    fontSize: 20,
    fontFamily: "Inter_600SemiBold",
    color: Colors.text,
    flex: 1,
  },
  riskBadge: {
    alignSelf: "flex-start",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    marginBottom: 20,
  },
  riskBadgeText: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
  },
  statsContainer: {
    flexDirection: "row",
    backgroundColor: Colors.surfaceSecondary,
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
  },
  statItem: {
    flex: 1,
    alignItems: "center",
  },
  statDivider: {
    width: 1,
    backgroundColor: Colors.border,
    marginHorizontal: 16,
  },
  statValue: {
    fontSize: 28,
    fontFamily: "Inter_700Bold",
    color: Colors.text,
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
    color: Colors.textSecondary,
  },
  metricsContainer: {
    gap: 16,
    marginTop: 20,
  },
  metricItem: {
    gap: 8,
  },
  metricHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  metricLabel: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
    color: Colors.textSecondary,
  },
  metricBar: {
    height: 8,
    backgroundColor: Colors.borderLight,
    borderRadius: 4,
    overflow: "hidden",
  },
  metricBarFill: {
    height: "100%",
    borderRadius: 4,
  },
  metricValue: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
    color: Colors.text,
    textAlign: "right",
  },
  metricValueLarge: {
    fontSize: 20,
    fontFamily: "Inter_700Bold",
    color: Colors.text,
  },
  descriptionSection: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
    color: Colors.text,
    marginBottom: 8,
  },
  descriptionText: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: Colors.textSecondary,
    lineHeight: 22,
  },
  updateInfo: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: Colors.borderLight,
  },
  updateText: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: Colors.textSecondary,
  },
  diseaseCard: {
    backgroundColor: Colors.surfaceSecondary,
    borderRadius: 16,
    padding: 16,
  },
  diseaseCardSpacing: {
    marginTop: 16,
  },
  noDataContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 40,
  },
  noDataText: {
    fontSize: 14,
    fontFamily: "Inter_500Medium",
    color: Colors.textSecondary,
    marginTop: 12,
    textAlign: "center",
  },
});
