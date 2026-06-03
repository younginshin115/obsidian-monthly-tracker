import { App, Plugin, MarkdownPostProcessorContext, TFile, TFolder, parseYaml } from 'obsidian';
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

function detectDailyNotesFolder(app: App): string {
  const internal = (app as any).internalPlugins?.plugins?.['daily-notes']?.instance?.options?.folder;
  if (internal) return internal;
  const periodic = (app as any).plugins?.plugins?.['periodic-notes']?.settings?.daily?.folder;
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
    const year = fm?.year;
    const month = fm?.month;
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
    const folder = config.source ?? (this.settings.dailyNotesFolder || detectDailyNotesFolder(this.app));
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
        let value: unknown = undefined;

        if (config.property === null || config.property === undefined) {
          // File-existence mode (e.g. Morning Journal folder)
          value = true;
        } else {
          value = childFm?.[config.property];
        }

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
      this.app.workspace.openLinkText(path, ctx.sourcePath, evt.ctrlKey || evt.metaKey);
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
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  async saveSettings() {
    await this.saveData(this.settings);
  }
}
