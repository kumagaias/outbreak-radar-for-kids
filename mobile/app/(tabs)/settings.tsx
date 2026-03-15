import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Alert,
  Platform,
  Modal,
  TextInput,
  Switch,
  ActivityIndicator,
} from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { Colors } from "@/constants/colors";
import { useProfile, type Child } from "@/lib/profile-context";
import { t, type I18nStrings } from "@/lib/i18n";
import { AGE_GROUPS, AREAS } from "@/lib/mock-data";
import { getCurrentArea } from "@/lib/location";
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const { profile, saveProfile, clearProfile } = useProfile();
  const [showAddChildModal, setShowAddChildModal] = useState(false);
  const [showAgeModal, setShowAgeModal] = useState(false);
  const [showAreaModal, setShowAreaModal] = useState(false);
  const [currentChildName, setCurrentChildName] = useState("");
  const [currentChildAge, setCurrentChildAge] = useState("");
  const [selectedArea, setSelectedArea] = useState("");
  const [isLoadingGps, setIsLoadingGps] = useState(false);
  
  const strings: I18nStrings = profile ? t(profile.country) : t("JP");

  async function handleReset() {
    if (Platform.OS === "web") {
      const confirmed = window.confirm(
        strings.settings.resetConfirmMessage
      );
      if (confirmed) {
        await clearProfile();
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        router.replace("/onboarding");
      }
    } else {
      Alert.alert(
        strings.settings.resetConfirmTitle,
        strings.settings.resetConfirmMessage,
        [
          {
            text: strings.settings.cancel,
            style: "cancel",
          },
          {
            text: strings.settings.reset,
            style: "destructive",
            onPress: async () => {
              await clearProfile();
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              router.replace("/onboarding");
            },
          },
        ]
      );
    }
  }

  async function handleClearCache() {
    const message = profile?.country === "JP" 
      ? "すべてのキャッシュをクリアしますか？\n次回起動時に推奨事項が再生成されます。"
      : "Clear all cached recommendations?\nRecommendations will be regenerated on next launch.";
    
    const title = profile?.country === "JP" ? "キャッシュクリア" : "Clear Cache";
    
    if (Platform.OS === "web") {
      const confirmed = window.confirm(message);
      if (confirmed) {
        try {
          // Clear all recommendation cache keys
          const allKeys = await AsyncStorage.getAllKeys();
          const cacheKeys = allKeys.filter(key => key.startsWith('rec_'));
          await AsyncStorage.multiRemove(cacheKeys);
          
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          
          Alert.alert(
            title,
            profile?.country === "JP" 
              ? `${cacheKeys.length}件のキャッシュをクリアしました`
              : `Cleared ${cacheKeys.length} cached items`
          );
        } catch (error) {
          console.error('Failed to clear cache:', error);
          Alert.alert(
            "Error",
            profile?.country === "JP" 
              ? "キャッシュのクリアに失敗しました"
              : "Failed to clear cache"
          );
        }
      }
    } else {
      Alert.alert(
        title,
        message,
        [
          {
            text: strings.settings.cancel,
            style: "cancel",
          },
          {
            text: profile?.country === "JP" ? "クリア" : "Clear",
            style: "destructive",
            onPress: async () => {
              try {
                // Clear all recommendation cache keys
                const allKeys = await AsyncStorage.getAllKeys();
                const cacheKeys = allKeys.filter(key => key.startsWith('rec_'));
                await AsyncStorage.multiRemove(cacheKeys);
                
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                
                Alert.alert(
                  title,
                  profile?.country === "JP" 
                    ? `${cacheKeys.length}件のキャッシュをクリアしました`
                    : `Cleared ${cacheKeys.length} cached items`
                );
              } catch (error) {
                console.error('Failed to clear cache:', error);
                Alert.alert(
                  "Error",
                  profile?.country === "JP" 
                    ? "キャッシュのクリアに失敗しました"
                    : "Failed to clear cache"
                );
              }
            },
          },
        ]
      );
    }
  }

  async function handleAddChild() {
    if (!profile || !currentChildAge) return;
    
    const newChild: Child = {
      id: Date.now().toString(),
      name: currentChildName.trim() || (profile.country === "JP" ? "お子さん" : "Child"),
      ageGroup: currentChildAge,
    };
    
    await saveProfile({
      ...profile,
      children: [...(profile.children || []), newChild],
    });
    
    setCurrentChildName("");
    setCurrentChildAge("");
    setShowAddChildModal(false);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }

  async function handleRemoveChild(id: string) {
    if (!profile) return;
    
    if (Platform.OS === "web") {
      const confirmed = window.confirm(strings.settings.removeChildMessage);
      if (confirmed) {
        await saveProfile({
          ...profile,
          children: profile.children.filter(c => c.id !== id),
        });
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    } else {
      Alert.alert(
        strings.settings.removeChildTitle,
        strings.settings.removeChildMessage,
        [
          {
            text: strings.settings.cancel,
            style: "cancel",
          },
          {
            text: strings.settings.delete,
            style: "destructive",
            onPress: async () => {
              await saveProfile({
                ...profile,
                children: profile.children.filter(c => c.id !== id),
              });
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            },
          },
        ]
      );
    }
  }

  async function handleToggleNotification(type: "highRisk" | "aiPrediction", value: boolean) {
    if (!profile) return;
    
    await saveProfile({
      ...profile,
      notifications: {
        highRisk: type === "highRisk" ? value : (profile.notifications?.highRisk ?? true),
        aiPrediction: type === "aiPrediction" ? value : (profile.notifications?.aiPrediction ?? true),
      },
    });
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }

  async function handleUseGps() {
    if (!profile) return;
    
    setIsLoadingGps(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    
    try {
      const area = await getCurrentArea(profile.country);
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

  async function handleChangeArea() {
    if (!selectedArea || !profile) return;
    
    await saveProfile({
      ...profile,
      area: selectedArea,
    });
    
    setSelectedArea("");
    setShowAreaModal(false);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[
          styles.content,
          { paddingBottom: insets.bottom + 24 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Profile Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{strings.settings.profile}</Text>
          
          <View style={styles.card}>
            <View style={styles.infoRow}>
              <View style={styles.infoIcon}>
                <Ionicons name="globe" size={20} color={Colors.primary} />
              </View>
              <View style={styles.infoContent}>
                <Text style={styles.infoLabel}>{strings.settings.country}</Text>
                <Text style={styles.infoValue}>
                  {profile?.country === "JP" ? "日本" : "United States"}
                </Text>
              </View>
            </View>

            <View style={styles.divider} />

            <Pressable
              style={({ pressed }) => [
                styles.infoRow,
                pressed && { opacity: 0.8 },
              ]}
              onPress={() => {
                setSelectedArea(profile?.area || "");
                setShowAreaModal(true);
              }}
            >
              <View style={styles.infoIcon}>
                <Ionicons name="location" size={20} color={Colors.primary} />
              </View>
              <View style={styles.infoContent}>
                <Text style={styles.infoLabel}>{strings.settings.area}</Text>
                <Text style={styles.infoValue}>{profile?.area || "-"}</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={Colors.textSecondary} />
            </Pressable>
          </View>
        </View>

        {/* Children Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>
              {strings.settings.children}
            </Text>
            <Pressable
              style={styles.addButton}
              onPress={() => setShowAddChildModal(true)}
            >
              <Ionicons name="add-circle" size={20} color={Colors.primary} />
              <Text style={styles.addButtonText}>
                {strings.settings.addChild}
              </Text>
            </Pressable>
          </View>
          
          {profile?.children && profile.children.length > 0 ? (
            <View style={styles.card}>
              {profile.children.map((child, index) => (
                <React.Fragment key={child.id}>
                  {index > 0 && <View style={styles.divider} />}
                  <View style={styles.childRow}>
                    <View style={styles.infoIcon}>
                      <Ionicons name="person" size={20} color={Colors.primary} />
                    </View>
                    <View style={styles.infoContent}>
                      <Text style={styles.infoValue}>{child.name}</Text>
                      <Text style={styles.infoLabel}>{child.ageGroup}</Text>
                    </View>
                    <Pressable
                      onPress={() => handleRemoveChild(child.id)}
                      style={styles.removeButton}
                    >
                      <Ionicons name="close-circle" size={24} color={Colors.danger} />
                    </Pressable>
                  </View>
                </React.Fragment>
              ))}
            </View>
          ) : (
            <Pressable
              style={({ pressed }) => [
                styles.emptyCard,
                pressed && { opacity: 0.8 },
              ]}
              onPress={() => setShowAddChildModal(true)}
            >
              <Ionicons name="person-add" size={32} color={Colors.primary} />
              <Text style={styles.emptyText}>
                {strings.settings.noChildren}
              </Text>
              <Text style={styles.emptyPurpose}>
                {strings.settings.childrenPurpose}
              </Text>
            </Pressable>
          )}
        </View>

        {/* Notifications Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{strings.settings.notifications}</Text>
          
          <View style={styles.card}>
            <View style={styles.notificationRow}>
              <View style={styles.notificationIcon}>
                <Ionicons name="notifications" size={20} color={Colors.primary} />
              </View>
              <View style={styles.notificationContent}>
                <Text style={styles.notificationTitle}>
                  {strings.settings.notifyHighRisk}
                </Text>
                <Text style={styles.notificationDesc}>
                  {strings.settings.notifyHighRiskDesc}
                </Text>
              </View>
              <Switch
                value={profile?.notifications?.highRisk ?? true}
                onValueChange={(value) => handleToggleNotification("highRisk", value)}
                trackColor={{ false: Colors.border, true: Colors.primaryLight }}
                thumbColor={profile?.notifications?.highRisk ?? true ? Colors.primary : Colors.textTertiary}
              />
            </View>

            <View style={styles.divider} />

            <View style={styles.notificationRow}>
              <View style={styles.notificationIcon}>
                <Ionicons name="sparkles" size={20} color={Colors.primary} />
              </View>
              <View style={styles.notificationContent}>
                <Text style={styles.notificationTitle}>
                  {strings.settings.notifyAiPrediction}
                </Text>
                <Text style={styles.notificationDesc}>
                  {strings.settings.notifyAiPredictionDesc}
                </Text>
              </View>
              <Switch
                value={profile?.notifications?.aiPrediction ?? true}
                onValueChange={(value) => handleToggleNotification("aiPrediction", value)}
                trackColor={{ false: Colors.border, true: Colors.primaryLight }}
                thumbColor={profile?.notifications?.aiPrediction ?? true ? Colors.primary : Colors.textTertiary}
              />
            </View>
          </View>
        </View>

        {/* Info Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{strings.settings.info}</Text>
          
          <View style={styles.card}>
            <View style={styles.infoRow}>
              <View style={styles.infoIcon}>
                <Ionicons name="information-circle" size={20} color={Colors.textSecondary} />
              </View>
              <View style={styles.infoContent}>
                <Text style={styles.infoLabel}>{strings.settings.version}</Text>
                <Text style={styles.infoValue}>1.0.0</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Privacy Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{strings.settings.privacy}</Text>
          
          <View style={styles.card}>
            <Text style={styles.privacyText}>
              {strings.settings.privacyDesc}
            </Text>
          </View>
        </View>

        {/* Development Section */}
        {(true || __DEV__) && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>開発用 / Development</Text>
            
            <View style={styles.card}>
              <Pressable
                style={({ pressed }) => [
                  styles.devButton,
                  pressed && { opacity: 0.8 },
                ]}
                onPress={handleClearCache}
              >
                <View style={styles.devButtonIcon}>
                  <Ionicons name="trash-outline" size={20} color={Colors.warning} />
                </View>
                <View style={styles.devButtonContent}>
                  <Text style={styles.devButtonTitle}>
                    {profile?.country === "JP" ? "キャッシュをクリア" : "Clear Cache"}
                  </Text>
                  <Text style={styles.devButtonDesc}>
                    {profile?.country === "JP" 
                      ? "保存された推奨事項をすべて削除"
                      : "Delete all cached recommendations"}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color={Colors.textSecondary} />
              </Pressable>

              <View style={styles.divider} />

              <Pressable
                style={({ pressed }) => [
                  styles.devButton,
                  pressed && { opacity: 0.8 },
                ]}
                onPress={handleReset}
              >
                <View style={[styles.devButtonIcon, { backgroundColor: Colors.dangerLight }]}>
                  <Ionicons name="refresh" size={20} color={Colors.danger} />
                </View>
                <View style={styles.devButtonContent}>
                  <Text style={[styles.devButtonTitle, { color: Colors.danger }]}>
                    {strings.settings.resetProfile}
                  </Text>
                  <Text style={styles.devButtonDesc}>
                    {profile?.country === "JP" 
                      ? "プロフィールを削除してオンボーディングに戻る"
                      : "Delete profile and return to onboarding"}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color={Colors.textSecondary} />
              </Pressable>
            </View>
          </View>
        )}

        {/* Disclaimer */}
        <View style={styles.disclaimerContainer}>
          <Ionicons name="alert-circle" size={16} color={Colors.textTertiary} />
          <Text style={styles.disclaimerText}>{strings.disclaimer}</Text>
        </View>
      </ScrollView>

      {/* Add Child Modal */}
      <Modal
        visible={showAddChildModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowAddChildModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {strings.settings.addChildTitle}
              </Text>
              <Pressable onPress={() => setShowAddChildModal(false)}>
                <Ionicons name="close" size={28} color={Colors.text} />
              </Pressable>
            </View>
            
            <View style={styles.modalBody}>
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
                  styles.saveButton,
                  !currentChildAge && styles.saveButtonDisabled,
                ]}
                onPress={handleAddChild}
                disabled={!currentChildAge}
              >
                <Text style={styles.saveButtonText}>
                  {strings.onboarding.addChild}
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* Area Change Modal */}
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
                {profile?.country === "JP" ? "都道府県を変更" : "Change State"}
              </Text>
              <Pressable onPress={() => setShowAreaModal(false)}>
                <Ionicons name="close" size={28} color={Colors.text} />
              </Pressable>
            </View>

            <View style={styles.modalBody}>
              <Pressable
                style={({ pressed }) => [
                  styles.gpsButton,
                  pressed && { opacity: 0.8 },
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
            </View>

            <ScrollView style={styles.modalScroll}>
              {profile?.country &&
                AREAS[profile.country].map((area) => (
                  <Pressable
                    key={area}
                    style={({ pressed }) => [
                      styles.modalItem,
                      selectedArea === area && styles.modalItemSelected,
                      pressed && { opacity: 0.8 },
                    ]}
                    onPress={() => setSelectedArea(area)}
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

            <View style={styles.modalFooter}>
              <Pressable
                style={[
                  styles.saveButton,
                  !selectedArea && styles.saveButtonDisabled,
                ]}
                onPress={handleChangeArea}
                disabled={!selectedArea}
              >
                <Text style={styles.saveButtonText}>
                  {profile?.country === "JP" ? "変更する" : "Change"}
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* Age Selection Modal */}
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
              {profile?.country &&
                AGE_GROUPS[profile.country].map((group) => (
                  <Pressable
                    key={group.id}
                    style={({ pressed }) => [
                      styles.modalItem,
                      currentChildAge === group.label && styles.modalItemSelected,
                      pressed && { opacity: 0.8 },
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
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 24,
    paddingTop: 24,
  },
  section: {
    marginBottom: 32,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
    color: Colors.textSecondary,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  addButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  addButtonText: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
    color: Colors.primary,
  },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 16,
    shadowColor: Colors.cardShadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 8,
    elevation: 2,
  },
  emptyCard: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 32,
    alignItems: "center",
    borderWidth: 2,
    borderColor: Colors.primary,
    borderStyle: "dashed",
  },
  emptyText: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
    color: Colors.text,
    marginTop: 12,
    textAlign: "center",
  },
  emptyPurpose: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: Colors.textSecondary,
    marginTop: 8,
    textAlign: "center",
    lineHeight: 18,
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
  },
  childRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
  },
  infoIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: Colors.primaryBg,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  infoContent: {
    flex: 1,
  },
  infoLabel: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: Colors.textSecondary,
    marginBottom: 2,
  },
  infoValue: {
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
    color: Colors.text,
  },
  removeButton: {
    padding: 4,
  },
  divider: {
    height: 1,
    backgroundColor: Colors.borderLight,
    marginVertical: 8,
  },
  notificationRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
  },
  notificationIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: Colors.primaryBg,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  notificationContent: {
    flex: 1,
    marginRight: 12,
  },
  notificationTitle: {
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
    color: Colors.text,
    marginBottom: 4,
  },
  notificationDesc: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: Colors.textSecondary,
    lineHeight: 18,
  },
  privacyText: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: Colors.textSecondary,
    lineHeight: 20,
  },
  resetButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: Colors.dangerLight,
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderWidth: 1.5,
    borderColor: Colors.danger,
  },
  resetButtonText: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
    color: Colors.danger,
  },
  devButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
  },
  devButtonIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: Colors.warningLight,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  devButtonContent: {
    flex: 1,
  },
  devButtonTitle: {
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
    color: Colors.text,
    marginBottom: 2,
  },
  devButtonDesc: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: Colors.textSecondary,
    lineHeight: 18,
  },
  disclaimerContainer: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    backgroundColor: Colors.surfaceSecondary,
    borderRadius: 12,
    padding: 16,
    marginTop: 8,
  },
  disclaimerText: {
    flex: 1,
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: Colors.textTertiary,
    lineHeight: 18,
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
  modalBody: {
    padding: 24,
  },
  modalFooter: {
    padding: 24,
    paddingTop: 0,
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
    marginVertical: 16,
  },
  formLabel: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
    color: Colors.text,
    marginBottom: 8,
    marginTop: 12,
  },
  textInput: {
    backgroundColor: Colors.surface,
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
    backgroundColor: Colors.surface,
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
  saveButton: {
    backgroundColor: Colors.primary,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 24,
  },
  saveButtonDisabled: {
    opacity: 0.5,
  },
  saveButtonText: {
    fontSize: 16,
    fontFamily: "Inter_700Bold",
    color: Colors.white,
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
});
