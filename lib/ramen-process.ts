export type ProcessTone =
  | "mix"
  | "dough"
  | "noodle"
  | "steam"
  | "dry"
  | "cool"
  | "soup"
  | "pack"
  | "check";

export type RamenProcessStep = {
  title: string;
  short: string;
  tone: ProcessTone;
  researcherCheck: string;
  teacherPrompt: string;
};

export const RAMEN_PROCESS_STEPS: RamenProcessStep[] = [
  {
    title: "원료 배합",
    short: "밀가루와 물, 원료를 제품 기준에 맞게 정확히 계량합니다.",
    tone: "mix",
    researcherCheck: "배합비와 원료 상태",
    teacherPrompt: "물의 양이 달라지면 반죽은 어떻게 달라질까요?",
  },
  {
    title: "반죽",
    short: "원료를 고르게 섞어 탄력 있고 균일한 반죽을 만듭니다.",
    tone: "dough",
    researcherCheck: "수분과 탄력",
    teacherPrompt: "반죽이 너무 질거나 단단하면 면에 어떤 문제가 생길까요?",
  },
  {
    title: "제면",
    short: "반죽을 롤러로 얇게 펴고 일정한 굵기의 면으로 자릅니다.",
    tone: "noodle",
    researcherCheck: "면 두께와 굵기",
    teacherPrompt: "면 굵기가 달라지면 익는 시간과 식감도 달라집니다.",
  },
  {
    title: "증숙",
    short: "면을 수증기로 익혀 형태를 안정시키고 식감을 만듭니다.",
    tone: "steam",
    researcherCheck: "온도와 시간",
    teacherPrompt: "면을 끓는 물이 아닌 수증기로 먼저 익히는 이유를 생각해 봅시다.",
  },
  {
    title: "건조 또는 유탕",
    short: "열풍으로 말리거나 기름에 튀겨 수분을 줄이고 보관성을 높입니다.",
    tone: "dry",
    researcherCheck: "수분과 생산 방식",
    teacherPrompt: "건면과 유탕면은 식감과 조리 시간에서 어떤 차이가 날까요?",
  },
  {
    title: "냉각",
    short: "뜨거워진 면을 빠르게 식혀 품질과 포장 안전성을 유지합니다.",
    tone: "cool",
    researcherCheck: "면의 중심 온도",
    teacherPrompt: "뜨거운 면을 바로 포장하면 어떤 문제가 생길까요?",
  },
  {
    title: "스프·건더기 제조",
    short: "목표한 맛과 향, 식감에 맞춰 스프와 건더기를 따로 설계합니다.",
    tone: "soup",
    researcherCheck: "배합량과 알레르기",
    teacherPrompt: "오늘 여러분이 실제로 연구할 부분이 바로 이 단계입니다.",
  },
  {
    title: "포장",
    short: "면, 스프팩, 건더기팩을 정해진 구성과 중량으로 담습니다.",
    tone: "pack",
    researcherCheck: "구성품과 밀봉 상태",
    teacherPrompt: "한 가지 구성품이 빠지면 완성된 제품이라고 할 수 있을까요?",
  },
  {
    title: "품질검사",
    short: "중량과 포장 상태, 안전 기준을 확인한 제품만 출고합니다.",
    tone: "check",
    researcherCheck: "안전성과 규격",
    teacherPrompt: "식품개발연구원은 맛뿐 아니라 안전과 품질도 책임집니다.",
  },
];
