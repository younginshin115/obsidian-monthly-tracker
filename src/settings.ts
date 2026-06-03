import { App, PluginSettingTab, Setting } from 'obsidian';
import type MonthlyTrackerPlugin from './main';

export class MonthlyTrackerSettingTab extends PluginSettingTab {
  plugin: MonthlyTrackerPlugin;

  constructor(app: App, plugin: MonthlyTrackerPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    new Setting(containerEl)
      .setName('Daily notes folder')
      .setDesc('Folder containing daily notes (e.g. 04 Calendar/Days)')
      .addText(text =>
        text
          .setPlaceholder('04 Calendar/Days')
          .setValue(this.plugin.settings.dailyNotesFolder)
          .onChange(async (value) => {
            this.plugin.settings.dailyNotesFolder = value.trim();
            await this.plugin.saveSettings();
          }),
      );

    new Setting(containerEl)
      .setName('Date format')
      .setDesc('File name date format. Must match YYYY-MM-DD at the start of file names.')
      .addText(text =>
        text
          .setPlaceholder('YYYY-MM-DD')
          .setValue(this.plugin.settings.dateFormat)
          .onChange(async (value) => {
            this.plugin.settings.dateFormat = value.trim();
            await this.plugin.saveSettings();
          }),
      );
  }
}
