import { App, PluginSettingTab, Setting } from 'obsidian';
import type MonthlyTrackerPlugin from './main';
import { t } from './i18n';

export class MonthlyTrackerSettingTab extends PluginSettingTab {
  plugin: MonthlyTrackerPlugin;

  constructor(app: App, plugin: MonthlyTrackerPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;
    const m = t();
    containerEl.empty();

    new Setting(containerEl)
      .setName(m.settingsFolderName)
      .setDesc(m.settingsFolderDesc)
      .addText(text =>
        text
          .setPlaceholder(m.settingsFolderPlaceholder)
          .setValue(this.plugin.settings.dailyNotesFolder)
          .onChange(async (value) => {
            this.plugin.settings.dailyNotesFolder = value.trim();
            await this.plugin.saveSettings();
          }),
      );

    new Setting(containerEl)
      .setName(m.settingsDateFormatName)
      .setDesc(m.settingsDateFormatDesc)
      .addText(text =>
        text
          .setPlaceholder(m.settingsDateFormatPlaceholder)
          .setValue(this.plugin.settings.dateFormat)
          .onChange(async (value) => {
            this.plugin.settings.dateFormat = value.trim();
            await this.plugin.saveSettings();
          }),
      );
  }
}
