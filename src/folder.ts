import { App, normalizePath } from 'obsidian';

/** Minimal shapes for the untyped internal/community plugin APIs we read from. */
interface DailyNotesInternalPlugin {
  instance?: { options?: { folder?: string } };
}
interface PeriodicNotesPlugin {
  settings?: { daily?: { folder?: string } };
}
interface AppWithPlugins extends App {
  internalPlugins?: { plugins?: Record<string, DailyNotesInternalPlugin | undefined> };
  plugins?: { plugins?: Record<string, PeriodicNotesPlugin | undefined> };
}

/**
 * Best-effort detection of the daily-notes folder from the core Daily notes
 * plugin, falling back to the community Periodic Notes plugin. Returns `''`
 * when neither is configured.
 */
export function detectDailyNotesFolder(app: App): string {
  const a = app as AppWithPlugins;
  const internal = a.internalPlugins?.plugins?.['daily-notes']?.instance?.options?.folder;
  if (internal) return internal;
  const periodic = a.plugins?.plugins?.['periodic-notes']?.settings?.daily?.folder;
  if (periodic) return periodic;
  return '';
}

/**
 * Resolve which vault folder to scan for daily notes, in priority order:
 * the code-block `source`, then the plugin setting, then an auto-detected folder.
 *
 * The result is run through `normalizePath()` so user-provided paths with
 * trailing/leading slashes or backslashes resolve correctly. An unresolved
 * (empty) path is deliberately kept empty rather than normalized: Obsidian's
 * `normalizePath('')` returns `'/'`, which would silently match the vault root
 * and scan every file. Returning `''` instead lets the lookup fail and produce
 * an empty tracker.
 */
export function resolveDailyNotesFolder(
  source: string | undefined,
  settingsFolder: string,
  detectedFolder: string,
): string {
  const resolved = source ?? (settingsFolder || detectedFolder);
  return resolved ? normalizePath(resolved) : '';
}
