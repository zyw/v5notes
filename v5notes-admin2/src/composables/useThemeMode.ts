import { computed, ref } from 'vue';

export type ThemeMode = 'auto' | 'dark' | 'light';

const MODE_KEY = 'v5-theme-mode';
const ORDER: ThemeMode[] = ['auto', 'dark', 'light'];
const LABEL: Record<ThemeMode, string> = { auto: '跟随系统', dark: '深色', light: '浅色' };

const mode = ref<ThemeMode>('auto');
const systemDark = ref(false);
let initialized = false;

function readMode(): ThemeMode {
  try {
    const v = localStorage.getItem(MODE_KEY);
    if (v === 'auto' || v === 'dark' || v === 'light') return v;
  } catch {
    // ignore
  }
  return 'auto';
}

function isDark(m: ThemeMode, sys: boolean): boolean {
  return m === 'dark' || (m === 'auto' && sys);
}

/** 与工作台既有 useDark / layout-setting 保持一致，切换后登录页与工作台同步 */
function syncStores(dark: boolean) {
  try {
    const raw = localStorage.getItem('layout-setting');
    const obj = raw ? JSON.parse(raw) : {};
    obj.dark = dark;
    localStorage.setItem('layout-setting', JSON.stringify(obj));
  } catch {
    // ignore
  }
  try {
    localStorage.setItem('useDarkKey', JSON.stringify(dark));
  } catch {
    // ignore
  }
}

function apply() {
  if (typeof document === 'undefined') return;
  const dark = isDark(mode.value, systemDark.value);
  const root = document.documentElement;
  root.classList.toggle('dark', dark);
  root.classList.toggle('light', !dark);
  root.setAttribute('data-theme', dark ? 'dark' : 'light');
  syncStores(dark);
}

function ensureInit() {
  if (initialized || typeof window === 'undefined') return;
  initialized = true;
  mode.value = readMode();
  const mql = window.matchMedia('(prefers-color-scheme: dark)');
  systemDark.value = mql.matches;
  const onChange = (e: MediaQueryListEvent) => {
    systemDark.value = e.matches;
    if (mode.value === 'auto') apply();
  };
  if (typeof mql.addEventListener === 'function') mql.addEventListener('change', onChange);
  else if (typeof (mql as any).addListener === 'function') (mql as any).addListener(onChange);
  apply();
}

export function useThemeMode() {
  ensureInit();
  const resolved = computed<'dark' | 'light'>(() => (isDark(mode.value, systemDark.value) ? 'dark' : 'light'));
  const label = computed(() => LABEL[mode.value]);

  const setMode = (m: ThemeMode) => {
    mode.value = m;
    try {
      localStorage.setItem(MODE_KEY, m);
    } catch {
      // ignore
    }
    apply();
  };

  const cycle = () => {
    const i = ORDER.indexOf(mode.value);
    setMode(ORDER[(i + 1) % ORDER.length]);
  };

  return { mode, resolved, label, setMode, cycle };
}
