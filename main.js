'use strict';

var obsidian = require('obsidian');

const DEFAULT_SETTINGS = {
    dailyNotesFolder: '04 Calendar/Days',
    dateFormat: 'YYYY-MM-DD',
};

class MonthlyTrackerSettingTab extends obsidian.PluginSettingTab {
    constructor(app, plugin) {
        super(app, plugin);
        this.plugin = plugin;
    }
    display() {
        const { containerEl } = this;
        containerEl.empty();
        new obsidian.Setting(containerEl)
            .setName('Daily notes folder')
            .setDesc('Folder containing daily notes (e.g. 04 Calendar/Days)')
            .addText(text => text
            .setPlaceholder('04 Calendar/Days')
            .setValue(this.plugin.settings.dailyNotesFolder)
            .onChange(async (value) => {
            this.plugin.settings.dailyNotesFolder = value.trim();
            await this.plugin.saveSettings();
        }));
        new obsidian.Setting(containerEl)
            .setName('Date format')
            .setDesc('File name date format. Must match YYYY-MM-DD at the start of file names.')
            .addText(text => text
            .setPlaceholder('YYYY-MM-DD')
            .setValue(this.plugin.settings.dateFormat)
            .onChange(async (value) => {
            this.plugin.settings.dateFormat = value.trim();
            await this.plugin.saveSettings();
        }));
    }
}

/** Single-color presets for boolean tracker */
const COLOR_PRESETS = {
    blue: '#64b5f6',
    green: '#66bb6a',
    red: '#e57373',
    purple: '#ba68c8',
    orange: '#ffb74d',
    yellow: '#ffd54f',
    teal: '#4db6ac',
    indigo: '#7986cb',
    pink: '#f06292',
};
/**
 * Heatmap color-scheme presets.
 * Index 0 = no data, index 1..n = increasing intensity.
 */
const HEATMAP_SCHEMES = {
    blue: ['#ebedf0', '#bbdefb', '#90caf9', '#64b5f6', '#42a5f5', '#1e88e5'],
    green: ['#ebedf0', '#c8e6c9', '#a5d6a7', '#81c784', '#66bb6a', '#43a047'],
    red: ['#ebedf0', '#ffcdd2', '#ef9a9a', '#e57373', '#ef5350', '#e53935'],
    purple: ['#ebedf0', '#e1bee7', '#ce93d8', '#ba68c8', '#ab47bc', '#8e24aa'],
    orange: ['#ebedf0', '#ffe0b2', '#ffcc80', '#ffb74d', '#ffa726', '#fb8c00'],
    yellow: ['#ebedf0', '#fff9c4', '#fff59d', '#fff176', '#ffee58', '#fdd835'],
    teal: ['#ebedf0', '#b2dfdb', '#80cbc4', '#4db6ac', '#26a69a', '#00897b'],
    indigo: ['#ebedf0', '#e8eaf6', '#c5cae9', '#9fa8da', '#7986cb', '#5c6bc0'],
    pink: ['#ebedf0', '#fce4ec', '#f48fb1', '#f06292', '#ec407a', '#d81b60'],
};
/** Resolve a color string: if it's a known preset name, return the hex; otherwise return as-is. */
function resolveColor(color) {
    var _a;
    return (_a = COLOR_PRESETS[color.toLowerCase()]) !== null && _a !== void 0 ? _a : color;
}
/** Resolve heatmap colors array from colorScheme preset or explicit colors array. */
function resolveHeatmapColors(colors, colorScheme) {
    if (colors && colors.length > 0)
        return colors;
    if (colorScheme) {
        const scheme = HEATMAP_SCHEMES[colorScheme.toLowerCase()];
        if (scheme)
            return scheme;
    }
    return HEATMAP_SCHEMES['indigo'];
}

const EMPTY_COLOR = '#ebedf0';
function dayCell(day, bgColor, filePath, tooltip, textStyle) {
    const base = `background-color:${bgColor};display:flex;align-items:center;justify-content:center;padding:4px 0;border-radius:2px;font-size:9px;flex:1;min-width:0;box-sizing:border-box;${textStyle}`;
    if (filePath) {
        return `<a href="${filePath}" class="internal-link" title="${tooltip}" style="${base};text-decoration:none;">${day}</a>`;
    }
    return `<div title="${tooltip}" style="${base}">${day}</div>`;
}
function wrapGrid(cells) {
    return `<div style="display:flex;gap:2px;margin-bottom:8px;">${cells}</div>`;
}
function renderBoolean(config, data, daysInMonth) {
    const activeColor = resolveColor(config.color);
    let cells = '';
    for (let day = 1; day <= daysInMonth; day++) {
        const entry = data.get(day);
        const active = entry !== undefined && !!entry.value;
        const bgColor = active ? activeColor : EMPTY_COLOR;
        const textStyle = active ? 'font-weight:600;color:white;' : 'color:#999;';
        cells += dayCell(day, bgColor, entry === null || entry === void 0 ? void 0 : entry.filePath, active ? 'Yes' : '', textStyle);
    }
    return wrapGrid(cells);
}
function renderColormap(config, data, daysInMonth) {
    var _a;
    const colorMap = (_a = config.colors) !== null && _a !== void 0 ? _a : {};
    let cells = '';
    for (let day = 1; day <= daysInMonth; day++) {
        const entry = data.get(day);
        const val = entry === null || entry === void 0 ? void 0 : entry.value;
        const bgColor = (val && colorMap[val]) ? colorMap[val] : EMPTY_COLOR;
        const hasData = val && colorMap[val];
        const textStyle = hasData ? 'font-weight:600;color:white;' : 'color:#999;';
        cells += dayCell(day, bgColor, entry === null || entry === void 0 ? void 0 : entry.filePath, val !== null && val !== void 0 ? val : '', textStyle);
    }
    return wrapGrid(cells);
}
function renderHeatmap(config, data, daysInMonth) {
    var _a, _b, _c, _d;
    const colors = resolveHeatmapColors(config.colors, config.colorScheme);
    if (!config.bins || config.bins.length === 0)
        throw new Error('heatmap requires "bins" (e.g. bins: [3, 5, 7, 10])');
    const bins = config.bins;
    const unit = (_a = config.unit) !== null && _a !== void 0 ? _a : '';
    function getIntensity(val) {
        if (!val || val <= 0)
            return 0;
        for (let i = 0; i < bins.length; i++) {
            if (val < bins[i])
                return i + 1;
        }
        return bins.length + 1;
    }
    const maxIntensity = bins.length + 1;
    const safeColors = colors.length >= maxIntensity + 1 ? colors : [
        ...colors,
        ...Array(maxIntensity + 1 - colors.length).fill((_b = colors[colors.length - 1]) !== null && _b !== void 0 ? _b : EMPTY_COLOR),
    ];
    let total = 0;
    let cells = '';
    for (let day = 1; day <= daysInMonth; day++) {
        const entry = data.get(day);
        const val = typeof (entry === null || entry === void 0 ? void 0 : entry.value) === 'number' ? entry.value : 0;
        total += val;
        const intensity = getIntensity(val);
        const bgColor = (_c = safeColors[intensity]) !== null && _c !== void 0 ? _c : EMPTY_COLOR;
        const hasData = intensity > 0;
        const textStyle = hasData ? 'font-weight:600;color:white;' : 'color:#999;';
        const tooltip = val > 0 ? `${val}${unit}` : '';
        cells += dayCell(day, bgColor, entry === null || entry === void 0 ? void 0 : entry.filePath, tooltip, textStyle);
    }
    let html = '';
    if (config.showTotal) {
        const label = (_d = config.totalLabel) !== null && _d !== void 0 ? _d : (unit ? `합계` : '합계');
        html += `<div style="margin-bottom:6px;font-size:12px;color:var(--text-muted);">${label}: <span style="font-weight:600;color:var(--text-normal);">${total.toFixed(1)}${unit}</span></div>`;
    }
    html += wrapGrid(cells);
    return html;
}
function renderTracker(config, data, daysInMonth) {
    const container = document.createElement('div');
    container.style.fontFamily = "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
    let inner = '';
    if (config.type === 'boolean') {
        inner = renderBoolean(config, data, daysInMonth);
    }
    else if (config.type === 'colormap') {
        inner = renderColormap(config, data, daysInMonth);
    }
    else if (config.type === 'heatmap') {
        inner = renderHeatmap(config, data, daysInMonth);
    }
    container.innerHTML = inner;
    return container;
}

class MonthlyTrackerPlugin extends obsidian.Plugin {
    async onload() {
        await this.loadSettings();
        this.addSettingTab(new MonthlyTrackerSettingTab(this.app, this));
        this.registerMarkdownCodeBlockProcessor('monthly-tracker', async (source, el, ctx) => {
            try {
                await this.processBlock(source, el, ctx);
            }
            catch (err) {
                el.createEl('pre', {
                    text: `Monthly Tracker Error:\n${err instanceof Error ? err.message : String(err)}`,
                    cls: 'monthly-tracker-error',
                });
            }
        });
    }
    async processBlock(source, el, ctx) {
        var _a, _b, _c, _d;
        const config = obsidian.parseYaml(source.trim());
        if (!(config === null || config === void 0 ? void 0 : config.type)) {
            throw new Error('Missing required field: type (boolean | colormap | heatmap)');
        }
        if (!config.property && config.type !== 'boolean') {
            throw new Error('Missing required field: property');
        }
        // Read year/month from the current note's frontmatter
        const currentFile = this.app.vault.getAbstractFileByPath(ctx.sourcePath);
        if (!(currentFile instanceof obsidian.TFile)) {
            throw new Error('Cannot resolve current file');
        }
        const fm = (_a = this.app.metadataCache.getFileCache(currentFile)) === null || _a === void 0 ? void 0 : _a.frontmatter;
        const year = fm === null || fm === void 0 ? void 0 : fm.year;
        const month = fm === null || fm === void 0 ? void 0 : fm.month;
        if (!year || !month) {
            throw new Error("Current note must have 'year' and 'month' in frontmatter");
        }
        const daysInMonth = new Date(year, month, 0).getDate();
        const folder = (_b = config.source) !== null && _b !== void 0 ? _b : this.settings.dailyNotesFolder;
        const mm = String(month).padStart(2, '0');
        const pattern = new RegExp(`^${year}-${mm}-(\\d{2})`);
        // Scan vault folder for matching daily notes
        const data = new Map();
        const abstractFolder = this.app.vault.getAbstractFileByPath(folder);
        if (abstractFolder) {
            // @ts-ignore — TFolder has children
            const children = (_c = abstractFolder.children) !== null && _c !== void 0 ? _c : [];
            for (const child of children) {
                if (!(child instanceof obsidian.TFile))
                    continue;
                const match = child.name.match(pattern);
                if (!match)
                    continue;
                const day = parseInt(match[1]);
                const childFm = (_d = this.app.metadataCache.getFileCache(child)) === null || _d === void 0 ? void 0 : _d.frontmatter;
                let value = undefined;
                if (config.property === null || config.property === undefined) {
                    // File-existence mode (e.g. Morning Journal folder)
                    value = true;
                }
                else {
                    value = childFm === null || childFm === void 0 ? void 0 : childFm[config.property];
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

module.exports = MonthlyTrackerPlugin;
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWFpbi5qcyIsInNvdXJjZXMiOlsic3JjL3R5cGVzLnRzIiwic3JjL3NldHRpbmdzLnRzIiwic3JjL3ByZXNldHMudHMiLCJzcmMvcmVuZGVyZXIudHMiLCJzcmMvbWFpbi50cyJdLCJzb3VyY2VzQ29udGVudCI6WyJleHBvcnQgaW50ZXJmYWNlIEJvb2xlYW5Db25maWcge1xuICB0eXBlOiAnYm9vbGVhbic7XG4gIHRpdGxlPzogc3RyaW5nO1xuICBwcm9wZXJ0eTogc3RyaW5nO1xuICBzb3VyY2U/OiBzdHJpbmc7XG4gIC8qKiBoZXggY29sb3Igc3RyaW5nIG9yIHByZXNldCBuYW1lIChlLmcuIFwiYmx1ZVwiKSAqL1xuICBjb2xvcjogc3RyaW5nO1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIENvbG9ybWFwQ29uZmlnIHtcbiAgdHlwZTogJ2NvbG9ybWFwJztcbiAgdGl0bGU/OiBzdHJpbmc7XG4gIHByb3BlcnR5OiBzdHJpbmc7XG4gIHNvdXJjZT86IHN0cmluZztcbiAgLyoqIG1hcCBvZiB2YWx1ZSDihpIgaGV4IGNvbG9yLCBvciBvbWl0IGFuZCB1c2UgcHJlc2V0ICovXG4gIGNvbG9ycz86IFJlY29yZDxzdHJpbmcsIHN0cmluZz47XG4gIC8qKiBidWlsdC1pbiBjb2xvcm1hcCBwcmVzZXQgbmFtZSAoZS5nLiBcImNvbmRpdGlvblwiKSAqL1xuICBwcmVzZXQ/OiBzdHJpbmc7XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgSGVhdG1hcENvbmZpZyB7XG4gIHR5cGU6ICdoZWF0bWFwJztcbiAgdGl0bGU/OiBzdHJpbmc7XG4gIHByb3BlcnR5OiBzdHJpbmc7XG4gIHNvdXJjZT86IHN0cmluZztcbiAgdW5pdD86IHN0cmluZztcbiAgLyoqXG4gICAqIFRocmVzaG9sZHMgc2VwYXJhdGluZyBpbnRlbnNpdHkgbGV2ZWxzLlxuICAgKiBlLmcuIFszLCA1LCA3LCAxMF0g4oaSIDUgYnVja2V0czogWzAsMyksIFszLDUpLCBbNSw3KSwgWzcsMTApLCBbMTAs4oieKVxuICAgKi9cbiAgYmlucz86IG51bWJlcltdO1xuICAvKiogYXJyYXkgb2YgaGV4IGNvbG9ycywgbGVuZ3RoID0gYmlucy5sZW5ndGggKyAxLCBvciBvbWl0IGFuZCB1c2UgY29sb3JTY2hlbWUgKi9cbiAgY29sb3JzPzogc3RyaW5nW107XG4gIC8qKiBidWlsdC1pbiBoZWF0bWFwIGNvbG9yIHNjaGVtZSBuYW1lIChlLmcuIFwiaW5kaWdvXCIpICovXG4gIGNvbG9yU2NoZW1lPzogc3RyaW5nO1xuICBzaG93VG90YWw/OiBib29sZWFuO1xuICAvKiogbGFiZWwgc2hvd24gbmV4dCB0byB0b3RhbCwgZGVmYXVsdHMgdG8gcHJvcGVydHkgbmFtZSAqL1xuICB0b3RhbExhYmVsPzogc3RyaW5nO1xufVxuXG5leHBvcnQgdHlwZSBUcmFja2VyQ29uZmlnID0gQm9vbGVhbkNvbmZpZyB8IENvbG9ybWFwQ29uZmlnIHwgSGVhdG1hcENvbmZpZztcblxuZXhwb3J0IGludGVyZmFjZSBQbHVnaW5TZXR0aW5ncyB7XG4gIGRhaWx5Tm90ZXNGb2xkZXI6IHN0cmluZztcbiAgZGF0ZUZvcm1hdDogc3RyaW5nO1xufVxuXG5leHBvcnQgY29uc3QgREVGQVVMVF9TRVRUSU5HUzogUGx1Z2luU2V0dGluZ3MgPSB7XG4gIGRhaWx5Tm90ZXNGb2xkZXI6ICcwNCBDYWxlbmRhci9EYXlzJyxcbiAgZGF0ZUZvcm1hdDogJ1lZWVktTU0tREQnLFxufTtcbiIsImltcG9ydCB7IEFwcCwgUGx1Z2luU2V0dGluZ1RhYiwgU2V0dGluZyB9IGZyb20gJ29ic2lkaWFuJztcbmltcG9ydCB0eXBlIE1vbnRobHlUcmFja2VyUGx1Z2luIGZyb20gJy4vbWFpbic7XG5cbmV4cG9ydCBjbGFzcyBNb250aGx5VHJhY2tlclNldHRpbmdUYWIgZXh0ZW5kcyBQbHVnaW5TZXR0aW5nVGFiIHtcbiAgcGx1Z2luOiBNb250aGx5VHJhY2tlclBsdWdpbjtcblxuICBjb25zdHJ1Y3RvcihhcHA6IEFwcCwgcGx1Z2luOiBNb250aGx5VHJhY2tlclBsdWdpbikge1xuICAgIHN1cGVyKGFwcCwgcGx1Z2luKTtcbiAgICB0aGlzLnBsdWdpbiA9IHBsdWdpbjtcbiAgfVxuXG4gIGRpc3BsYXkoKTogdm9pZCB7XG4gICAgY29uc3QgeyBjb250YWluZXJFbCB9ID0gdGhpcztcbiAgICBjb250YWluZXJFbC5lbXB0eSgpO1xuXG4gICAgbmV3IFNldHRpbmcoY29udGFpbmVyRWwpXG4gICAgICAuc2V0TmFtZSgnRGFpbHkgbm90ZXMgZm9sZGVyJylcbiAgICAgIC5zZXREZXNjKCdGb2xkZXIgY29udGFpbmluZyBkYWlseSBub3RlcyAoZS5nLiAwNCBDYWxlbmRhci9EYXlzKScpXG4gICAgICAuYWRkVGV4dCh0ZXh0ID0+XG4gICAgICAgIHRleHRcbiAgICAgICAgICAuc2V0UGxhY2Vob2xkZXIoJzA0IENhbGVuZGFyL0RheXMnKVxuICAgICAgICAgIC5zZXRWYWx1ZSh0aGlzLnBsdWdpbi5zZXR0aW5ncy5kYWlseU5vdGVzRm9sZGVyKVxuICAgICAgICAgIC5vbkNoYW5nZShhc3luYyAodmFsdWUpID0+IHtcbiAgICAgICAgICAgIHRoaXMucGx1Z2luLnNldHRpbmdzLmRhaWx5Tm90ZXNGb2xkZXIgPSB2YWx1ZS50cmltKCk7XG4gICAgICAgICAgICBhd2FpdCB0aGlzLnBsdWdpbi5zYXZlU2V0dGluZ3MoKTtcbiAgICAgICAgICB9KSxcbiAgICAgICk7XG5cbiAgICBuZXcgU2V0dGluZyhjb250YWluZXJFbClcbiAgICAgIC5zZXROYW1lKCdEYXRlIGZvcm1hdCcpXG4gICAgICAuc2V0RGVzYygnRmlsZSBuYW1lIGRhdGUgZm9ybWF0LiBNdXN0IG1hdGNoIFlZWVktTU0tREQgYXQgdGhlIHN0YXJ0IG9mIGZpbGUgbmFtZXMuJylcbiAgICAgIC5hZGRUZXh0KHRleHQgPT5cbiAgICAgICAgdGV4dFxuICAgICAgICAgIC5zZXRQbGFjZWhvbGRlcignWVlZWS1NTS1ERCcpXG4gICAgICAgICAgLnNldFZhbHVlKHRoaXMucGx1Z2luLnNldHRpbmdzLmRhdGVGb3JtYXQpXG4gICAgICAgICAgLm9uQ2hhbmdlKGFzeW5jICh2YWx1ZSkgPT4ge1xuICAgICAgICAgICAgdGhpcy5wbHVnaW4uc2V0dGluZ3MuZGF0ZUZvcm1hdCA9IHZhbHVlLnRyaW0oKTtcbiAgICAgICAgICAgIGF3YWl0IHRoaXMucGx1Z2luLnNhdmVTZXR0aW5ncygpO1xuICAgICAgICAgIH0pLFxuICAgICAgKTtcbiAgfVxufVxuIiwiLyoqIFNpbmdsZS1jb2xvciBwcmVzZXRzIGZvciBib29sZWFuIHRyYWNrZXIgKi9cbmV4cG9ydCBjb25zdCBDT0xPUl9QUkVTRVRTOiBSZWNvcmQ8c3RyaW5nLCBzdHJpbmc+ID0ge1xuICBibHVlOiAgICcjNjRiNWY2JyxcbiAgZ3JlZW46ICAnIzY2YmI2YScsXG4gIHJlZDogICAgJyNlNTczNzMnLFxuICBwdXJwbGU6ICcjYmE2OGM4JyxcbiAgb3JhbmdlOiAnI2ZmYjc0ZCcsXG4gIHllbGxvdzogJyNmZmQ1NGYnLFxuICB0ZWFsOiAgICcjNGRiNmFjJyxcbiAgaW5kaWdvOiAnIzc5ODZjYicsXG4gIHBpbms6ICAgJyNmMDYyOTInLFxufTtcblxuLyoqXG4gKiBIZWF0bWFwIGNvbG9yLXNjaGVtZSBwcmVzZXRzLlxuICogSW5kZXggMCA9IG5vIGRhdGEsIGluZGV4IDEuLm4gPSBpbmNyZWFzaW5nIGludGVuc2l0eS5cbiAqL1xuZXhwb3J0IGNvbnN0IEhFQVRNQVBfU0NIRU1FUzogUmVjb3JkPHN0cmluZywgc3RyaW5nW10+ID0ge1xuICBibHVlOiAgIFsnI2ViZWRmMCcsICcjYmJkZWZiJywgJyM5MGNhZjknLCAnIzY0YjVmNicsICcjNDJhNWY1JywgJyMxZTg4ZTUnXSxcbiAgZ3JlZW46ICBbJyNlYmVkZjAnLCAnI2M4ZTZjOScsICcjYTVkNmE3JywgJyM4MWM3ODQnLCAnIzY2YmI2YScsICcjNDNhMDQ3J10sXG4gIHJlZDogICAgWycjZWJlZGYwJywgJyNmZmNkZDInLCAnI2VmOWE5YScsICcjZTU3MzczJywgJyNlZjUzNTAnLCAnI2U1MzkzNSddLFxuICBwdXJwbGU6IFsnI2ViZWRmMCcsICcjZTFiZWU3JywgJyNjZTkzZDgnLCAnI2JhNjhjOCcsICcjYWI0N2JjJywgJyM4ZTI0YWEnXSxcbiAgb3JhbmdlOiBbJyNlYmVkZjAnLCAnI2ZmZTBiMicsICcjZmZjYzgwJywgJyNmZmI3NGQnLCAnI2ZmYTcyNicsICcjZmI4YzAwJ10sXG4gIHllbGxvdzogWycjZWJlZGYwJywgJyNmZmY5YzQnLCAnI2ZmZjU5ZCcsICcjZmZmMTc2JywgJyNmZmVlNTgnLCAnI2ZkZDgzNSddLFxuICB0ZWFsOiAgIFsnI2ViZWRmMCcsICcjYjJkZmRiJywgJyM4MGNiYzQnLCAnIzRkYjZhYycsICcjMjZhNjlhJywgJyMwMDg5N2InXSxcbiAgaW5kaWdvOiBbJyNlYmVkZjAnLCAnI2U4ZWFmNicsICcjYzVjYWU5JywgJyM5ZmE4ZGEnLCAnIzc5ODZjYicsICcjNWM2YmMwJ10sXG4gIHBpbms6ICAgWycjZWJlZGYwJywgJyNmY2U0ZWMnLCAnI2Y0OGZiMScsICcjZjA2MjkyJywgJyNlYzQwN2EnLCAnI2Q4MWI2MCddLFxufTtcblxuLyoqIENvbG9ybWFwIHByZXNldHM6IG5hbWVkIHZhbHVlIOKGkiBjb2xvciAqL1xuZXhwb3J0IGNvbnN0IENPTE9STUFQX1BSRVNFVFM6IFJlY29yZDxzdHJpbmcsIFJlY29yZDxzdHJpbmcsIHN0cmluZz4+ID0ge1xuICBjb25kaXRpb246IHtcbiAgICBnb29kOiAgJyMyMTk2ZjMnLFxuICAgIHNvc286ICAnIzhiYzM0YScsXG4gICAgdGlyZWQ6ICcjZmY5ODAwJyxcbiAgICBiYWQ6ICAgJyNmNDQzMzYnLFxuICB9LFxufTtcblxuLyoqIFJlc29sdmUgYSBjb2xvciBzdHJpbmc6IGlmIGl0J3MgYSBrbm93biBwcmVzZXQgbmFtZSwgcmV0dXJuIHRoZSBoZXg7IG90aGVyd2lzZSByZXR1cm4gYXMtaXMuICovXG5leHBvcnQgZnVuY3Rpb24gcmVzb2x2ZUNvbG9yKGNvbG9yOiBzdHJpbmcpOiBzdHJpbmcge1xuICByZXR1cm4gQ09MT1JfUFJFU0VUU1tjb2xvci50b0xvd2VyQ2FzZSgpXSA/PyBjb2xvcjtcbn1cblxuLyoqIFJlc29sdmUgaGVhdG1hcCBjb2xvcnMgYXJyYXkgZnJvbSBjb2xvclNjaGVtZSBwcmVzZXQgb3IgZXhwbGljaXQgY29sb3JzIGFycmF5LiAqL1xuZXhwb3J0IGZ1bmN0aW9uIHJlc29sdmVIZWF0bWFwQ29sb3JzKGNvbG9ycz86IHN0cmluZ1tdLCBjb2xvclNjaGVtZT86IHN0cmluZyk6IHN0cmluZ1tdIHtcbiAgaWYgKGNvbG9ycyAmJiBjb2xvcnMubGVuZ3RoID4gMCkgcmV0dXJuIGNvbG9ycztcbiAgaWYgKGNvbG9yU2NoZW1lKSB7XG4gICAgY29uc3Qgc2NoZW1lID0gSEVBVE1BUF9TQ0hFTUVTW2NvbG9yU2NoZW1lLnRvTG93ZXJDYXNlKCldO1xuICAgIGlmIChzY2hlbWUpIHJldHVybiBzY2hlbWU7XG4gIH1cbiAgcmV0dXJuIEhFQVRNQVBfU0NIRU1FU1snaW5kaWdvJ107XG59XG5cbi8qKiBSZXNvbHZlIGNvbG9ybWFwIGNvbG9ycyBmcm9tIHByZXNldCBvciBleHBsaWNpdCBjb2xvcnMgbWFwLiAqL1xuZXhwb3J0IGZ1bmN0aW9uIHJlc29sdmVDb2xvcm1hcENvbG9ycyhcbiAgY29sb3JzPzogUmVjb3JkPHN0cmluZywgc3RyaW5nPixcbiAgcHJlc2V0Pzogc3RyaW5nLFxuKTogUmVjb3JkPHN0cmluZywgc3RyaW5nPiB7XG4gIGlmIChjb2xvcnMgJiYgT2JqZWN0LmtleXMoY29sb3JzKS5sZW5ndGggPiAwKSByZXR1cm4gY29sb3JzO1xuICBpZiAocHJlc2V0KSB7XG4gICAgY29uc3QgcCA9IENPTE9STUFQX1BSRVNFVFNbcHJlc2V0LnRvTG93ZXJDYXNlKCldO1xuICAgIGlmIChwKSByZXR1cm4gcDtcbiAgfVxuICByZXR1cm4ge307XG59XG4iLCJpbXBvcnQgeyBUcmFja2VyQ29uZmlnLCBCb29sZWFuQ29uZmlnLCBDb2xvcm1hcENvbmZpZywgSGVhdG1hcENvbmZpZyB9IGZyb20gJy4vdHlwZXMnO1xuaW1wb3J0IHtcbiAgcmVzb2x2ZUNvbG9yLFxuICByZXNvbHZlSGVhdG1hcENvbG9ycyxcbiAgcmVzb2x2ZUNvbG9ybWFwQ29sb3JzLFxufSBmcm9tICcuL3ByZXNldHMnO1xuXG5leHBvcnQgaW50ZXJmYWNlIERheURhdGEge1xuICBkYXk6IG51bWJlcjtcbiAgdmFsdWU6IHVua25vd247XG4gIGZpbGVQYXRoPzogc3RyaW5nO1xufVxuXG5jb25zdCBFTVBUWV9DT0xPUiA9ICcjZWJlZGYwJztcblxuZnVuY3Rpb24gZGF5Q2VsbChcbiAgZGF5OiBudW1iZXIsXG4gIGJnQ29sb3I6IHN0cmluZyxcbiAgZmlsZVBhdGg6IHN0cmluZyB8IHVuZGVmaW5lZCxcbiAgdG9vbHRpcDogc3RyaW5nLFxuICB0ZXh0U3R5bGU6IHN0cmluZyxcbik6IHN0cmluZyB7XG4gIGNvbnN0IGJhc2UgPSBgYmFja2dyb3VuZC1jb2xvcjoke2JnQ29sb3J9O2Rpc3BsYXk6ZmxleDthbGlnbi1pdGVtczpjZW50ZXI7anVzdGlmeS1jb250ZW50OmNlbnRlcjtwYWRkaW5nOjRweCAycHg7Ym9yZGVyLXJhZGl1czoycHg7Zm9udC1zaXplOjlweDttaW4td2lkdGg6MjJweDtib3gtc2l6aW5nOmJvcmRlci1ib3g7JHt0ZXh0U3R5bGV9YDtcblxuICBpZiAoZmlsZVBhdGgpIHtcbiAgICByZXR1cm4gYDxhIGhyZWY9XCIke2ZpbGVQYXRofVwiIGNsYXNzPVwiaW50ZXJuYWwtbGlua1wiIHRpdGxlPVwiJHt0b29sdGlwfVwiIHN0eWxlPVwiJHtiYXNlfTt0ZXh0LWRlY29yYXRpb246bm9uZTtcIj4ke2RheX08L2E+YDtcbiAgfVxuICByZXR1cm4gYDxkaXYgdGl0bGU9XCIke3Rvb2x0aXB9XCIgc3R5bGU9XCIke2Jhc2V9XCI+JHtkYXl9PC9kaXY+YDtcbn1cblxuZnVuY3Rpb24gd3JhcEdyaWQoY2VsbHM6IHN0cmluZyk6IHN0cmluZyB7XG4gIHJldHVybiBgPGRpdiBzdHlsZT1cImRpc3BsYXk6ZmxleDtnYXA6MnB4O292ZXJmbG93LXg6YXV0bzttYXJnaW4tYm90dG9tOjhweDtcIj4ke2NlbGxzfTwvZGl2PmA7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiByZW5kZXJCb29sZWFuKGNvbmZpZzogQm9vbGVhbkNvbmZpZywgZGF0YTogTWFwPG51bWJlciwgRGF5RGF0YT4sIGRheXNJbk1vbnRoOiBudW1iZXIpOiBzdHJpbmcge1xuICBjb25zdCBhY3RpdmVDb2xvciA9IHJlc29sdmVDb2xvcihjb25maWcuY29sb3IpO1xuICBsZXQgY2VsbHMgPSAnJztcblxuICBmb3IgKGxldCBkYXkgPSAxOyBkYXkgPD0gZGF5c0luTW9udGg7IGRheSsrKSB7XG4gICAgY29uc3QgZW50cnkgPSBkYXRhLmdldChkYXkpO1xuICAgIGNvbnN0IGFjdGl2ZSA9IGVudHJ5ICE9PSB1bmRlZmluZWQgJiYgISFlbnRyeS52YWx1ZTtcbiAgICBjb25zdCBiZ0NvbG9yID0gYWN0aXZlID8gYWN0aXZlQ29sb3IgOiBFTVBUWV9DT0xPUjtcbiAgICBjb25zdCB0ZXh0U3R5bGUgPSBhY3RpdmUgPyAnZm9udC13ZWlnaHQ6NjAwO2NvbG9yOndoaXRlOycgOiAnY29sb3I6Izk5OTsnO1xuICAgIGNlbGxzICs9IGRheUNlbGwoZGF5LCBiZ0NvbG9yLCBlbnRyeT8uZmlsZVBhdGgsIGFjdGl2ZSA/ICdZZXMnIDogJycsIHRleHRTdHlsZSk7XG4gIH1cblxuICByZXR1cm4gd3JhcEdyaWQoY2VsbHMpO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gcmVuZGVyQ29sb3JtYXAoY29uZmlnOiBDb2xvcm1hcENvbmZpZywgZGF0YTogTWFwPG51bWJlciwgRGF5RGF0YT4sIGRheXNJbk1vbnRoOiBudW1iZXIpOiBzdHJpbmcge1xuICBjb25zdCBjb2xvck1hcCA9IHJlc29sdmVDb2xvcm1hcENvbG9ycyhjb25maWcuY29sb3JzLCBjb25maWcucHJlc2V0KTtcbiAgbGV0IGNlbGxzID0gJyc7XG5cbiAgZm9yIChsZXQgZGF5ID0gMTsgZGF5IDw9IGRheXNJbk1vbnRoOyBkYXkrKykge1xuICAgIGNvbnN0IGVudHJ5ID0gZGF0YS5nZXQoZGF5KTtcbiAgICBjb25zdCB2YWwgPSBlbnRyeT8udmFsdWUgYXMgc3RyaW5nIHwgdW5kZWZpbmVkO1xuICAgIGNvbnN0IGJnQ29sb3IgPSAodmFsICYmIGNvbG9yTWFwW3ZhbF0pID8gY29sb3JNYXBbdmFsXSA6IEVNUFRZX0NPTE9SO1xuICAgIGNvbnN0IGhhc0RhdGEgPSB2YWwgJiYgY29sb3JNYXBbdmFsXTtcbiAgICBjb25zdCB0ZXh0U3R5bGUgPSBoYXNEYXRhID8gJ2ZvbnQtd2VpZ2h0OjYwMDtjb2xvcjp3aGl0ZTsnIDogJ2NvbG9yOiM5OTk7JztcbiAgICBjZWxscyArPSBkYXlDZWxsKGRheSwgYmdDb2xvciwgZW50cnk/LmZpbGVQYXRoLCB2YWwgPz8gJycsIHRleHRTdHlsZSk7XG4gIH1cblxuICByZXR1cm4gd3JhcEdyaWQoY2VsbHMpO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gcmVuZGVySGVhdG1hcChjb25maWc6IEhlYXRtYXBDb25maWcsIGRhdGE6IE1hcDxudW1iZXIsIERheURhdGE+LCBkYXlzSW5Nb250aDogbnVtYmVyKTogc3RyaW5nIHtcbiAgY29uc3QgY29sb3JzID0gcmVzb2x2ZUhlYXRtYXBDb2xvcnMoY29uZmlnLmNvbG9ycywgY29uZmlnLmNvbG9yU2NoZW1lKTtcbiAgY29uc3QgYmlucyA9IGNvbmZpZy5iaW5zID8/IFsxLCAzLCA1LCA3XTtcbiAgY29uc3QgdW5pdCA9IGNvbmZpZy51bml0ID8/ICcnO1xuXG4gIGZ1bmN0aW9uIGdldEludGVuc2l0eSh2YWw6IG51bWJlcik6IG51bWJlciB7XG4gICAgaWYgKCF2YWwgfHwgdmFsIDw9IDApIHJldHVybiAwO1xuICAgIGZvciAobGV0IGkgPSAwOyBpIDwgYmlucy5sZW5ndGg7IGkrKykge1xuICAgICAgaWYgKHZhbCA8IGJpbnNbaV0pIHJldHVybiBpICsgMTtcbiAgICB9XG4gICAgcmV0dXJuIGJpbnMubGVuZ3RoICsgMTtcbiAgfVxuXG4gIGNvbnN0IG1heEludGVuc2l0eSA9IGJpbnMubGVuZ3RoICsgMTtcbiAgY29uc3Qgc2FmZUNvbG9ycyA9IGNvbG9ycy5sZW5ndGggPj0gbWF4SW50ZW5zaXR5ICsgMSA/IGNvbG9ycyA6IFtcbiAgICAuLi5jb2xvcnMsXG4gICAgLi4uQXJyYXkobWF4SW50ZW5zaXR5ICsgMSAtIGNvbG9ycy5sZW5ndGgpLmZpbGwoY29sb3JzW2NvbG9ycy5sZW5ndGggLSAxXSA/PyBFTVBUWV9DT0xPUiksXG4gIF07XG5cbiAgbGV0IHRvdGFsID0gMDtcbiAgbGV0IGNlbGxzID0gJyc7XG5cbiAgZm9yIChsZXQgZGF5ID0gMTsgZGF5IDw9IGRheXNJbk1vbnRoOyBkYXkrKykge1xuICAgIGNvbnN0IGVudHJ5ID0gZGF0YS5nZXQoZGF5KTtcbiAgICBjb25zdCB2YWwgPSB0eXBlb2YgZW50cnk/LnZhbHVlID09PSAnbnVtYmVyJyA/IGVudHJ5LnZhbHVlIDogMDtcbiAgICB0b3RhbCArPSB2YWw7XG4gICAgY29uc3QgaW50ZW5zaXR5ID0gZ2V0SW50ZW5zaXR5KHZhbCk7XG4gICAgY29uc3QgYmdDb2xvciA9IHNhZmVDb2xvcnNbaW50ZW5zaXR5XSA/PyBFTVBUWV9DT0xPUjtcbiAgICBjb25zdCBoYXNEYXRhID0gaW50ZW5zaXR5ID4gMDtcbiAgICBjb25zdCB0ZXh0U3R5bGUgPSBoYXNEYXRhID8gJ2ZvbnQtd2VpZ2h0OjYwMDtjb2xvcjp3aGl0ZTsnIDogJ2NvbG9yOiM5OTk7JztcbiAgICBjb25zdCB0b29sdGlwID0gdmFsID4gMCA/IGAke3ZhbH0ke3VuaXR9YCA6ICcnO1xuICAgIGNlbGxzICs9IGRheUNlbGwoZGF5LCBiZ0NvbG9yLCBlbnRyeT8uZmlsZVBhdGgsIHRvb2x0aXAsIHRleHRTdHlsZSk7XG4gIH1cblxuICBsZXQgaHRtbCA9ICcnO1xuICBpZiAoY29uZmlnLnNob3dUb3RhbCkge1xuICAgIGNvbnN0IGxhYmVsID0gY29uZmlnLnRvdGFsTGFiZWwgPz8gKHVuaXQgPyBg7ZWp6rOEYCA6ICftlanqs4QnKTtcbiAgICBodG1sICs9IGA8ZGl2IHN0eWxlPVwibWFyZ2luLWJvdHRvbTo2cHg7Zm9udC1zaXplOjEycHg7Y29sb3I6dmFyKC0tdGV4dC1tdXRlZCk7XCI+JHtsYWJlbH06IDxzcGFuIHN0eWxlPVwiZm9udC13ZWlnaHQ6NjAwO2NvbG9yOnZhcigtLXRleHQtbm9ybWFsKTtcIj4ke3RvdGFsLnRvRml4ZWQoMSl9JHt1bml0fTwvc3Bhbj48L2Rpdj5gO1xuICB9XG4gIGh0bWwgKz0gd3JhcEdyaWQoY2VsbHMpO1xuICByZXR1cm4gaHRtbDtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHJlbmRlclRyYWNrZXIoXG4gIGNvbmZpZzogVHJhY2tlckNvbmZpZyxcbiAgZGF0YTogTWFwPG51bWJlciwgRGF5RGF0YT4sXG4gIGRheXNJbk1vbnRoOiBudW1iZXIsXG4pOiBIVE1MRWxlbWVudCB7XG4gIGNvbnN0IGNvbnRhaW5lciA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2RpdicpO1xuICBjb250YWluZXIuc3R5bGUuZm9udEZhbWlseSA9IFwiLWFwcGxlLXN5c3RlbSwgQmxpbmtNYWNTeXN0ZW1Gb250LCAnU2Vnb2UgVUknLCBzYW5zLXNlcmlmXCI7XG5cbiAgbGV0IGlubmVyID0gJyc7XG4gIGlmIChjb25maWcudHlwZSA9PT0gJ2Jvb2xlYW4nKSB7XG4gICAgaW5uZXIgPSByZW5kZXJCb29sZWFuKGNvbmZpZywgZGF0YSwgZGF5c0luTW9udGgpO1xuICB9IGVsc2UgaWYgKGNvbmZpZy50eXBlID09PSAnY29sb3JtYXAnKSB7XG4gICAgaW5uZXIgPSByZW5kZXJDb2xvcm1hcChjb25maWcsIGRhdGEsIGRheXNJbk1vbnRoKTtcbiAgfSBlbHNlIGlmIChjb25maWcudHlwZSA9PT0gJ2hlYXRtYXAnKSB7XG4gICAgaW5uZXIgPSByZW5kZXJIZWF0bWFwKGNvbmZpZywgZGF0YSwgZGF5c0luTW9udGgpO1xuICB9XG5cbiAgY29udGFpbmVyLmlubmVySFRNTCA9IGlubmVyO1xuICByZXR1cm4gY29udGFpbmVyO1xufVxuIiwiaW1wb3J0IHsgUGx1Z2luLCBNYXJrZG93blBvc3RQcm9jZXNzb3JDb250ZXh0LCBURmlsZSwgcGFyc2VZYW1sIH0gZnJvbSAnb2JzaWRpYW4nO1xuaW1wb3J0IHsgUGx1Z2luU2V0dGluZ3MsIERFRkFVTFRfU0VUVElOR1MsIFRyYWNrZXJDb25maWcgfSBmcm9tICcuL3R5cGVzJztcbmltcG9ydCB7IE1vbnRobHlUcmFja2VyU2V0dGluZ1RhYiB9IGZyb20gJy4vc2V0dGluZ3MnO1xuaW1wb3J0IHsgcmVuZGVyVHJhY2tlciwgRGF5RGF0YSB9IGZyb20gJy4vcmVuZGVyZXInO1xuXG5leHBvcnQgZGVmYXVsdCBjbGFzcyBNb250aGx5VHJhY2tlclBsdWdpbiBleHRlbmRzIFBsdWdpbiB7XG4gIHNldHRpbmdzOiBQbHVnaW5TZXR0aW5ncztcblxuICBhc3luYyBvbmxvYWQoKSB7XG4gICAgYXdhaXQgdGhpcy5sb2FkU2V0dGluZ3MoKTtcbiAgICB0aGlzLmFkZFNldHRpbmdUYWIobmV3IE1vbnRobHlUcmFja2VyU2V0dGluZ1RhYih0aGlzLmFwcCwgdGhpcykpO1xuXG4gICAgdGhpcy5yZWdpc3Rlck1hcmtkb3duQ29kZUJsb2NrUHJvY2Vzc29yKFxuICAgICAgJ21vbnRobHktdHJhY2tlcicsXG4gICAgICBhc3luYyAoc291cmNlLCBlbCwgY3R4KSA9PiB7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgYXdhaXQgdGhpcy5wcm9jZXNzQmxvY2soc291cmNlLCBlbCwgY3R4KTtcbiAgICAgICAgfSBjYXRjaCAoZXJyKSB7XG4gICAgICAgICAgZWwuY3JlYXRlRWwoJ3ByZScsIHtcbiAgICAgICAgICAgIHRleHQ6IGBNb250aGx5IFRyYWNrZXIgRXJyb3I6XFxuJHtlcnIgaW5zdGFuY2VvZiBFcnJvciA/IGVyci5tZXNzYWdlIDogU3RyaW5nKGVycil9YCxcbiAgICAgICAgICAgIGNsczogJ21vbnRobHktdHJhY2tlci1lcnJvcicsXG4gICAgICAgICAgfSk7XG4gICAgICAgIH1cbiAgICAgIH0sXG4gICAgKTtcbiAgfVxuXG4gIHByaXZhdGUgYXN5bmMgcHJvY2Vzc0Jsb2NrKFxuICAgIHNvdXJjZTogc3RyaW5nLFxuICAgIGVsOiBIVE1MRWxlbWVudCxcbiAgICBjdHg6IE1hcmtkb3duUG9zdFByb2Nlc3NvckNvbnRleHQsXG4gICk6IFByb21pc2U8dm9pZD4ge1xuICAgIGNvbnN0IGNvbmZpZyA9IHBhcnNlWWFtbChzb3VyY2UudHJpbSgpKSBhcyBUcmFja2VyQ29uZmlnO1xuICAgIGlmICghY29uZmlnPy50eXBlKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoJ01pc3NpbmcgcmVxdWlyZWQgZmllbGQ6IHR5cGUgKGJvb2xlYW4gfCBjb2xvcm1hcCB8IGhlYXRtYXApJyk7XG4gICAgfVxuICAgIGlmICghY29uZmlnLnByb3BlcnR5ICYmIGNvbmZpZy50eXBlICE9PSAnYm9vbGVhbicpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcignTWlzc2luZyByZXF1aXJlZCBmaWVsZDogcHJvcGVydHknKTtcbiAgICB9XG5cbiAgICAvLyBSZWFkIHllYXIvbW9udGggZnJvbSB0aGUgY3VycmVudCBub3RlJ3MgZnJvbnRtYXR0ZXJcbiAgICBjb25zdCBjdXJyZW50RmlsZSA9IHRoaXMuYXBwLnZhdWx0LmdldEFic3RyYWN0RmlsZUJ5UGF0aChjdHguc291cmNlUGF0aCk7XG4gICAgaWYgKCEoY3VycmVudEZpbGUgaW5zdGFuY2VvZiBURmlsZSkpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcignQ2Fubm90IHJlc29sdmUgY3VycmVudCBmaWxlJyk7XG4gICAgfVxuICAgIGNvbnN0IGZtID0gdGhpcy5hcHAubWV0YWRhdGFDYWNoZS5nZXRGaWxlQ2FjaGUoY3VycmVudEZpbGUpPy5mcm9udG1hdHRlcjtcbiAgICBjb25zdCB5ZWFyOiBudW1iZXIgPSBmbT8ueWVhcjtcbiAgICBjb25zdCBtb250aDogbnVtYmVyID0gZm0/Lm1vbnRoO1xuICAgIGlmICgheWVhciB8fCAhbW9udGgpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihcIkN1cnJlbnQgbm90ZSBtdXN0IGhhdmUgJ3llYXInIGFuZCAnbW9udGgnIGluIGZyb250bWF0dGVyXCIpO1xuICAgIH1cblxuICAgIGNvbnN0IGRheXNJbk1vbnRoID0gbmV3IERhdGUoeWVhciwgbW9udGgsIDApLmdldERhdGUoKTtcbiAgICBjb25zdCBmb2xkZXIgPSBjb25maWcuc291cmNlID8/IHRoaXMuc2V0dGluZ3MuZGFpbHlOb3Rlc0ZvbGRlcjtcbiAgICBjb25zdCBtbSA9IFN0cmluZyhtb250aCkucGFkU3RhcnQoMiwgJzAnKTtcbiAgICBjb25zdCBwYXR0ZXJuID0gbmV3IFJlZ0V4cChgXiR7eWVhcn0tJHttbX0tKFxcXFxkezJ9KWApO1xuXG4gICAgLy8gU2NhbiB2YXVsdCBmb2xkZXIgZm9yIG1hdGNoaW5nIGRhaWx5IG5vdGVzXG4gICAgY29uc3QgZGF0YSA9IG5ldyBNYXA8bnVtYmVyLCBEYXlEYXRhPigpO1xuICAgIGNvbnN0IGFic3RyYWN0Rm9sZGVyID0gdGhpcy5hcHAudmF1bHQuZ2V0QWJzdHJhY3RGaWxlQnlQYXRoKGZvbGRlcik7XG5cbiAgICBpZiAoYWJzdHJhY3RGb2xkZXIpIHtcbiAgICAgIC8vIEB0cy1pZ25vcmUg4oCUIFRGb2xkZXIgaGFzIGNoaWxkcmVuXG4gICAgICBjb25zdCBjaGlsZHJlbjogdW5rbm93bltdID0gYWJzdHJhY3RGb2xkZXIuY2hpbGRyZW4gPz8gW107XG4gICAgICBmb3IgKGNvbnN0IGNoaWxkIG9mIGNoaWxkcmVuKSB7XG4gICAgICAgIGlmICghKGNoaWxkIGluc3RhbmNlb2YgVEZpbGUpKSBjb250aW51ZTtcbiAgICAgICAgY29uc3QgbWF0Y2ggPSBjaGlsZC5uYW1lLm1hdGNoKHBhdHRlcm4pO1xuICAgICAgICBpZiAoIW1hdGNoKSBjb250aW51ZTtcbiAgICAgICAgY29uc3QgZGF5ID0gcGFyc2VJbnQobWF0Y2hbMV0pO1xuXG4gICAgICAgIGNvbnN0IGNoaWxkRm0gPSB0aGlzLmFwcC5tZXRhZGF0YUNhY2hlLmdldEZpbGVDYWNoZShjaGlsZCk/LmZyb250bWF0dGVyO1xuICAgICAgICBsZXQgdmFsdWU6IHVua25vd24gPSB1bmRlZmluZWQ7XG5cbiAgICAgICAgaWYgKGNvbmZpZy5wcm9wZXJ0eSA9PT0gbnVsbCB8fCBjb25maWcucHJvcGVydHkgPT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgIC8vIEZpbGUtZXhpc3RlbmNlIG1vZGUgKGUuZy4gTW9ybmluZyBKb3VybmFsIGZvbGRlcilcbiAgICAgICAgICB2YWx1ZSA9IHRydWU7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgdmFsdWUgPSBjaGlsZEZtPy5bY29uZmlnLnByb3BlcnR5XTtcbiAgICAgICAgfVxuXG4gICAgICAgIGRhdGEuc2V0KGRheSwgeyBkYXksIHZhbHVlLCBmaWxlUGF0aDogY2hpbGQucGF0aCB9KTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICBjb25zdCByZW5kZXJlZCA9IHJlbmRlclRyYWNrZXIoY29uZmlnLCBkYXRhLCBkYXlzSW5Nb250aCk7XG4gICAgZWwuYXBwZW5kQ2hpbGQocmVuZGVyZWQpO1xuICB9XG5cbiAgYXN5bmMgbG9hZFNldHRpbmdzKCkge1xuICAgIHRoaXMuc2V0dGluZ3MgPSBPYmplY3QuYXNzaWduKHt9LCBERUZBVUxUX1NFVFRJTkdTLCBhd2FpdCB0aGlzLmxvYWREYXRhKCkpO1xuICB9XG5cbiAgYXN5bmMgc2F2ZVNldHRpbmdzKCkge1xuICAgIGF3YWl0IHRoaXMuc2F2ZURhdGEodGhpcy5zZXR0aW5ncyk7XG4gIH1cbn1cbiJdLCJuYW1lcyI6WyJQbHVnaW5TZXR0aW5nVGFiIiwiU2V0dGluZyIsIlBsdWdpbiIsInBhcnNlWWFtbCIsIlRGaWxlIl0sIm1hcHBpbmdzIjoiOzs7O0FBK0NPLE1BQU0sZ0JBQWdCLEdBQW1CO0FBQzlDLElBQUEsZ0JBQWdCLEVBQUUsa0JBQWtCO0FBQ3BDLElBQUEsVUFBVSxFQUFFLFlBQVk7Q0FDekI7O0FDL0NLLE1BQU8sd0JBQXlCLFNBQVFBLHlCQUFnQixDQUFBO0lBRzVELFdBQVksQ0FBQSxH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
