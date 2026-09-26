import { chromium } from 'playwright';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
const FF = process.env.FFMPEG || '/usr/local/lib/python3.11/dist-packages/imageio_ffmpeg/binaries/ffmpeg-linux-x86_64-v7.0.2';
const DPR = Number(process.env.DPR || 1);
const BASE = process.env.BASE || 'http://localhost:3000';
// 녹화용: 한글 폰트 통일 + Next 개발용 배지 숨김
const CSS = `*{font-family:"Pretendard","S-Core Dream",sans-serif !important} nextjs-portal{display:none !important}`;

// 녹화용 더미 데이터 (실제 학생 정보 아님). 앱 코드는 건드리지 않고 브라우저에서 /api 응답만 가로챕니다.
const now = new Date().toISOString();
const rec = (a, b, c, d, e, f, g, h) => ({ 'base-broth': a, 'spicy-base': b, 'garlic-powder': c, 'pepper-flake': d, 'sweet-note': e, 'seaweed': f, 'onion': g, 'umami': h });
export function dummyProjects(settings) {
  const ids = settings.ingredients.map(i => i.id);
  const mk = (id, name, team, best, product, line, tagsets) => ({
    id, studentName: name, teamName: team, bestRecipeIndex: best, updatedAt: now,
    label: { productName: product, tasteLine: line, developerName: name },
    experiments: tagsets.map((tags, k) => ({ recipe: Object.fromEntries(settings.ingredients.map(i => [i.id, Math.min(i.maxAmount, i.defaultAmount + i.step * ((k + ids.indexOf(i.id)) % 3))])), note: ['조금 싱거웠어요', '매운맛이 딱 좋아요', '마늘향이 강해요', '국물이 진해서 좋아요'][k % 4], tags, saved: true })),
  });
  return [
    mk('demo-1', '김연구', '매운맛 연구팀', 1, '불꽃 한 그릇', '칼칼하고 진한 국물', [['더 맵게'], ['현재가 좋음'], ['덜 맵게'], ['더 진하게']]),
    mk('demo-2', '이하늘', '국물 탐험대', 3, '구름 순한면', '부드럽고 고소한 맛', [['더 순하게'], ['향 추가'], ['더 진하게'], ['현재가 좋음']]),
    mk('demo-3', '박소금', '마늘 특공대', 2, '마늘 폭탄면', '마늘향 가득 얼큰한 맛', [['향 추가'], ['더 맵게'], ['현재가 좋음'], ['더 순하게']]),
    mk('demo-4', '최단비', '해물 연구소', 0, '바다 한 스푼', '시원하고 깔끔한 맛', [['현재가 좋음'], ['더 진하게'], ['향 추가'], ['덜 맵게']]),
  ];
}

export async function session(fn, { teacher = false, seed = null, width = 1600, height = 900 } = {}) {
  const b = await chromium.launch({ args: [] });
  const ctx = await b.newContext({ viewport: { width, height }, deviceScaleFactor: DPR, locale: 'ko-KR' });
  await ctx.addInitScript(css => { document.addEventListener('DOMContentLoaded', () => { const s = document.createElement('style'); s.textContent = css; document.head.appendChild(s); }); }, CSS);
  const settings = (await (await fetch(BASE + '/api/settings')).json()).settings;
  const store = {};
  // seed: 'me' 학생의 진행 상태를 미리 넣어 두고 해당 장면부터 녹화
  if (seed) { const me = seed(settings); store[me.id] = me; await ctx.addInitScript(id => localStorage.setItem('ramen-rd-student-id', id), me.id); }
  await ctx.route('**/api/**', async route => {
    const req = route.request(); const url = new URL(req.url());
    const json = body => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
    if (url.pathname === '/api/settings') return json({ settings });
    if (url.pathname === '/api/teacher/login') return json({ authenticated: teacher });
    if (url.pathname === '/api/students') {
      if (req.method() === 'POST') { const { project } = req.postDataJSON(); store[project.id] = { ...project, updatedAt: new Date().toISOString() }; return json({ project: store[project.id] }); }
      const id = url.searchParams.get('id');
      if (id) return json({ project: store[id] ?? null });
      return json({ projects: dummyProjects(settings) });
    }
    return route.fulfill({ status: 404, contentType: 'application/json', body: '{"error":"녹화용"}' });
  });
  const page = await ctx.newPage();
  try { await fn(page); } finally { await b.close(); }
}

export async function record(page, name, actions) {
  const dir = `clips/${name}`; fs.rmSync(dir, { recursive: true, force: true }); fs.mkdirSync(dir, { recursive: true });
  const cdp = await page.context().newCDPSession(page);
  const frames = [];
  cdp.on('Page.screencastFrame', async f => {
    const i = frames.length; frames.push(f.metadata.timestamp);
    fs.writeFileSync(`${dir}/${String(i).padStart(5,'0')}.jpg`, Buffer.from(f.data, 'base64'));
    cdp.send('Page.screencastFrameAck', { sessionId: f.sessionId }).catch(() => {});
  });
  const vp = page.viewportSize();
  await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 92, maxWidth: vp.width*DPR, maxHeight: vp.height*DPR, everyNthFrame: 1 });
  const start = Date.now() / 1000;
  await actions();
  const end = Date.now() / 1000;
  await cdp.send('Page.stopScreencast');
  let list = '';
  frames.forEach((t, i) => { const next = i + 1 < frames.length ? frames[i + 1] : end; list += `file '${String(i).padStart(5,'0')}.jpg'\nduration ${Math.max(0.001, next - t).toFixed(4)}\n`; });
  list += `file '${String(frames.length - 1).padStart(5,'0')}.jpg'\n`;
  fs.writeFileSync(`${dir}/list.txt`, list);
  execFileSync(FF, ['-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', `${dir}/list.txt`, '-vf', `fps=30,scale=${vp.width*DPR}:${vp.height*DPR}:flags=lanczos,format=yuv420p`, '-c:v', 'libx264', '-crf', '14', '-preset', 'medium', `clips/${name}.mp4`]);
  console.log(name, frames.length, 'frames', (end - start).toFixed(1), 's');
}
export { BASE };
