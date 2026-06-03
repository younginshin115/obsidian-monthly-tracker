import { App, Plugin, MarkdownPostProcessorContext, TFile, TFolder, parseYaml, normalizePath } from 'obsidian';
import { PluginSettings, DEFAULT_SETTINGS, TrackerConfig } from './types';
import { MonthlyTrackerSettingTab } from './settings';
import { renderTracker, DayData } from './renderer';
import { t } from './i18n';

function buildDatePattern(dateFormat: string, year: number, month: number): RegExp {
  const mm = String(month).padStart(2, '0');
  const escaped = dateFormat
    .replace('YYYY', '\x00Y\x00')
    .replace('MM', '\x00M\x00')
    .replace('DD', '\x00D\x00')
    .replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    .replace('\x00Y\x00', String(year))
    .replace('\x00M\x00', mm)
    .replace('\x00D\x00', '(\\d{2})');
  return new RegExp(`^${escaped}`);
}

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

function detectDailyNotesFolder(app: App): string {
  const a = app as AppWithPlugins;
  const internal = a.internalPlugins?.plugins?.['daily-notes']?.instance?.options?.folder;
  if (internal) return internal;
  const periodic = a.plugins?.plugins?.['periodic-notes']?.settings?.daily?.folder;
  if (periodic) return periodic;
  return '';
}

/** Validate config-level invariants up front so renderers can assume valid input. */
function validateConfig(config: TrackerConfig): void {
  const m = t();
  if (!config?.type) {
    throw new Error(m.errMissingType);
  }
  if (!config.property && config.type !== 'boolean') {
    throw new Error(m.errMissingProperty);
  }
  if (config.type === 'colormap' && !config.colors) {
    throw new Error(m.errMissingColors);
  }
  if (config.type === 'heatmap') {
    const bins = config.bins;
    if (!bins || bins.length === 0) {
      throw new Error(m.errHeatmapBins);
    }
    if (bins[0] <= 0) {
      throw new Error(m.errBinsPositive(bins[0]));
    }
    for (let i = 1; i < bins.length; i++) {
      if (bins[i] <= bins[i - 1]) {
        throw new Error(m.errBinsAscending(bins[i - 1], bins[i]));
      }
    }
  }
}

export default class MonthlyTrackerPlugin extends Plugin {
  settings!: PluginSettings;

  async onload() {
    await this.loadSettings();
    this.addSettingTab(new MonthlyTrackerSettingTab(this.app, this));

    this.registerMarkdownCodeBlockProcessor(
      'monthly-tracker',
      async (source, el, ctx) => {
        try {
          await this.processBlock(source, el, ctx);
        } catch (err) {
          el.createEl('pre', {
            text: `${t().errorPrefix}:\n${err instanceof Error ? err.message : String(err)}`,
            cls: 'monthly-tracker-error',
          });
        }
      },
    );
  }

  private async processBlock(
    source: string,
    el: HTMLElement,
    ctx: MarkdownPostProcessorContext,
  ): Promise<void> {
    const config = parseYaml(source.trim()) as TrackerConfig;
    validateConfig(config);

    // Read year/month from the current note's frontmatter
    const currentFile = this.app.vault.getAbstractFileByPath(ctx.sourcePath);
    if (!(currentFile instanceof TFile)) {
      throw new Error(t().errCannotResolveFile);
    }
    const fm = this.app.metadataCache.getFileCache(currentFile)?.frontmatter;
    const year: unknown = fm?.year;
    const month: unknown = fm?.month;
    if (year == null || month == null) {
      throw new Error(t().errMissingYearMonth);
    }
    if (typeof year !== 'number' || typeof month !== 'number') {
      throw new Error(t().errYearMonthType);
    }
    if (month < 1 || month > 12) {
      throw new Error(t().errInvalidMonth(month));
    }

    const daysInMonth = new Date(year, month, 0).getDate();
    // Resolve the daily notes folder, then normalize user-provided paths.
    // An unresolved folder stays empty so the lookup fails and the tracker is
    // empty, rather than normalizePath('') === '/' silently scanning the vault root.
    const resolvedFolder =
      config.source ?? (this.settings.dailyNotesFolder || detectDailyNotesFolder(this.app));
    const folder = resolvedFolder ? normalizePath(resolvedFolder) : '';
    const pattern = buildDatePattern(this.settings.dateFormat, year, month);

    // Scan vault folder for matching daily notes
    const data = new Map<number, DayData>();
    const abstractFolder = this.app.vault.getAbstractFileByPath(folder);

    if (abstractFolder instanceof TFolder) {
      for (const child of abstractFolder.children) {
        if (!(child instanceof TFile)) continue;
        const match = child.name.match(pattern);
        if (!match) continue;
        const day = parseInt(match[1], 10);

        const childFm = this.app.metadataCache.getFileCache(child)?.frontmatter;
        // File-existence mode (property omitted) marks every matching note as true.
        const value: unknown = config.property == null ? true : childFm?.[config.property];

        data.set(day, { day, value, filePath: child.path });
      }
    }

    const rendered = renderTracker(config, data, daysInMonth);

    // Delegate internal-link clicks to Obsidian so day cells open the note.
    this.registerDomEvent(rendered, 'click', (evt) => {
      const link = (evt.target as HTMLElement).closest('a.internal-link');
      const path = link?.getAttribute('data-href');
      if (!path) return;
      evt.preventDefault();
      void this.app.workspace.openLinkText(path, ctx.sourcePath, evt.ctrlKey || evt.metaKey);
    });

    // Trigger Obsidian's page-preview on hover (data-href alone doesn't enable it).
    this.registerDomEvent(rendered, 'mouseover', (evt) => {
      const link = (evt.target as HTMLElement).closest('a.internal-link');
      const path = link?.getAttribute('data-href');
      if (!path) return;
      this.app.workspace.trigger('hover-link', {
        event: evt,
        source: 'monthly-tracker',
        hoverParent: rendered,
        targetEl: link,
        linktext: path,
        sourcePath: ctx.sourcePath,
      });
    });

    el.appendChild(rendered);
  }

  async loadSettings() {
    const data = (await this.loadData()) as Partial<PluginSettings> | null;
    this.settings = Object.assign({}, DEFAULT_SETTINGS, data);
  }

  async saveSettings() {
    await this.saveData(this.settings);
  }
}
