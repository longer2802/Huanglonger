import { ageParts, diffDays, formatAge, isValidDate, pregnancyStatus, PHASE_LABEL } from "./dates";
import { cardsForBabyAge, cardsForPostpartumDay, cardsForPregnancyWeek } from "./content";
import { currentCareStage } from "./care";

// Where one person is today, and what applies to them.
export function personContext(person, family, today) {
  if (!person || !family) return null;
  if (person.role === "mother") {
    if (family.stage === "pregnant" && isValidDate(family.edd)) {
      const s = pregnancyStatus(family.edd, today);
      const week = Math.max(0, Math.min(s.weeks, 45));
      return {
        kind: "pregnant",
        headline: `孕 ${s.weeks} 週 + ${s.days} 天`,
        sub: s.overdue ? `已超過預產期 ${-s.daysToEdd} 天` : `${PHASE_LABEL[s.phase]}・距預產期 ${s.daysToEdd} 天`,
        pregWeek: s.weeks,
        status: s,
        cards: cardsForPregnancyWeek(week),
        care: currentCareStage(person, { pregWeek: s.weeks, born: false }),
      };
    }
    if (family.stage === "born" && isValidDate(family.deliveryDate)) {
      const day = diffDays(today, family.deliveryDate);
      return {
        kind: "postpartum",
        headline: `產後第 ${day} 天`,
        sub: day <= 42 ? "產後恢復期，記得產後健康照護" : "持續照顧自己的身心",
        ppDay: day,
        cards: cardsForPostpartumDay(day),
        care: currentCareStage(person, { ppDay: day }),
      };
    }
    return { kind: "unknown", headline: "媽媽", sub: "", cards: [], care: null };
  }
  const age = ageParts(person.birthDate, today);
  return {
    kind: "baby",
    headline: `${person.nickname}・${formatAge(age)}`,
    sub: `出生於 ${person.birthDate}${person.gestWeeks ? `（${person.gestWeeks} 週出生）` : ""}`,
    ageDays: age.totalDays,
    age,
    cards: cardsForBabyAge(age.totalDays),
    care: currentCareStage(person, { ageDays: age.totalDays }),
  };
}
