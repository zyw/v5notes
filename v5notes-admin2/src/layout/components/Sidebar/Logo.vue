<template>
  <div ref="rootRef" class="sidebar-logo-container">
    <router-link class="sidebar-logo-link" to="/" :style="linkStyle">
      <img v-if="logo" :src="logo" :style="logoStyle" />
      <div v-if="logo" :style="brandStyle">
        <h1 :style="titleStyle">{{ title }}</h1>
        <span :style="subtitleStyle">{{ subtitle }}</span>
      </div>
      <h1 v-else :style="titleStyle">{{ title }}</h1>
    </router-link>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n';
import logo from '@/assets/logo/logo.png';
import { NavTypeEnum } from '@/enums/NavTypeEnum';
import { useSettingsStore } from '@/store/modules/settings';

defineProps({
  collapse: {
    type: Boolean,
    required: true
  }
});

const title = import.meta.env.VITE_APP_LOGO_TITLE;
const { t } = useI18n();
const subtitle = computed(() => t('layout.logoSub'));
const settingsStore = useSettingsStore();
const sideTheme = computed(() => settingsStore.sideTheme);
const isTopNav = computed(() => settingsStore.navType === NavTypeEnum.TOP);
const isDarkSide = computed(() => !isTopNav.value && sideTheme.value === 'theme-dark');
const logoTextColor = computed(() => (isDarkSide.value ? '#f8fbff' : 'var(--app-text-title)'));

// 用实际渲染宽度判断是否窄栏（不依赖 collapse 标记），保证展开时一定显示品牌文字
const rootRef = ref<HTMLElement | null>(null);
const isNarrow = ref(false);
let logoResizeObserver: ResizeObserver | null = null;
onMounted(() => {
  if (typeof ResizeObserver !== 'undefined' && rootRef.value) {
    logoResizeObserver = new ResizeObserver(entries => {
      const width = entries[0]?.contentRect?.width ?? rootRef.value?.clientWidth ?? 0;
      isNarrow.value = width > 0 && width < 120;
    });
    logoResizeObserver.observe(rootRef.value);
  } else {
    const w = rootRef.value?.clientWidth ?? 0;
    isNarrow.value = w > 0 && w < 120;
  }
});
onBeforeUnmount(() => logoResizeObserver?.disconnect());

const linkStyle = computed(() => ({
  height: '100%',
  width: '100%',
  display: 'flex',
  alignItems: 'center',
  justifyContent: isNarrow.value ? 'center' : 'flex-start',
  gap: '13px',
  padding: isNarrow.value ? '0' : '0 10px',
  textDecoration: 'none'
}));
const logoStyle = {
  width: '30px',
  height: '30px',
  borderRadius: '9px',
  flex: 'none',
  display: 'block'
};
const brandStyle = computed(() => ({
  display: isNarrow.value ? 'none' : 'flex',
  flexDirection: 'column',
  flex: '0 0 auto',
  gap: '3px',
  lineHeight: '1.15',
  minWidth: '0',
  textAlign: 'left'
}));
const titleStyle = {
  margin: '0',
  textAlign: 'left',
  fontSize: '15px',
  fontWeight: 700,
  lineHeight: '1.15',
  letterSpacing: '0.01em',
  color: '#15241e',
  fontFamily: "'MiSans','HarmonyOS Sans SC','PingFang SC',sans-serif"
};
const subtitleStyle = {
  marginTop: '3px',
  textAlign: 'left',
  fontSize: '10.5px',
  fontWeight: 500,
  lineHeight: '1.15',
  letterSpacing: '0.01em',
  whiteSpace: 'nowrap',
  color: '#5f7067'
};
</script>

<style lang="scss" scoped>
.sidebarLogoFade-enter-active {
  transition: opacity 1.5s;
}

.sidebarLogoFade-enter,
.sidebarLogoFade-leave-to {
  opacity: 0;
}

.sidebar-logo-container {
  position: relative;
  flex-shrink: 0;
  height: 46px;
  line-height: 46px;
  padding: 0 8px;
  margin-top: 8px;
  background: transparent;
  text-align: center;
  overflow: hidden;
  margin-bottom: 0;

  & .sidebar-logo-link {
    height: 100%;
    width: 100%;
    display: flex;
    align-items: center;
    justify-content: flex-start;
    gap: 13px;
    padding: 0 10px;
    border-radius: 0;
    background: transparent;
    border: 0;

    & .sidebar-logo {
      width: 30px;
      height: 30px;
      vertical-align: middle;
      margin-right: 0;
      margin-left: 0;
      border-radius: 9px;
      box-shadow: none;
    }

    & .sidebar-logo {
      flex: none;
    }

    & .sidebar-brand {
      display: flex;
      flex: 1 1 auto;
      flex-direction: column;
      gap: 3px;
      min-width: 0;
      line-height: 1.15;
    }

    & .sidebar-title {
      display: block;
      margin: 0;
      color: v-bind(logoTextColor);
      font-weight: 700;
      line-height: 1.15;
      font-size: 15px;
      letter-spacing: 0.01em;
      font-family: 'MiSans', 'HarmonyOS Sans SC', 'PingFang SC', sans-serif;
    }

    & .sidebar-subtitle {
      display: block;
      margin: 0;
      color: var(--app-text-muted);
      font-weight: 500;
      line-height: 1.15;
      font-size: 10.5px;
      letter-spacing: 0.01em;
      white-space: nowrap;
    }
  }

  &.narrow {
    .sidebar-logo-link {
      justify-content: center;
      padding: 0;
    }

    .sidebar-brand {
      display: none;
    }

    .sidebar-logo {
      margin-right: 0;
    }
  }
}
</style>
