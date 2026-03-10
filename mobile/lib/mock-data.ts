export type Country = "JP" | "US";

export const COUNTRIES = [
  { id: "JP" as Country, label: "日本", flag: "JP" },
  { id: "US" as Country, label: "United States", flag: "US" },
] as const;

// Age group categories for different demographics
export type AgeCategory = "infant" | "toddler" | "child" | "teen" | "adult" | "senior";

export interface AgeGroup {
  id: string;
  label: string;
  category: AgeCategory;
  minAge: number;
  maxAge: number | null; // null means no upper limit
}

export const AGE_GROUPS: Record<Country, AgeGroup[]> = {
  JP: [
    { id: "0-1", label: "0〜1歳", category: "infant", minAge: 0, maxAge: 1 },
    { id: "2-3", label: "2〜3歳", category: "toddler", minAge: 2, maxAge: 3 },
    { id: "4-6", label: "4〜6歳", category: "child", minAge: 4, maxAge: 6 },
    { id: "7-12", label: "7〜12歳", category: "child", minAge: 7, maxAge: 12 },
    { id: "13-17", label: "13〜17歳", category: "teen", minAge: 13, maxAge: 17 },
    { id: "18-64", label: "18〜64歳", category: "adult", minAge: 18, maxAge: 64 },
    { id: "65+", label: "65歳以上", category: "senior", minAge: 65, maxAge: null },
  ],
  US: [
    { id: "0-1", label: "0-1 years", category: "infant", minAge: 0, maxAge: 1 },
    { id: "2-3", label: "2-3 years", category: "toddler", minAge: 2, maxAge: 3 },
    { id: "4-6", label: "4-6 years", category: "child", minAge: 4, maxAge: 6 },
    { id: "7-12", label: "7-12 years", category: "child", minAge: 7, maxAge: 12 },
    { id: "13-17", label: "13-17 years", category: "teen", minAge: 13, maxAge: 17 },
    { id: "18-64", label: "18-64 years", category: "adult", minAge: 18, maxAge: 64 },
    { id: "65+", label: "65+ years", category: "senior", minAge: 65, maxAge: null },
  ],
};

export const AREAS: Record<Country, string[]> = {
  JP: [
    "北海道", "青森県", "岩手県", "宮城県", "秋田県", "山形県", "福島県",
    "茨城県", "栃木県", "群馬県", "埼玉県", "千葉県", "東京都", "神奈川県",
    "新潟県", "富山県", "石川県", "福井県", "山梨県", "長野県",
    "岐阜県", "静岡県", "愛知県", "三重県",
    "滋賀県", "京都府", "大阪府", "兵庫県", "奈良県", "和歌山県",
    "鳥取県", "島根県", "岡山県", "広島県", "山口県",
    "徳島県", "香川県", "愛媛県", "高知県",
    "福岡県", "佐賀県", "長崎県", "熊本県", "大分県", "宮崎県", "鹿児島県", "沖縄県",
  ],
  US: [
    "Alabama", "Alaska", "Arizona", "Arkansas", "California", "Colorado",
    "Connecticut", "Delaware", "Florida", "Georgia", "Hawaii", "Idaho",
    "Illinois", "Indiana", "Iowa", "Kansas", "Kentucky", "Louisiana",
    "Maine", "Maryland", "Massachusetts", "Michigan", "Minnesota",
    "Mississippi", "Missouri", "Montana", "Nebraska", "Nevada",
    "New Hampshire", "New Jersey", "New Mexico", "New York",
    "North Carolina", "North Dakota", "Ohio", "Oklahoma", "Oregon",
    "Pennsylvania", "Rhode Island", "South Carolina", "South Dakota",
    "Tennessee", "Texas", "Utah", "Vermont", "Virginia", "Washington",
    "West Virginia", "Wisconsin", "Wyoming",
  ],
};

// Disease data structure with age-specific risk levels
export interface Disease {
  id: string;
  name: string;
  nameEn: string;
  icon: string;
  color: string;
  description: string;
  descriptionEn: string;
  prevention: string[];
  preventionEn: string[];
  // Age-specific risk levels
  riskByAgeCategory: Partial<Record<AgeCategory, "low" | "medium" | "high">>;
}

export const DISEASES: Disease[] = [
  {
    id: "norovirus",
    name: "ノロウイルス",
    nameEn: "Norovirus",
    icon: "alert-circle",
    color: "#F59E0B",
    description: "嘔吐・下痢を主症状とする感染性胃腸炎の原因ウイルスです。感染力が非常に強く、集団生活の場で流行しやすいです。",
    descriptionEn: "A highly contagious virus causing gastroenteritis with vomiting and diarrhea. Spreads easily in group settings.",
    prevention: [
      "手洗いを丁寧に（石けんで30秒以上）",
      "嘔吐物の処理は手袋とマスクを着用",
      "タオルの共有を避ける",
    ],
    preventionEn: [
      "Wash hands thoroughly with soap for 30+ seconds",
      "Use gloves and mask when cleaning vomit",
      "Avoid sharing towels",
    ],
    riskByAgeCategory: {
      infant: "high",
      toddler: "high",
      child: "medium",
      teen: "low",
      adult: "medium",
      senior: "high",
    },
  },
  {
    id: "influenza",
    name: "インフルエンザ",
    nameEn: "Influenza",
    icon: "thermometer",
    color: "#EF4444",
    description: "高熱・倦怠感・関節痛が特徴的なウイルス感染症です。冬季に流行しやすく、重症化することがあります。",
    descriptionEn: "A viral infection marked by high fever, fatigue, and body aches. More common in winter.",
    prevention: [
      "外出後の手洗い・うがいの徹底",
      "十分な睡眠と栄養バランス",
      "人混みではマスクの着用を検討",
    ],
    preventionEn: [
      "Wash hands and gargle after going out",
      "Ensure plenty of sleep and balanced nutrition",
      "Consider wearing a mask in crowded places",
    ],
    riskByAgeCategory: {
      infant: "high",
      toddler: "high",
      child: "medium",
      teen: "low",
      adult: "low",
      senior: "high",
    },
  },
  {
    id: "rsv",
    name: "RSウイルス",
    nameEn: "RSV",
    icon: "cloud",
    color: "#8B5CF6",
    description: "乳幼児に多い呼吸器感染症です。鼻水・咳・発熱が主な症状で、0〜1歳児では重症化リスクがあります。",
    descriptionEn: "A common respiratory infection in infants. Can be serious for children under 1.",
    prevention: [
      "こまめな手洗いと消毒",
      "咳エチケットの実践",
      "おもちゃの定期的な消毒",
    ],
    preventionEn: [
      "Wash and sanitize hands frequently",
      "Practice cough etiquette",
      "Regularly disinfect toys",
    ],
    riskByAgeCategory: {
      infant: "high",
      toddler: "medium",
      child: "low",
      teen: "low",
      adult: "low",
      senior: "low",
    },
  },
  {
    id: "hand-foot-mouth",
    name: "手足口病",
    nameEn: "Hand, Foot & Mouth Disease",
    icon: "hand-left",
    color: "#EC4899",
    description: "手・足・口の中に水疱性の発疹ができるウイルス感染症です。夏に多く、保育園での流行が見られます。",
    descriptionEn: "A viral infection causing blistering rash. Common in summer and spreads easily in daycare.",
    prevention: [
      "手洗いの徹底",
      "タオル・コップの共有を避ける",
      "排泄後の手洗いを丁寧に",
    ],
    preventionEn: [
      "Wash hands thoroughly",
      "Avoid sharing towels and cups",
      "Careful handwashing after diaper changes",
    ],
    riskByAgeCategory: {
      infant: "medium",
      toddler: "high",
      child: "medium",
      teen: "low",
      adult: "low",
      senior: "low",
    },
  },
  {
    id: "covid-19",
    name: "COVID-19",
    nameEn: "COVID-19",
    icon: "shield",
    color: "#DC2626",
    description: "新型コロナウイルス感染症。発熱・咳・倦怠感が主な症状です。高齢者や基礎疾患のある方は重症化リスクがあります。",
    descriptionEn: "Coronavirus disease. Main symptoms include fever, cough, and fatigue. Higher risk for seniors and those with underlying conditions.",
    prevention: [
      "マスクの着用",
      "手洗い・手指消毒の徹底",
      "換気の実施",
      "体調不良時は外出を控える",
    ],
    preventionEn: [
      "Wear a mask",
      "Wash hands and use hand sanitizer",
      "Ensure proper ventilation",
      "Stay home when feeling unwell",
    ],
    riskByAgeCategory: {
      infant: "medium",
      toddler: "low",
      child: "low",
      teen: "low",
      adult: "medium",
      senior: "high",
    },
  },
];

// Helper functions
export function getDiseaseName(disease: Disease, country: Country): string {
  return country === "US" ? disease.nameEn : disease.name;
}

export function getDiseaseDescription(disease: Disease, country: Country): string {
  return country === "US" ? disease.descriptionEn : disease.description;
}

export function getDiseasePrevention(disease: Disease, country: Country): string[] {
  return country === "US" ? disease.preventionEn : disease.prevention;
}

export function getDiseaseRiskForAge(disease: Disease, ageGroupId: string, country: Country): "low" | "medium" | "high" {
  const ageGroup = AGE_GROUPS[country].find(ag => ag.id === ageGroupId);
  if (!ageGroup) return "low";
  
  return disease.riskByAgeCategory[ageGroup.category] || "low";
}

export function getAgeLabel(ageGroupId: string, country: Country): string {
  const group = AGE_GROUPS[country].find(ag => ag.id === ageGroupId);
  return group?.label || ageGroupId;
}

// Outbreak data for map visualization
export interface OutbreakData {
  area: string;
  diseaseId: string;
  level: "low" | "medium" | "high";
  cases: number;
  weeklyChange: number; // percentage
  lastUpdated: Date;
  // 追加の詳細データ
  sewerageVirusLevel?: number; // 下水道ウイルス濃度 (0-100)
  hospitalizations?: number; // 入院者数
  schoolClosures?: number; // 学級閉鎖数
  peakWeek?: string; // ピーク予測週
}

// Mock outbreak data for Japan
export const MOCK_OUTBREAK_DATA_JP: OutbreakData[] = [
  // Tokyo area - high norovirus
  { area: "東京都", diseaseId: "norovirus", level: "high", cases: 245, weeklyChange: 15, lastUpdated: new Date(), sewerageVirusLevel: 78, hospitalizations: 12, schoolClosures: 8, peakWeek: "来週" },
  { area: "東京都", diseaseId: "influenza", level: "medium", cases: 120, weeklyChange: -5, lastUpdated: new Date(), sewerageVirusLevel: 45, hospitalizations: 5, schoolClosures: 3 },
  { area: "東京都", diseaseId: "rsv", level: "low", cases: 30, weeklyChange: 0, lastUpdated: new Date(), sewerageVirusLevel: 22, hospitalizations: 2, schoolClosures: 0 },
  
  // Kanagawa - medium norovirus
  { area: "神奈川県", diseaseId: "norovirus", level: "medium", cases: 180, weeklyChange: 10, lastUpdated: new Date(), sewerageVirusLevel: 62, hospitalizations: 8, schoolClosures: 5 },
  { area: "神奈川県", diseaseId: "influenza", level: "medium", cases: 95, weeklyChange: -3, lastUpdated: new Date(), sewerageVirusLevel: 38, hospitalizations: 4, schoolClosures: 2 },
  { area: "神奈川県", diseaseId: "hand-foot-mouth", level: "low", cases: 25, weeklyChange: 5, lastUpdated: new Date(), sewerageVirusLevel: 18, hospitalizations: 0, schoolClosures: 0 },
  
  // Osaka - high influenza
  { area: "大阪府", diseaseId: "influenza", level: "high", cases: 210, weeklyChange: 20, lastUpdated: new Date(), sewerageVirusLevel: 82, hospitalizations: 15, schoolClosures: 10, peakWeek: "今週" },
  { area: "大阪府", diseaseId: "norovirus", level: "medium", cases: 150, weeklyChange: 8, lastUpdated: new Date(), sewerageVirusLevel: 55, hospitalizations: 7, schoolClosures: 4 },
  { area: "大阪府", diseaseId: "rsv", level: "medium", cases: 65, weeklyChange: 12, lastUpdated: new Date(), sewerageVirusLevel: 48, hospitalizations: 3, schoolClosures: 1 },
  
  // Saitama
  { area: "埼玉県", diseaseId: "norovirus", level: "medium", cases: 135, weeklyChange: 7, lastUpdated: new Date(), sewerageVirusLevel: 58, hospitalizations: 6, schoolClosures: 3 },
  { area: "埼玉県", diseaseId: "influenza", level: "low", cases: 45, weeklyChange: -10, lastUpdated: new Date(), sewerageVirusLevel: 28, hospitalizations: 2, schoolClosures: 1 },
  
  // Chiba
  { area: "千葉県", diseaseId: "norovirus", level: "high", cases: 195, weeklyChange: 18, lastUpdated: new Date(), sewerageVirusLevel: 75, hospitalizations: 10, schoolClosures: 7, peakWeek: "来週" },
  { area: "千葉県", diseaseId: "rsv", level: "medium", cases: 70, weeklyChange: 15, lastUpdated: new Date(), sewerageVirusLevel: 52, hospitalizations: 4, schoolClosures: 2 },
  
  // Hokkaido
  { area: "北海道", diseaseId: "influenza", level: "high", cases: 180, weeklyChange: 25, lastUpdated: new Date(), sewerageVirusLevel: 85, hospitalizations: 14, schoolClosures: 9, peakWeek: "今週" },
  { area: "北海道", diseaseId: "norovirus", level: "low", cases: 40, weeklyChange: -5, lastUpdated: new Date(), sewerageVirusLevel: 25, hospitalizations: 1, schoolClosures: 0 },
  
  // Fukuoka
  { area: "福岡県", diseaseId: "hand-foot-mouth", level: "high", cases: 110, weeklyChange: 30, lastUpdated: new Date(), sewerageVirusLevel: 68, hospitalizations: 3, schoolClosures: 5, peakWeek: "2週間後" },
  { area: "福岡県", diseaseId: "norovirus", level: "medium", cases: 85, weeklyChange: 5, lastUpdated: new Date(), sewerageVirusLevel: 42, hospitalizations: 4, schoolClosures: 2 },
];

// Mock outbreak data for US
export const MOCK_OUTBREAK_DATA_US: OutbreakData[] = [
  // California - high flu
  { area: "California", diseaseId: "influenza", level: "high", cases: 450, weeklyChange: 22, lastUpdated: new Date(), sewerageVirusLevel: 80, hospitalizations: 25, schoolClosures: 15, peakWeek: "next week" },
  { area: "California", diseaseId: "norovirus", level: "medium", cases: 180, weeklyChange: 8, lastUpdated: new Date(), sewerageVirusLevel: 50, hospitalizations: 8, schoolClosures: 5 },
  { area: "California", diseaseId: "rsv", level: "medium", cases: 95, weeklyChange: 10, lastUpdated: new Date(), sewerageVirusLevel: 44, hospitalizations: 6, schoolClosures: 2 },
  
  // New York - high norovirus
  { area: "New York", diseaseId: "norovirus", level: "high", cases: 320, weeklyChange: 18, lastUpdated: new Date(), sewerageVirusLevel: 76, hospitalizations: 18, schoolClosures: 12, peakWeek: "this week" },
  { area: "New York", diseaseId: "influenza", level: "medium", cases: 210, weeklyChange: 5, lastUpdated: new Date(), sewerageVirusLevel: 48, hospitalizations: 10, schoolClosures: 6 },
  { area: "New York", diseaseId: "covid-19", level: "medium", cases: 150, weeklyChange: -3, lastUpdated: new Date(), sewerageVirusLevel: 35, hospitalizations: 8, schoolClosures: 0 },
  
  // Texas
  { area: "Texas", diseaseId: "influenza", level: "medium", cases: 280, weeklyChange: 12, lastUpdated: new Date(), sewerageVirusLevel: 55, hospitalizations: 12, schoolClosures: 7 },
  { area: "Texas", diseaseId: "hand-foot-mouth", level: "high", cases: 140, weeklyChange: 25, lastUpdated: new Date(), sewerageVirusLevel: 65, hospitalizations: 4, schoolClosures: 8, peakWeek: "in 2 weeks" },
  
  // Florida
  { area: "Florida", diseaseId: "norovirus", level: "high", cases: 290, weeklyChange: 20, lastUpdated: new Date(), sewerageVirusLevel: 72, hospitalizations: 15, schoolClosures: 10, peakWeek: "next week" },
  { area: "Florida", diseaseId: "rsv", level: "medium", cases: 110, weeklyChange: 8, lastUpdated: new Date(), sewerageVirusLevel: 46, hospitalizations: 7, schoolClosures: 3 },
];

export function getOutbreakDataForArea(area: string, country: Country): OutbreakData[] {
  const data = country === "JP" ? MOCK_OUTBREAK_DATA_JP : MOCK_OUTBREAK_DATA_US;
  return data.filter(d => d.area === area);
}

export function getOutbreakDataByDisease(diseaseId: string, country: Country): OutbreakData[] {
  const data = country === "JP" ? MOCK_OUTBREAK_DATA_JP : MOCK_OUTBREAK_DATA_US;
  return data.filter(d => d.diseaseId === diseaseId);
}

export function getHighestRiskAreas(country: Country, limit: number = 5): OutbreakData[] {
  const data = country === "JP" ? MOCK_OUTBREAK_DATA_JP : MOCK_OUTBREAK_DATA_US;
  return data
    .filter(d => d.level === "high")
    .sort((a, b) => b.cases - a.cases)
    .slice(0, limit);
}
