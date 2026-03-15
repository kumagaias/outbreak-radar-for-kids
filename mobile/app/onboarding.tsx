import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  Platform,
  ActivityIndicator,
  Modal,
  TextInput,
} from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { Colors } from "@/constants/colors";
import { AGE_GROUPS, AREAS, COUNTRIES, type Country } from "@/lib/mock-data";
import { useProfile, type Child } from "@/lib/profile-context";
import { t } from "@/lib/i18n";
import { getCurrentArea, getCurrentCountryAndArea } from "@/lib/location";

// Detect browser language and return default country
function detectBrowserLanguage(): Country {
  if (Platform.OS === "web") {
    const browserLang = navigator.language || (navigator as any).userLanguage;
    // Check if browser language is Japanese
    if (browserLang.startsWith("ja")) {
      return "JP";
    }
  }
  // Default to US for all other cases
  return "US";
}

export default function OnboardingScreen() {
  const insets = useSafeAreaInsets();
  const { saveProfile } = useProfile();
  const [step, setStep] = useState<"country" | "area" | "children">("country");
  const [selectedCountry, setSelectedCountry] = useState<Country | "">(detectBrowserLanguage());
  const [selectedArea, setSelectedArea] = useState("");
  const [children, setChildren] = useState<Child[]>([]);
  const [currentChildName, setCurrentChildName] = useState("");
  const [currentChildAge, setCurrentChildAge] = useState("");
  const [isLoadingGps, setIsLoadingGps] = useState(false);
  const [showAreaModal, setShowAreaModal] = useState(false);
  const [showAgeModal, setShowAgeModal] = useState(false);

  const webTopInset = Platform.OS === "web" ? 67 : 0;
  const lang = (selectedCountry || "JP") as Country;
  const strings = t(lang);

  async function handleAutoDetectLocation() {
    setIsLoadingGps(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    
    try {
      const result = await getCurrentCountryAndArea();
      if (result) {
        setSelectedCountry(result.country);
        setSelectedArea(result.area);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        setTimeout(() => setStep("area"), 300);
      } else {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      }
    } catch (error) {
      console.error("Auto-detect error:", error);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setIsLoadingGps(false);
    }
  }

  async function handleUseGps() {
    if (!selectedCountry) return;
    
    setIsLoadingGps(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    
    try {
      const area = await getCurrentArea(selectedCountry);
      if (area) {
        setSelectedArea(area);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } else {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      }
    } catch (error) {
      console.error("GPS error:", error);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setIsLoadingGps(false);
    }
  }

  async function handleComplete() {
    if (!selectedCountry || !selectedArea) return;
    await saveProfile({
      country: selectedCountry,
      area: selectedArea,
      children,
    });
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    router.replace("/(tabs)");
  }

  function handleSkipChildren() {
    if (!selectedCountry || !selectedArea) return;
    handleComplete();
  }

  function handleSelectCountry(id: Country) {
    setSelectedCountry(id);
    setSelectedArea("");
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setTimeout(() => setStep("area"), 300);
  }

  function handleSelectArea(area: string) {
    if (!area) return;
    setSelectedArea(area);
    setShowAreaModal(false);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }

  function handleContinueToChildren() {
    if (!selectedArea) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setStep("children");
  }

  function handleAddChild() {
    if (!currentChildAge) return;
    
    const newChild: Child = {
      id: Date.now().toString(),
      name: currentChildName.trim() || (selectedCountry === "JP" ? "お子さん" : "Child"),
      ageGroup: currentChildAge,
    };
    
    setChildren([...children, newChild]);
    setCurrentChildName("");
    setCurrentChildAge("");
    setShowAgeModal(false);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }

  function handleRemoveChild(id: string) {
    setChildren(children.filter(c => c.id !== id));
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }

  function handleSkipAddMore() {
    if (children.length === 0) return;
    handleComplete();
  }

  function getTitle() {
    if (step === "country") return strings.onboarding.titleCountry;
    if (step === "area") return strings.onboarding.titleArea;
    return strings.onboarding.titleChildren;
  }

  function getSubtitle() {
    if (step === "country") return strings.onboarding.subtitleCountry;
    if (step === "area") return strings.onboarding.subtitleArea;
    return strings.onboarding.subtitleChildren;
  }

  const stepIndex = step === "country" ? 0 : step === "area" ? 1 : 2;

  return (
    <View style={[styles.container, { paddingTop: insets.top + webTopInset }]}>
      <View style={styles.header}>
        <View style={styles.iconContainer}>
          <Ionicons name="shield-checkmark" size={36} color={Colors.primary} />
        </View>
        <Text style={styles.title}>{getTitle()}</Text>
        <Text style={styles.subtitle}>{getSubtitle()}</Text>
      </View>

      <View style={styles.progressContainer}>
        {[0, 1, 2].map((i) => (
          <React.Fragment key={i}>
            {i > 0 && <View style={styles.progressLine} />}
            <View
              style={[
                styles.progressDot,
                stepIndex === i && styles.progressDotActive,
                stepIndex > i && styles.progressDotDone,
              ]}
            />
          </React.Fragment>
        ))}
      </View>

      {step === "country" && (
        <View style={styles.countryContainer}>
          <Pressable
            style={({ pressed }) => [
              styles.gpsButton,
              pressed && styles.cardPressed,
              isLoadingGps && styles.gpsButtonDisabled,
            ]}
            onPress={handleAutoDetectLocation}
            disabled={isLoadingGps}
          >
            {isLoadingGps ? (
              <ActivityIndicator size="small" color={Colors.primary} />
            ) : (
              <Ionicons name="location" size={20} color={Colors.primary} />
            )}
            <Text style={styles.gpsButtonText}>
              {isLoadingGps ? strings.onboarding.gpsLoading : strings.onboarding.useGps}
            </Text>
          </Pressable>

          <Text style={styles.orText}>{strings.onboarding.or || "または"}</Text>

          {COUNTRIES.map((c) => (
            <Pressable
              key={c.id}
              style={({ pressed }) => [
                styles.countryButton,
                selectedCountry === c.id && styles.countryButtonSelected,
                pressed && styles.cardPressed,
              ]}
              onPress={() => handleSelectCountry(c.id)}
            >
              <Ionicons
                name="globe"
                size={20}
                color={
                  selectedCountry === c.id ? Colors.primary : Colors.textSecondary
                }
              />
              <Text
                style={[
                  styles.countryButtonText,
                  selectedCountry === c.id && styles.countryButtonTextSelected,
                ]}
              >
                {c.label}
              </Text>
              {selectedCountry === c.id && (
                <Ionicons
                  name="checkmark-circle"
                  size={20}
                  color={Colors.primary}
                />
              )}
            </Pressable>
          ))}
        </View>
      )}

      {step === "area" && (
        <View style={styles.areaContainer}>
          <Pressable
            style={styles.backButton}
            onPress={() => setStep("country")}
          >
            <Ionicons name="arrow-back" size={20} color={Colors.primary} />
            <Text style={styles.backText}>{strings.onboarding.backCountry}</Text>
          </Pressable>
          
          <Pressable
            style={({ pressed }) => [
              styles.gpsButton,
              pressed && styles.cardPressed,
              isLoadingGps && styles.gpsButtonDisabled,
            ]}
            onPress={handleUseGps}
            disabled={isLoadingGps}
          >
            {isLoadingGps ? (
              <ActivityIndicator size="small" color={Colors.primary} />
            ) : (
              <Ionicons name="location" size={20} color={Colors.primary} />
            )}
            <Text style={styles.gpsButtonText}>
              {isLoadingGps ? strings.onboarding.gpsLoading : strings.onboarding.useGps}
            </Text>
          </Pressable>

          <Text style={styles.orText}>{strings.onboarding.or || "または"}</Text>

          <Pressable
            style={({ pressed }) => [
              styles.areaSelectButton,
              pressed && styles.cardPressed,
            ]}
            onPress={() => setShowAreaModal(true)}
          >
            <Ionicons name="location-outline" size={20} color={Colors.textSecondary} />
            <Text style={[
              styles.areaSelectButtonText,
              selectedArea && styles.areaSelectButtonTextSelected
            ]}>
              {selectedArea || strings.onboarding.selectAgePlaceholder}
            </Text>
            <Ionicons name="chevron-down" size={20} color={Colors.textSecondary} />
          </Pressable>

          <Modal
            visible={showAreaModal}
            animationType="slide"
            transparent={true}
            onRequestClose={() => setShowAreaModal(false)}
          >
            <View style={styles.modalOverlay}>
              <View style={styles.modalContent}>
                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>
                    {selectedCountry === "JP" ? "都道府県を選択" : "Select State"}
                  </Text>
                  <Pressable onPress={() => setShowAreaModal(false)}>
                    <Ionicons name="close" size={28} color={Colors.text} />
                  </Pressable>
                </View>
                <ScrollView style={styles.modalScroll}>
                  {selectedCountry &&
                    AREAS[selectedCountry].map((area) => (
                      <Pressable
                        key={area}
                        style={({ pressed }) => [
                          styles.modalItem,
                          selectedArea === area && styles.modalItemSelected,
                          pressed && styles.cardPressed,
                        ]}
                        onPress={() => handleSelectArea(area)}
                      >
                        <Text
                          style={[
                            styles.modalItemText,
                            selectedArea === area && styles.modalItemTextSelected,
                          ]}
                        >
                          {area}
                        </Text>
                        {selectedArea === area && (
                          <Ionicons
                            name="checkmark"
                            size={24}
                            color={Colors.primary}
                          />
                        )}
                      </Pressable>
                    ))}
                </ScrollView>
              </View>
            </View>
          </Modal>
        </View>
      )}

      {step === "children" && (
        <ScrollView style={styles.childrenScrollContainer}>
          <View style={styles.childrenContainer}>
            <Pressable
              style={styles.backButton}
              onPress={() => setStep("area")}
            >
              <Ionicons name="arrow-back" size={20} color={Colors.primary} />
              <Text style={styles.backText}>{strings.onboarding.backAge}</Text>
            </Pressable>

            {/* Skip Button */}
            <Pressable
              style={styles.skipButton}
              onPress={handleSkipChildren}
            >
              <Text style={styles.skipButtonText}>
                {strings.onboarding.skipForNow}
              </Text>
            </Pressable>

            {/* Registered Children */}
            {children.map((child) => (
              <View key={child.id} style={styles.childCard}>
                <Ionicons name="person" size={20} color={Colors.primary} />
                <View style={styles.childInfo}>
                  <Text style={styles.childName}>{child.name}</Text>
                  <Text style={styles.childAge}>{child.ageGroup}</Text>
                </View>
                <Pressable
                  onPress={() => handleRemoveChild(child.id)}
                  style={styles.removeButton}
                >
                  <Ionicons name="close-circle" size={24} color={Colors.danger} />
                </Pressable>
              </View>
            ))}

            {/* Add Child Form */}
            <View style={styles.addChildForm}>
              <Text style={styles.formLabel}>
                {strings.onboarding.childName}
              </Text>
              <TextInput
                style={styles.textInput}
                value={currentChildName}
                onChangeText={setCurrentChildName}
                placeholder={strings.onboarding.childNamePlaceholder}
                placeholderTextColor={Colors.textTertiary}
              />

              <Text style={styles.formLabel}>
                {strings.onboarding.selectAge}
              </Text>
              <Pressable
                style={styles.ageSelectButton}
                onPress={() => setShowAgeModal(true)}
              >
                <Text style={[
                  styles.ageSelectButtonText,
                  currentChildAge && styles.ageSelectButtonTextSelected
                ]}>
                  {currentChildAge || strings.onboarding.selectAgePlaceholder}
                </Text>
                <Ionicons name="chevron-down" size={20} color={Colors.textSecondary} />
              </Pressable>

              <Pressable
                style={[
                  styles.addButton,
                  !currentChildAge && styles.addButtonDisabled,
                ]}
                onPress={handleAddChild}
                disabled={!currentChildAge}
              >
                <Ionicons name="add-circle" size={20} color={Colors.white} />
                <Text style={styles.addButtonText}>
                  {strings.onboarding.addChild}
                </Text>
              </Pressable>
            </View>

            <Modal
              visible={showAgeModal}
              animationType="slide"
              transparent={true}
              onRequestClose={() => setShowAgeModal(false)}
            >
              <View style={styles.modalOverlay}>
                <View style={styles.modalContent}>
                  <View style={styles.modalHeader}>
                    <Text style={styles.modalTitle}>
                      {strings.onboarding.selectAge}
                    </Text>
                    <Pressable onPress={() => setShowAgeModal(false)}>
                      <Ionicons name="close" size={28} color={Colors.text} />
                    </Pressable>
                  </View>
                  <ScrollView style={styles.modalScroll}>
                    {selectedCountry &&
                      AGE_GROUPS[selectedCountry].map((group) => (
                        <Pressable
                          key={group.id}
                          style={({ pressed }) => [
                            styles.modalItem,
                            currentChildAge === group.label && styles.modalItemSelected,
                            pressed && styles.cardPressed,
                          ]}
                          onPress={() => {
                            setCurrentChildAge(group.label);
                            setShowAgeModal(false);
                          }}
                        >
                          <Text
                            style={[
                              styles.modalItemText,
                              currentChildAge === group.label && styles.modalItemTextSelected,
                            ]}
                          >
                            {group.label}
                          </Text>
                          {currentChildAge === group.label && (
                            <Ionicons
                              name="checkmark"
                              size={24}
                              color={Colors.primary}
                            />
                          )}
                        </Pressable>
                      ))}
                  </ScrollView>
                </View>
              </View>
            </Modal>
          </View>
        </ScrollView>
      )}

      {step === "area" && selectedArea && (
        <View
          style={[
            styles.bottomBar,
            {
              paddingBottom: Math.max(
                insets.bottom,
                Platform.OS === "web" ? 34 : 16
              ),
            },
          ]}
        >
          <Pressable
            style={({ pressed }) => [
              styles.startButton,
              pressed && { opacity: 0.9, transform: [{ scale: 0.98 }] },
            ]}
            onPress={handleContinueToChildren}
          >
            <Text style={styles.startButtonText}>
              {strings.onboarding.continue}
            </Text>
            <Ionicons name="arrow-forward" size={20} color={Colors.white} />
          </Pressable>
        </View>
      )}

      {step === "children" && children.length > 0 && (
        <View
          style={[
            styles.bottomBar,
            {
              paddingBottom: Math.max(
                insets.bottom,
                Platform.OS === "web" ? 34 : 16
              ),
            },
          ]}
        >
          <Pressable
            style={({ pressed }) => [
              styles.startButton,
              pressed && { opacity: 0.9, transform: [{ scale: 0.98 }] },
            ]}
            onPress={handleComplete}
          >
            <Text style={styles.startButtonText}>
              {strings.onboarding.start}
            </Text>
            <Ionicons name="arrow-forward" size={20} color={Colors.white} />
          </Pressable>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 16,
  },
  iconContainer: {
    width: 64,
    height: 64,
    borderRadius: 20,
    backgroundColor: Colors.primaryBg,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
  },
  title: {
    fontSize: 26,
    fontFamily: "Inter_700Bold",
    color: Colors.text,
    lineHeight: 36,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 15,
    fontFamily: "Inter_400Regular",
    color: Colors.textSecondary,
    lineHeight: 22,
  },
  progressContainer: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 24,
    marginBottom: 24,
  },
  progressDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: Colors.border,
  },
  progressDotActive: {
    backgroundColor: Colors.primary,
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  progressDotDone: {
    backgroundColor: Colors.primaryLight,
  },
  progressLine: {
    width: 30,
    height: 2,
    backgroundColor: Colors.border,
    marginHorizontal: 6,
  },
  countryContainer: {
    paddingHorizontal: 24,
    gap: 12,
  },
  areaContainer: {
    flex: 1,
    paddingHorizontal: 24,
  },
  childrenScrollContainer: {
    flex: 1,
  },
  childrenContainer: {
    paddingHorizontal: 24,
    paddingBottom: 100,
    gap: 12,
  },
  skipButton: {
    alignSelf: "flex-end",
    paddingVertical: 8,
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  skipButtonText: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
    color: Colors.primary,
  },
  backButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginBottom: 12,
  },
  backText: {
    fontSize: 14,
    fontFamily: "Inter_500Medium",
    color: Colors.primary,
  },
  gpsButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: Colors.primaryBg,
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 20,
    marginBottom: 16,
    borderWidth: 1.5,
    borderColor: Colors.primary,
  },
  gpsButtonDisabled: {
    opacity: 0.6,
  },
  gpsButtonText: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
    color: Colors.primary,
  },
  orText: {
    fontSize: 14,
    fontFamily: "Inter_500Medium",
    color: Colors.textTertiary,
    textAlign: "center",
    marginVertical: 12,
  },
  countryButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: Colors.surface,
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 20,
    marginBottom: 10,
    borderWidth: 2,
    borderColor: Colors.border,
  },
  countryButtonSelected: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primaryBg,
  },
  countryButtonText: {
    flex: 1,
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
    color: Colors.text,
  },
  countryButtonTextSelected: {
    color: Colors.primary,
  },
  areaSelectButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: Colors.surface,
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderWidth: 2,
    borderColor: Colors.border,
  },
  areaSelectButtonText: {
    flex: 1,
    fontSize: 16,
    fontFamily: "Inter_500Medium",
    color: Colors.textTertiary,
  },
  areaSelectButtonTextSelected: {
    color: Colors.text,
  },
  cardPressed: {
    opacity: 0.8,
    transform: [{ scale: 0.98 }],
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: Colors.background,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: "80%",
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 24,
    paddingVertical: 20,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  modalTitle: {
    fontSize: 20,
    fontFamily: "Inter_700Bold",
    color: Colors.text,
  },
  modalScroll: {
    paddingHorizontal: 24,
  },
  modalItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  modalItemSelected: {
    backgroundColor: Colors.primaryBg,
  },
  modalItemText: {
    fontSize: 16,
    fontFamily: "Inter_500Medium",
    color: Colors.text,
  },
  modalItemTextSelected: {
    color: Colors.primary,
    fontFamily: "Inter_600SemiBold",
  },
  childCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 16,
    gap: 12,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  childInfo: {
    flex: 1,
  },
  childName: {
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
    color: Colors.text,
    marginBottom: 2,
  },
  childAge: {
    fontSize: 14,
    fontFamily: "Inter_500Medium",
    color: Colors.textSecondary,
  },
  removeButton: {
    padding: 4,
  },
  addChildForm: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 20,
    marginTop: 8,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  formLabel: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
    color: Colors.text,
    marginBottom: 8,
    marginTop: 12,
  },
  textInput: {
    backgroundColor: Colors.background,
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    fontSize: 16,
    fontFamily: "Inter_500Medium",
    color: Colors.text,
    borderWidth: 1.5,
    borderColor: Colors.border,
  },
  ageSelectButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: Colors.background,
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderWidth: 1.5,
    borderColor: Colors.border,
  },
  ageSelectButtonText: {
    fontSize: 16,
    fontFamily: "Inter_500Medium",
    color: Colors.textTertiary,
  },
  ageSelectButtonTextSelected: {
    color: Colors.text,
  },
  addButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: Colors.primary,
    borderRadius: 12,
    paddingVertical: 14,
    marginTop: 20,
  },
  addButtonDisabled: {
    opacity: 0.5,
  },
  addButtonText: {
    fontSize: 16,
    fontFamily: "Inter_700Bold",
    color: Colors.white,
  },
  bottomBar: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 24,
    paddingTop: 16,
    backgroundColor: Colors.background,
    borderTopWidth: 1,
    borderTopColor: Colors.borderLight,
  },
  startButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Colors.primary,
    borderRadius: 14,
    paddingVertical: 16,
    gap: 8,
  },
  startButtonText: {
    fontSize: 17,
    fontFamily: "Inter_700Bold",
    color: Colors.white,
  },
});
