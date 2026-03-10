import type { Country, OutbreakData } from "./mock-data";
import { DISEASES, getDiseaseName } from "./mock-data";

export interface RecommendationRequest {
  area: string;
  country: Country;
  outbreaks: OutbreakData[];
  childrenAges?: string[];
}

export interface Recommendation {
  summary: string;
  actions: string[];
  priority: "high" | "medium" | "low";
}

// Mock implementation - generates recommendations based on outbreak data
export async function generateRecommendations(
  request: RecommendationRequest
): Promise<Recommendation> {
  const isJapanese = request.country === "JP";
  const highRiskCount = request.outbreaks.filter((o) => o.level === "high").length;
  const mediumRiskCount = request.outbreaks.filter((o) => o.level === "medium").length;
  const hasChildren = request.childrenAges && request.childrenAges.length > 0;

  // Get disease names for context
  const diseaseNames = request.outbreaks
    .slice(0, 3)
    .map((outbreak) => {
      const disease = DISEASES.find((d) => d.id === outbreak.diseaseId);
      return disease ? getDiseaseName(disease, request.country) : "";
    })
    .filter(Boolean);

  // High risk scenario
  if (highRiskCount > 0) {
    return {
      summary: isJapanese
        ? `${request.area}では${diseaseNames.join("、")}など${highRiskCount}件の高リスク感染症が報告されています。特に注意が必要です。`
        : `${highRiskCount} high-risk outbreaks reported in ${request.area}, including ${diseaseNames.join(", ")}. Extra caution needed.`,
      actions: isJapanese
        ? [
            "こまめな手洗いと手指消毒を徹底する",
            "人混みではマスクを着用する",
            "体調不良時は外出を控える",
            hasChildren ? "お子様の健康状態を毎日チェックする" : "十分な睡眠と栄養バランスの良い食事を心がける",
            "室内の換気を定期的に行う",
          ]
        : [
            "Wash hands frequently and use hand sanitizer",
            "Wear masks in crowded places",
            "Stay home when feeling unwell",
            hasChildren ? "Monitor children's health daily" : "Get adequate sleep and maintain a balanced diet",
            "Ensure regular ventilation indoors",
          ],
      priority: "high",
    };
  }

  // Medium risk scenario
  if (mediumRiskCount > 0) {
    return {
      summary: isJapanese
        ? `${request.area}では${diseaseNames.join("、")}などの感染症が流行中です。基本的な予防対策を続けましょう。`
        : `Outbreaks of ${diseaseNames.join(", ")} detected in ${request.area}. Continue basic preventive measures.`,
      actions: isJapanese
        ? [
            "手洗いを習慣化する",
            "換気を心がける",
            hasChildren ? "保育園・学校からの健康情報に注意する" : "体調管理に注意する",
            "タオルやコップの共有を避ける",
          ]
        : [
            "Make handwashing a habit",
            "Ensure proper ventilation",
            hasChildren ? "Stay informed about health updates from school/daycare" : "Monitor your health",
            "Avoid sharing towels and cups",
          ],
      priority: "medium",
    };
  }

  // Low risk scenario
  return {
    summary: isJapanese
      ? `${request.area}では現在、低リスクの感染症が報告されています。引き続き基本的な衛生管理を心がけましょう。`
      : `Low-risk outbreaks in ${request.area}. Continue maintaining basic hygiene practices.`,
    actions: isJapanese
      ? [
          "手洗いを忘れずに",
          "体調の変化に気をつける",
          "規則正しい生活を心がける",
        ]
      : [
          "Remember to wash hands",
          "Watch for health changes",
          "Maintain a regular routine",
        ],
    priority: "low",
  };
}
