import { session, record, dummyProjects, BASE } from './rec.mjs';
const w = ms => new Promise(r => setTimeout(r, ms));
const which = process.argv[2];
const nav = (p, label) => p.locator('.student-nav button', { hasText: label }).click();
const tnav = (p, label) => p.locator('.teacher-sidebar button', { hasText: label }).click();
// 녹화용 더미 학생 '김연구'
const me = (stage) => settings => {
  const base = dummyProjects(settings)[0];
  const blank = settings.ingredients.map(i => [i.id, i.defaultAmount]);
  const p = { ...base, id: 'demo-me', bestRecipeIndex: null, label: { productName: '', tasteLine: '', developerName: '김연구' } };
  if (stage === 'fresh') p.experiments = p.experiments.map(() => ({ recipe: Object.fromEntries(blank), note: '', tags: [], saved: false }));
  if (stage === 'best') p.bestRecipeIndex = 1;
  return p;
};
const slide = async (p, label, n, ms = 55) => { await p.getByLabel(label).focus(); for (let i = 0; i < n; i++) { await p.keyboard.press('ArrowRight'); await w(ms); } };

if (which === 'start') await session(async p => {
  await p.goto(BASE + '/'); await w(2500);
  await record(p, 'start', async () => {
    await w(1500);
    await p.getByPlaceholder('이름을 입력하세요').pressSequentially('김연구', { delay: 180 }); await w(300);
    await p.getByPlaceholder('예: 매운맛 연구팀').pressSequentially('매운맛 연구팀', { delay: 140 }); await w(700);
    await p.getByRole('button', { name: /연구 시작/ }).click(); await w(4000);
  });
});

if (which === 'factory') await session(async p => {
  await p.goto(BASE + '/'); await w(2000); await nav(p, '라면 제조 공정'); await w(1500);
  await record(p, 'factory', async () => {
    await w(1200);
    await p.getByRole('button', { name: '생산라인 입장' }).click(); await w(2200);
    await slide(p, '반죽 수분 상태', 30); await w(700);
    await p.getByRole('button', { name: '공정 기준 확인' }).click(); await w(2200);
    await slide(p, '롤러 간격', 20); await w(700);
    await p.getByRole('button', { name: '공정 기준 확인' }).click(); await w(2200);
    await p.getByRole('button', { name: '기름에 유탕' }).click(); await w(700);
    await p.getByRole('button', { name: '공정 기준 확인' }).click(); await w(2200);
    await p.getByRole('button', { name: '냉각팬 가동' }).click(); await w(2600);
    await p.getByRole('button', { name: '공정 기준 확인' }).click(); await w(2000);
    for (const it of ['면', '스프팩', '건더기팩']) { await p.locator('.packing-mission button', { hasText: it }).first().click(); await w(450); }
    await w(400); await p.getByRole('button', { name: '품질검사 실행' }).click(); await w(3500);
  });
}, { seed: me('fresh') });

if (which === 'lab') await session(async p => {
  await p.goto(BASE + '/'); await w(2000); await nav(p, '스프 배합 LAB'); await w(1500);
  await record(p, 'lab', async () => {
    await w(1200);
    for (const [n, k] of [['매운맛 늘리기', 2], ['마늘향 늘리기', 1], ['양파맛 늘리기', 1], ['기본스프 늘리기', 1]]) for (let i = 0; i < k; i++) { await p.getByLabel(n).click(); await w(550); }
    await w(600); await p.getByRole('button', { name: '배합 저장' }).click(); await w(1500);
    await p.getByRole('button', { name: /실제 시식 후 기록/ }).click(); await w(1600);
    await p.locator('.taste-tags button', { hasText: '더 맵게' }).click(); await w(500);
    await p.getByPlaceholder('예: 마늘향을 조금 줄이고 싶다').pressSequentially('매콤하고 마늘향이 좋아요!', { delay: 110 }); await w(500);
    await p.getByRole('button', { name: '기록 저장' }).click(); await w(2500);
  });
}, { seed: me('fresh') });

if (which === 'best') await session(async p => {
  await p.goto(BASE + '/'); await w(2000); await nav(p, '레시피 비교'); await w(1500);
  await record(p, 'best', async () => {
    await w(3000);
    await p.getByRole('button', { name: /BEST RECIPE 고르기/ }).click(); await w(1800);
    await p.locator('.best-choice-grid button').nth(1).click(); await w(3500);
  });
}, { seed: me('saved') });

if (which === 'label') await session(async p => {
  await p.goto(BASE + '/'); await w(2000); await nav(p, '제품 라벨 만들기'); await w(1500);
  await record(p, 'label', async () => {
    await w(1200);
    await p.getByPlaceholder('예: 불꽃마늘라면').pressSequentially('불꽃마늘라면', { delay: 150 }); await w(400);
    await p.getByPlaceholder('예: 마늘향 뒤에 매콤함이 톡!').pressSequentially('마늘향 뒤에 매콤함이 톡!', { delay: 90 }); await w(700);
    await p.getByRole('button', { name: '라벨 저장' }).click(); await w(2500);
  });
}, { seed: me('best') });

if (which === 'teacher') await session(async p => {
  await p.goto(BASE + '/teacher'); await w(3000); await tnav(p, '직업소개·공정시연'); await w(2500);
  await record(p, 'career', async () => { await w(1000); await p.mouse.wheel(0, 380); await w(5000); });
  await tnav(p, '원가 자동계산'); await w(1500);
  await record(p, 'cost', async () => {
    await w(1000);
    for (const n of ['10명', '20명', '25명', '30명']) { await p.locator('button', { hasText: new RegExp('^' + n + '$') }).first().click(); await w(1000); }
    await p.mouse.wheel(0, 300); await w(2000);
  });
  await tnav(p, '학생용 라벨'); await w(1500);
  await record(p, 'labels', async () => { await w(1200); await p.mouse.wheel(0, 500); await w(3500); });
}, { teacher: true });
