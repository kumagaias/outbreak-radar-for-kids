import React, { createContext, useContext, useState, useEffect, useMemo, ReactNode } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import type { Country } from "@/lib/mock-data";

export interface Child {
  id: string;
  name: string;
  ageGroup: string;
}

export interface Profile {
  country: Country;
  area: string;
  children: Child[];
  notifications?: {
    highRisk: boolean;
    aiPrediction: boolean;
  };
}

interface ProfileContextValue {
  profile: Profile | null;
  isLoading: boolean;
  saveProfile: (profile: Profile) => Promise<void>;
  clearProfile: () => Promise<void>;
}

const ProfileContext = createContext<ProfileContextValue | null>(null);

const PROFILE_KEY = "@outbreak_radar_profile";

export function ProfileProvider({ children }: { children: ReactNode }) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadProfile();
  }, []);

  async function loadProfile() {
    try {
      const stored = await AsyncStorage.getItem(PROFILE_KEY);
      if (stored) {
        setProfile(JSON.parse(stored));
      }
    } catch (e) {
      console.error("Failed to load profile:", e);
    } finally {
      setIsLoading(false);
    }
  }

  async function saveProfile(newProfile: Profile) {
    try {
      await AsyncStorage.setItem(PROFILE_KEY, JSON.stringify(newProfile));
      setProfile(newProfile);
    } catch (e) {
      console.error("Failed to save profile:", e);
    }
  }

  async function clearProfile() {
    try {
      await AsyncStorage.removeItem(PROFILE_KEY);
      setProfile(null);
    } catch (e) {
      console.error("Failed to clear profile:", e);
    }
  }

  const value = useMemo(
    () => ({ profile, isLoading, saveProfile, clearProfile }),
    [profile, isLoading]
  );

  return (
    <ProfileContext.Provider value={value}>{children}</ProfileContext.Provider>
  );
}

export function useProfile() {
  const context = useContext(ProfileContext);
  if (!context) {
    throw new Error("useProfile must be used within a ProfileProvider");
  }
  return context;
}
