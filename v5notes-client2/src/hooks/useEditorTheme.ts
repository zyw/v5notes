import { computed, ref } from 'vue'
import { useAppTheme } from './useAppTheme'
import {
  AUTO_EDITOR_THEME,
  EDITOR_THEME_STORAGE_KEY,
  readStoredEditorTheme,
  resolveEditorTheme,
  type EditorThemePreference,
} from '../models/editorTheme'

function storageOrNull(): Storage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage
  } catch {
    return null
  }
}

// Shared by every V5Editor instance so the main editor and the history preview
// always use the same theme.
const preference = ref<EditorThemePreference>(readStoredEditorTheme(storageOrNull()))

export function useEditorTheme() {
  const { resolved: appTheme } = useAppTheme()
  const theme = computed(() => resolveEditorTheme(preference.value, appTheme.value))

  function setPreference(next: EditorThemePreference): void {
    preference.value = next
    try {
      storageOrNull()?.setItem(EDITOR_THEME_STORAGE_KEY, next)
    } catch {
      /* Private browsing and similar modes: the choice still applies this session. */
    }
  }

  function resetPreference(): void {
    setPreference(AUTO_EDITOR_THEME)
  }

  return { preference, theme, setPreference, resetPreference }
}
