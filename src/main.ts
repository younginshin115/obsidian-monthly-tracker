import { Plugin, MarkdownPostProcessorContext, TFile, parseYaml } from 'obsidian';
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

function detectDailyNotesFolder(app: any): string {
  const internal = app.internalPlugins?.plugins?.['daily-notes']?.instance?.options?.folder;
  if (internal) return internal;
  const periodic = app.plugins?.plugins?.['periodic-notes']?.settings?.daily?.folder;
  if (periodic) return periodic;
  return '';
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
    if (!config?.type) {
      throw new Error(t().errMissingType);
    }
    if (!config.property && config.type !== 'boolean') {
      throw new Error(t().errMissingProperty);
    }
    if (config.type === 'colormap' && !config.colors) {
      throw new Error(t().errMissingColors);
    }

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
    const pattern = buildDatePattern(this.settings.dateFormat, year, Number(month));

    // Scan vault folder for matching daily notes
    const data = new Map<number, DayData>();
    const abstractFolder = this.app.vault.getAbstractFileByPath(folder);

    if (abstractFolder) {
      // @ts-ignore — TFolder has children
      const children: unknown[] = abstractFolder.children ?? [];
      for (const child of children) {
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
    el.appendChild(rendered);
  }

  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  async saveSettings() {
    await this.saveData(this.settings);
  }
}
