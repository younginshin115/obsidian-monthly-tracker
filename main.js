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

function buildDatePattern(dateFormat, year, month) {
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
        const pattern = buildDatePattern(this.settings.dateFormat, year, Number(month));
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWFpbi5qcyIsInNvdXJjZXMiOlsic3JjL3R5cGVzLnRzIiwic3JjL3NldHRpbmdzLnRzIiwic3JjL3ByZXNldHMudHMiLCJzcmMvcmVuZGVyZXIudHMiLCJzcmMvbWFpbi50cyJdLCJzb3VyY2VzQ29udGVudCI6WyJleHBvcnQgaW50ZXJmYWNlIEJvb2xlYW5Db25maWcge1xuICB0eXBlOiAnYm9vbGVhbic7XG4gIHRpdGxlPzogc3RyaW5nO1xuICBwcm9wZXJ0eT86IHN0cmluZztcbiAgc291cmNlPzogc3RyaW5nO1xuICAvKiogaGV4IGNvbG9yIHN0cmluZyBvciBwcmVzZXQgbmFtZSAoZS5nLiBcImJsdWVcIikgKi9cbiAgY29sb3I6IHN0cmluZztcbn1cblxuZXhwb3J0IGludGVyZmFjZSBDb2xvcm1hcENvbmZpZyB7XG4gIHR5cGU6ICdjb2xvcm1hcCc7XG4gIHRpdGxlPzogc3RyaW5nO1xuICBwcm9wZXJ0eTogc3RyaW5nO1xuICBzb3VyY2U/OiBzdHJpbmc7XG4gIGNvbG9yczogUmVjb3JkPHN0cmluZywgc3RyaW5nPjtcbn1cblxuZXhwb3J0IGludGVyZmFjZSBIZWF0bWFwQ29uZmlnIHtcbiAgdHlwZTogJ2hlYXRtYXAnO1xuICB0aXRsZT86IHN0cmluZztcbiAgcHJvcGVydHk6IHN0cmluZztcbiAgc291cmNlPzogc3RyaW5nO1xuICB1bml0Pzogc3RyaW5nO1xuICAvKipcbiAgICogVGhyZXNob2xkcyBzZXBhcmF0aW5nIGludGVuc2l0eSBsZXZlbHMuXG4gICAqIGUuZy4gWzMsIDUsIDcsIDEwXSDihpIgNSBidWNrZXRzOiBbMCwzKSwgWzMsNSksIFs1LDcpLCBbNywxMCksIFsxMCziiJ4pXG4gICAqL1xuICBiaW5zPzogbnVtYmVyW107XG4gIC8qKiBhcnJheSBvZiBoZXggY29sb3JzLCBsZW5ndGggPSBiaW5zLmxlbmd0aCArIDEsIG9yIG9taXQgYW5kIHVzZSBjb2xvclNjaGVtZSAqL1xuICBjb2xvcnM/OiBzdHJpbmdbXTtcbiAgLyoqIGJ1aWx0LWluIGhlYXRtYXAgY29sb3Igc2NoZW1lIG5hbWUgKGUuZy4gXCJpbmRpZ29cIikgKi9cbiAgY29sb3JTY2hlbWU/OiBzdHJpbmc7XG4gIHNob3dUb3RhbD86IGJvb2xlYW47XG4gIC8qKiBsYWJlbCBzaG93biBuZXh0IHRvIHRvdGFsLCBkZWZhdWx0cyB0byBwcm9wZXJ0eSBuYW1lICovXG4gIHRvdGFsTGFiZWw/OiBzdHJpbmc7XG59XG5cbmV4cG9ydCB0eXBlIFRyYWNrZXJDb25maWcgPSBCb29sZWFuQ29uZmlnIHwgQ29sb3JtYXBDb25maWcgfCBIZWF0bWFwQ29uZmlnO1xuXG5leHBvcnQgaW50ZXJmYWNlIFBsdWdpblNldHRpbmdzIHtcbiAgZGFpbHlOb3Rlc0ZvbGRlcjogc3RyaW5nO1xuICBkYXRlRm9ybWF0OiBzdHJpbmc7XG59XG5cbmV4cG9ydCBjb25zdCBERUZBVUxUX1NFVFRJTkdTOiBQbHVnaW5TZXR0aW5ncyA9IHtcbiAgZGFpbHlOb3Rlc0ZvbGRlcjogJzA0IENhbGVuZGFyL0RheXMnLFxuICBkYXRlRm9ybWF0OiAnWVlZWS1NTS1ERCcsXG59O1xuIiwiaW1wb3J0IHsgQXBwLCBQbHVnaW5TZXR0aW5nVGFiLCBTZXR0aW5nIH0gZnJvbSAnb2JzaWRpYW4nO1xuaW1wb3J0IHR5cGUgTW9udGhseVRyYWNrZXJQbHVnaW4gZnJvbSAnLi9tYWluJztcblxuZXhwb3J0IGNsYXNzIE1vbnRobHlUcmFja2VyU2V0dGluZ1RhYiBleHRlbmRzIFBsdWdpblNldHRpbmdUYWIge1xuICBwbHVnaW46IE1vbnRobHlUcmFja2VyUGx1Z2luO1xuXG4gIGNvbnN0cnVjdG9yKGFwcDogQXBwLCBwbHVnaW46IE1vbnRobHlUcmFja2VyUGx1Z2luKSB7XG4gICAgc3VwZXIoYXBwLCBwbHVnaW4pO1xuICAgIHRoaXMucGx1Z2luID0gcGx1Z2luO1xuICB9XG5cbiAgZGlzcGxheSgpOiB2b2lkIHtcbiAgICBjb25zdCB7IGNvbnRhaW5lckVsIH0gPSB0aGlzO1xuICAgIGNvbnRhaW5lckVsLmVtcHR5KCk7XG5cbiAgICBuZXcgU2V0dGluZyhjb250YWluZXJFbClcbiAgICAgIC5zZXROYW1lKCdEYWlseSBub3RlcyBmb2xkZXInKVxuICAgICAgLnNldERlc2MoJ0ZvbGRlciBjb250YWluaW5nIGRhaWx5IG5vdGVzIChlLmcuIDA0IENhbGVuZGFyL0RheXMpJylcbiAgICAgIC5hZGRUZXh0KHRleHQgPT5cbiAgICAgICAgdGV4dFxuICAgICAgICAgIC5zZXRQbGFjZWhvbGRlcignMDQgQ2FsZW5kYXIvRGF5cycpXG4gICAgICAgICAgLnNldFZhbHVlKHRoaXMucGx1Z2luLnNldHRpbmdzLmRhaWx5Tm90ZXNGb2xkZXIpXG4gICAgICAgICAgLm9uQ2hhbmdlKGFzeW5jICh2YWx1ZSkgPT4ge1xuICAgICAgICAgICAgdGhpcy5wbHVnaW4uc2V0dGluZ3MuZGFpbHlOb3Rlc0ZvbGRlciA9IHZhbHVlLnRyaW0oKTtcbiAgICAgICAgICAgIGF3YWl0IHRoaXMucGx1Z2luLnNhdmVTZXR0aW5ncygpO1xuICAgICAgICAgIH0pLFxuICAgICAgKTtcblxuICAgIG5ldyBTZXR0aW5nKGNvbnRhaW5lckVsKVxuICAgICAgLnNldE5hbWUoJ0RhdGUgZm9ybWF0JylcbiAgICAgIC5zZXREZXNjKCdGaWxlIG5hbWUgZGF0ZSBmb3JtYXQuIE11c3QgbWF0Y2ggWVlZWS1NTS1ERCBhdCB0aGUgc3RhcnQgb2YgZmlsZSBuYW1lcy4nKVxuICAgICAgLmFkZFRleHQodGV4dCA9PlxuICAgICAgICB0ZXh0XG4gICAgICAgICAgLnNldFBsYWNlaG9sZGVyKCdZWVlZLU1NLUREJylcbiAgICAgICAgICAuc2V0VmFsdWUodGhpcy5wbHVnaW4uc2V0dGluZ3MuZGF0ZUZvcm1hdClcbiAgICAgICAgICAub25DaGFuZ2UoYXN5bmMgKHZhbHVlKSA9PiB7XG4gICAgICAgICAgICB0aGlzLnBsdWdpbi5zZXR0aW5ncy5kYXRlRm9ybWF0ID0gdmFsdWUudHJpbSgpO1xuICAgICAgICAgICAgYXdhaXQgdGhpcy5wbHVnaW4uc2F2ZVNldHRpbmdzKCk7XG4gICAgICAgICAgfSksXG4gICAgICApO1xuICB9XG59XG4iLCIvKiogU2luZ2xlLWNvbG9yIHByZXNldHMgZm9yIGJvb2xlYW4gdHJhY2tlciAqL1xuZXhwb3J0IGNvbnN0IENPTE9SX1BSRVNFVFM6IFJlY29yZDxzdHJpbmcsIHN0cmluZz4gPSB7XG4gIGJsdWU6ICAgJyM2NGI1ZjYnLFxuICBncmVlbjogICcjNjZiYjZhJyxcbiAgcmVkOiAgICAnI2U1NzM3MycsXG4gIHB1cnBsZTogJyNiYTY4YzgnLFxuICBvcmFuZ2U6ICcjZmZiNzRkJyxcbiAgeWVsbG93OiAnI2ZmZDU0ZicsXG4gIHRlYWw6ICAgJyM0ZGI2YWMnLFxuICBpbmRpZ286ICcjNzk4NmNiJyxcbiAgcGluazogICAnI2YwNjI5MicsXG59O1xuXG4vKipcbiAqIEhlYXRtYXAgY29sb3Itc2NoZW1lIHByZXNldHMuXG4gKiBJbmRleCAwID0gbm8gZGF0YSwgaW5kZXggMS4ubiA9IGluY3JlYXNpbmcgaW50ZW5zaXR5LlxuICovXG5leHBvcnQgY29uc3QgSEVBVE1BUF9TQ0hFTUVTOiBSZWNvcmQ8c3RyaW5nLCBzdHJpbmdbXT4gPSB7XG4gIGJsdWU6ICAgWycjZWJlZGYwJywgJyNiYmRlZmInLCAnIzkwY2FmOScsICcjNjRiNWY2JywgJyM0MmE1ZjUnLCAnIzFlODhlNSddLFxuICBncmVlbjogIFsnI2ViZWRmMCcsICcjYzhlNmM5JywgJyNhNWQ2YTcnLCAnIzgxYzc4NCcsICcjNjZiYjZhJywgJyM0M2EwNDcnXSxcbiAgcmVkOiAgICBbJyNlYmVkZjAnLCAnI2ZmY2RkMicsICcjZWY5YTlhJywgJyNlNTczNzMnLCAnI2VmNTM1MCcsICcjZTUzOTM1J10sXG4gIHB1cnBsZTogWycjZWJlZGYwJywgJyNlMWJlZTcnLCAnI2NlOTNkOCcsICcjYmE2OGM4JywgJyNhYjQ3YmMnLCAnIzhlMjRhYSddLFxuICBvcmFuZ2U6IFsnI2ViZWRmMCcsICcjZmZlMGIyJywgJyNmZmNjODAnLCAnI2ZmYjc0ZCcsICcjZmZhNzI2JywgJyNmYjhjMDAnXSxcbiAgeWVsbG93OiBbJyNlYmVkZjAnLCAnI2ZmZjljNCcsICcjZmZmNTlkJywgJyNmZmYxNzYnLCAnI2ZmZWU1OCcsICcjZmRkODM1J10sXG4gIHRlYWw6ICAgWycjZWJlZGYwJywgJyNiMmRmZGInLCAnIzgwY2JjNCcsICcjNGRiNmFjJywgJyMyNmE2OWEnLCAnIzAwODk3YiddLFxuICBpbmRpZ286IFsnI2ViZWRmMCcsICcjZThlYWY2JywgJyNjNWNhZTknLCAnIzlmYThkYScsICcjNzk4NmNiJywgJyM1YzZiYzAnXSxcbiAgcGluazogICBbJyNlYmVkZjAnLCAnI2ZjZTRlYycsICcjZjQ4ZmIxJywgJyNmMDYyOTInLCAnI2VjNDA3YScsICcjZDgxYjYwJ10sXG59O1xuXG4vKiogUmVzb2x2ZSBhIGNvbG9yIHN0cmluZzogaWYgaXQncyBhIGtub3duIHByZXNldCBuYW1lLCByZXR1cm4gdGhlIGhleDsgb3RoZXJ3aXNlIHJldHVybiBhcy1pcy4gKi9cbmV4cG9ydCBmdW5jdGlvbiByZXNvbHZlQ29sb3IoY29sb3I6IHN0cmluZyk6IHN0cmluZyB7XG4gIHJldHVybiBDT0xPUl9QUkVTRVRTW2NvbG9yLnRvTG93ZXJDYXNlKCldID8/IGNvbG9yO1xufVxuXG4vKiogUmVzb2x2ZSBoZWF0bWFwIGNvbG9ycyBhcnJheSBmcm9tIGNvbG9yU2NoZW1lIHByZXNldCBvciBleHBsaWNpdCBjb2xvcnMgYXJyYXkuICovXG5leHBvcnQgZnVuY3Rpb24gcmVzb2x2ZUhlYXRtYXBDb2xvcnMoY29sb3JzPzogc3RyaW5nW10sIGNvbG9yU2NoZW1lPzogc3RyaW5nKTogc3RyaW5nW10ge1xuICBpZiAoY29sb3JzICYmIGNvbG9ycy5sZW5ndGggPiAwKSByZXR1cm4gY29sb3JzO1xuICBpZiAoY29sb3JTY2hlbWUpIHtcbiAgICBjb25zdCBzY2hlbWUgPSBIRUFUTUFQX1NDSEVNRVNbY29sb3JTY2hlbWUudG9Mb3dlckNhc2UoKV07XG4gICAgaWYgKHNjaGVtZSkgcmV0dXJuIHNjaGVtZTtcbiAgfVxuICByZXR1cm4gSEVBVE1BUF9TQ0hFTUVTWydpbmRpZ28nXTtcbn1cblxuIiwiaW1wb3J0IHsgVHJhY2tlckNvbmZpZywgQm9vbGVhbkNvbmZpZywgQ29sb3JtYXBDb25maWcsIEhlYXRtYXBDb25maWcgfSBmcm9tICcuL3R5cGVzJztcbmltcG9ydCB7IHJlc29sdmVDb2xvciwgcmVzb2x2ZUhlYXRtYXBDb2xvcnMgfSBmcm9tICcuL3ByZXNldHMnO1xuXG5leHBvcnQgaW50ZXJmYWNlIERheURhdGEge1xuICBkYXk6IG51bWJlcjtcbiAgdmFsdWU6IHVua25vd247XG4gIGZpbGVQYXRoPzogc3RyaW5nO1xufVxuXG5jb25zdCBFTVBUWV9DT0xPUiA9ICcjZWJlZGYwJztcblxuZnVuY3Rpb24gZGF5Q2VsbChcbiAgZGF5OiBudW1iZXIsXG4gIGJnQ29sb3I6IHN0cmluZyxcbiAgZmlsZVBhdGg6IHN0cmluZyB8IHVuZGVmaW5lZCxcbiAgdG9vbHRpcDogc3RyaW5nLFxuICB0ZXh0U3R5bGU6IHN0cmluZyxcbik6IHN0cmluZyB7XG4gIGNvbnN0IGJhc2UgPSBgYmFja2dyb3VuZC1jb2xvcjoke2JnQ29sb3J9O2Rpc3BsYXk6ZmxleDthbGlnbi1pdGVtczpjZW50ZXI7anVzdGlmeS1jb250ZW50OmNlbnRlcjtwYWRkaW5nOjRweCAwO2JvcmRlci1yYWRpdXM6MnB4O2ZvbnQtc2l6ZTo5cHg7ZmxleDoxO21pbi13aWR0aDowO2JveC1zaXppbmc6Ym9yZGVyLWJveDske3RleHRTdHlsZX1gO1xuXG4gIGlmIChmaWxlUGF0aCkge1xuICAgIHJldHVybiBgPGEgaHJlZj1cIiR7ZmlsZVBhdGh9XCIgY2xhc3M9XCJpbnRlcm5hbC1saW5rXCIgdGl0bGU9XCIke3Rvb2x0aXB9XCIgc3R5bGU9XCIke2Jhc2V9O3RleHQtZGVjb3JhdGlvbjpub25lO1wiPiR7ZGF5fTwvYT5gO1xuICB9XG4gIHJldHVybiBgPGRpdiB0aXRsZT1cIiR7dG9vbHRpcH1cIiBzdHlsZT1cIiR7YmFzZX1cIj4ke2RheX08L2Rpdj5gO1xufVxuXG5mdW5jdGlvbiB3cmFwR3JpZChjZWxsczogc3RyaW5nKTogc3RyaW5nIHtcbiAgcmV0dXJuIGA8ZGl2IHN0eWxlPVwiZGlzcGxheTpmbGV4O2dhcDoycHg7bWFyZ2luLWJvdHRvbTo4cHg7XCI+JHtjZWxsc308L2Rpdj5gO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gcmVuZGVyQm9vbGVhbihjb25maWc6IEJvb2xlYW5Db25maWcsIGRhdGE6IE1hcDxudW1iZXIsIERheURhdGE+LCBkYXlzSW5Nb250aDogbnVtYmVyKTogc3RyaW5nIHtcbiAgY29uc3QgYWN0aXZlQ29sb3IgPSByZXNvbHZlQ29sb3IoY29uZmlnLmNvbG9yKTtcbiAgbGV0IGNlbGxzID0gJyc7XG5cbiAgZm9yIChsZXQgZGF5ID0gMTsgZGF5IDw9IGRheXNJbk1vbnRoOyBkYXkrKykge1xuICAgIGNvbnN0IGVudHJ5ID0gZGF0YS5nZXQoZGF5KTtcbiAgICBjb25zdCBhY3RpdmUgPSBlbnRyeSAhPT0gdW5kZWZpbmVkICYmICEhZW50cnkudmFsdWU7XG4gICAgY29uc3QgYmdDb2xvciA9IGFjdGl2ZSA/IGFjdGl2ZUNvbG9yIDogRU1QVFlfQ09MT1I7XG4gICAgY29uc3QgdGV4dFN0eWxlID0gYWN0aXZlID8gJ2ZvbnQtd2VpZ2h0OjYwMDtjb2xvcjp3aGl0ZTsnIDogJ2NvbG9yOiM5OTk7JztcbiAgICBjZWxscyArPSBkYXlDZWxsKGRheSwgYmdDb2xvciwgZW50cnk/LmZpbGVQYXRoLCBhY3RpdmUgPyAnWWVzJyA6ICcnLCB0ZXh0U3R5bGUpO1xuICB9XG5cbiAgcmV0dXJuIHdyYXBHcmlkKGNlbGxzKTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHJlbmRlckNvbG9ybWFwKGNvbmZpZzogQ29sb3JtYXBDb25maWcsIGRhdGE6IE1hcDxudW1iZXIsIERheURhdGE+LCBkYXlzSW5Nb250aDogbnVtYmVyKTogc3RyaW5nIHtcbiAgY29uc3QgY29sb3JNYXAgPSBjb25maWcuY29sb3JzID8/IHt9O1xuICBsZXQgY2VsbHMgPSAnJztcblxuICBmb3IgKGxldCBkYXkgPSAxOyBkYXkgPD0gZGF5c0luTW9udGg7IGRheSsrKSB7XG4gICAgY29uc3QgZW50cnkgPSBkYXRhLmdldChkYXkpO1xuICAgIGNvbnN0IHZhbCA9IGVudHJ5Py52YWx1ZSBhcyBzdHJpbmcgfCB1bmRlZmluZWQ7XG4gICAgY29uc3QgYmdDb2xvciA9ICh2YWwgJiYgY29sb3JNYXBbdmFsXSkgPyBjb2xvck1hcFt2YWxdIDogRU1QVFlfQ09MT1I7XG4gICAgY29uc3QgaGFzRGF0YSA9IHZhbCAmJiBjb2xvck1hcFt2YWxdO1xuICAgIGNvbnN0IHRleHRTdHlsZSA9IGhhc0RhdGEgPyAnZm9udC13ZWlnaHQ6NjAwO2NvbG9yOndoaXRlOycgOiAnY29sb3I6Izk5OTsnO1xuICAgIGNlbGxzICs9IGRheUNlbGwoZGF5LCBiZ0NvbG9yLCBlbnRyeT8uZmlsZVBhdGgsIHZhbCA/PyAnJywgdGV4dFN0eWxlKTtcbiAgfVxuXG4gIHJldHVybiB3cmFwR3JpZChjZWxscyk7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiByZW5kZXJIZWF0bWFwKGNvbmZpZzogSGVhdG1hcENvbmZpZywgZGF0YTogTWFwPG51bWJlciwgRGF5RGF0YT4sIGRheXNJbk1vbnRoOiBudW1iZXIpOiBzdHJpbmcge1xuICBjb25zdCBjb2xvcnMgPSByZXNvbHZlSGVhdG1hcENvbG9ycyhjb25maWcuY29sb3JzLCBjb25maWcuY29sb3JTY2hlbWUpO1xuICBpZiAoIWNvbmZpZy5iaW5zIHx8IGNvbmZpZy5iaW5zLmxlbmd0aCA9PT0gMCkgdGhyb3cgbmV3IEVycm9yKCdoZWF0bWFwIHJlcXVpcmVzIFwiYmluc1wiIChlLmcuIGJpbnM6IFszLCA1LCA3LCAxMF0pJyk7XG4gIGNvbnN0IGJpbnMgPSBjb25maWcuYmlucztcbiAgY29uc3QgdW5pdCA9IGNvbmZpZy51bml0ID8/ICcnO1xuXG4gIGZ1bmN0aW9uIGdldEludGVuc2l0eSh2YWw6IG51bWJlcik6IG51bWJlciB7XG4gICAgaWYgKCF2YWwgfHwgdmFsIDw9IDApIHJldHVybiAwO1xuICAgIGZvciAobGV0IGkgPSAwOyBpIDwgYmlucy5sZW5ndGg7IGkrKykge1xuICAgICAgaWYgKHZhbCA8IGJpbnNbaV0pIHJldHVybiBpICsgMTtcbiAgICB9XG4gICAgcmV0dXJuIGJpbnMubGVuZ3RoICsgMTtcbiAgfVxuXG4gIGNvbnN0IG1heEludGVuc2l0eSA9IGJpbnMubGVuZ3RoICsgMTtcbiAgY29uc3Qgc2FmZUNvbG9ycyA9IGNvbG9ycy5sZW5ndGggPj0gbWF4SW50ZW5zaXR5ICsgMSA/IGNvbG9ycyA6IFtcbiAgICAuLi5jb2xvcnMsXG4gICAgLi4uQXJyYXkobWF4SW50ZW5zaXR5ICsgMSAtIGNvbG9ycy5sZW5ndGgpLmZpbGwoY29sb3JzW2NvbG9ycy5sZW5ndGggLSAxXSA/PyBFTVBUWV9DT0xPUiksXG4gIF07XG5cbiAgbGV0IHRvdGFsID0gMDtcbiAgbGV0IGNlbGxzID0gJyc7XG5cbiAgZm9yIChsZXQgZGF5ID0gMTsgZGF5IDw9IGRheXNJbk1vbnRoOyBkYXkrKykge1xuICAgIGNvbnN0IGVudHJ5ID0gZGF0YS5nZXQoZGF5KTtcbiAgICBjb25zdCB2YWwgPSB0eXBlb2YgZW50cnk/LnZhbHVlID09PSAnbnVtYmVyJyA/IGVudHJ5LnZhbHVlIDogMDtcbiAgICB0b3RhbCArPSB2YWw7XG4gICAgY29uc3QgaW50ZW5zaXR5ID0gZ2V0SW50ZW5zaXR5KHZhbCk7XG4gICAgY29uc3QgYmdDb2xvciA9IHNhZmVDb2xvcnNbaW50ZW5zaXR5XSA/PyBFTVBUWV9DT0xPUjtcbiAgICBjb25zdCBoYXNEYXRhID0gaW50ZW5zaXR5ID4gMDtcbiAgICBjb25zdCB0ZXh0U3R5bGUgPSBoYXNEYXRhID8gJ2ZvbnQtd2VpZ2h0OjYwMDtjb2xvcjp3aGl0ZTsnIDogJ2NvbG9yOiM5OTk7JztcbiAgICBjb25zdCB0b29sdGlwID0gdmFsID4gMCA/IGAke3ZhbH0ke3VuaXR9YCA6ICcnO1xuICAgIGNlbGxzICs9IGRheUNlbGwoZGF5LCBiZ0NvbG9yLCBlbnRyeT8uZmlsZVBhdGgsIHRvb2x0aXAsIHRleHRTdHlsZSk7XG4gIH1cblxuICBsZXQgaHRtbCA9ICcnO1xuICBpZiAoY29uZmlnLnNob3dUb3RhbCkge1xuICAgIGNvbnN0IGxhYmVsID0gY29uZmlnLnRvdGFsTGFiZWwgPz8gKHVuaXQgPyBg7ZWp6rOEYCA6ICftlanqs4QnKTtcbiAgICBodG1sICs9IGA8ZGl2IHN0eWxlPVwibWFyZ2luLWJvdHRvbTo2cHg7Zm9udC1zaXplOjEycHg7Y29sb3I6dmFyKC0tdGV4dC1tdXRlZCk7XCI+JHtsYWJlbH06IDxzcGFuIHN0eWxlPVwiZm9udC13ZWlnaHQ6NjAwO2NvbG9yOnZhcigtLXRleHQtbm9ybWFsKTtcIj4ke3RvdGFsLnRvRml4ZWQoMSl9JHt1bml0fTwvc3Bhbj48L2Rpdj5gO1xuICB9XG4gIGh0bWwgKz0gd3JhcEdyaWQoY2VsbHMpO1xuICByZXR1cm4gaHRtbDtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHJlbmRlclRyYWNrZXIoXG4gIGNvbmZpZzogVHJhY2tlckNvbmZpZyxcbiAgZGF0YTogTWFwPG51bWJlciwgRGF5RGF0YT4sXG4gIGRheXNJbk1vbnRoOiBudW1iZXIsXG4pOiBIVE1MRWxlbWVudCB7XG4gIGNvbnN0IGNvbnRhaW5lciA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2RpdicpO1xuICBjb250YWluZXIuc3R5bGUuZm9udEZhbWlseSA9IFwiLWFwcGxlLXN5c3RlbSwgQmxpbmtNYWNTeXN0ZW1Gb250LCAnU2Vnb2UgVUknLCBzYW5zLXNlcmlmXCI7XG5cbiAgbGV0IGlubmVyID0gJyc7XG4gIGlmIChjb25maWcudHlwZSA9PT0gJ2Jvb2xlYW4nKSB7XG4gICAgaW5uZXIgPSByZW5kZXJCb29sZWFuKGNvbmZpZywgZGF0YSwgZGF5c0luTW9udGgpO1xuICB9IGVsc2UgaWYgKGNvbmZpZy50eXBlID09PSAnY29sb3JtYXAnKSB7XG4gICAgaW5uZXIgPSByZW5kZXJDb2xvcm1hcChjb25maWcsIGRhdGEsIGRheXNJbk1vbnRoKTtcbiAgfSBlbHNlIGlmIChjb25maWcudHlwZSA9PT0gJ2hlYXRtYXAnKSB7XG4gICAgaW5uZXIgPSByZW5kZXJIZWF0bWFwKGNvbmZpZywgZGF0YSwgZGF5c0luTW9udGgpO1xuICB9XG5cbiAgY29udGFpbmVyLmlubmVySFRNTCA9IGlubmVyO1xuICByZXR1cm4gY29udGFpbmVyO1xufVxuIiwiaW1wb3J0IHsgUGx1Z2luLCBNYXJrZG93blBvc3RQcm9jZXNzb3JDb250ZXh0LCBURmlsZSwgcGFyc2VZYW1sIH0gZnJvbSAnb2JzaWRpYW4nO1xuaW1wb3J0IHsgUGx1Z2luU2V0dGluZ3MsIERFRkFVTFRfU0VUVElOR1MsIFRyYWNrZXJDb25maWcgfSBmcm9tICcuL3R5cGVzJztcbmltcG9ydCB7IE1vbnRobHlUcmFja2VyU2V0dGluZ1RhYiB9IGZyb20gJy4vc2V0dGluZ3MnO1xuaW1wb3J0IHsgcmVuZGVyVHJhY2tlciwgRGF5RGF0YSB9IGZyb20gJy4vcmVuZGVyZXInO1xuXG5mdW5jdGlvbiBidWlsZERhdGVQYXR0ZXJuKGRhdGVGb3JtYXQ6IHN0cmluZywgeWVhcjogbnVtYmVyLCBtb250aDogbnVtYmVyKTogUmVnRXhwIHtcbiAgY29uc3QgbW0gPSBTdHJpbmcobW9udGgpLnBhZFN0YXJ0KDIsICcwJyk7XG4gIGNvbnN0IGVzY2FwZWQgPSBkYXRlRm9ybWF0XG4gICAgLnJlcGxhY2UoJ1lZWVknLCAnXFx4MDBZXFx4MDAnKVxuICAgIC5yZXBsYWNlKCdNTScsICdcXHgwME1cXHgwMCcpXG4gICAgLnJlcGxhY2UoJ0REJywgJ1xceDAwRFxceDAwJylcbiAgICAucmVwbGFjZSgvWy4qKz9eJHt9KCl8W1xcXVxcXFxdL2csICdcXFxcJCYnKVxuICAgIC5yZXBsYWNlKCdcXHgwMFlcXHgwMCcsIFN0cmluZyh5ZWFyKSlcbiAgICAucmVwbGFjZSgnXFx4MDBNXFx4MDAnLCBtbSlcbiAgICAucmVwbGFjZSgnXFx4MDBEXFx4MDAnLCAnKFxcXFxkezJ9KScpO1xuICByZXR1cm4gbmV3IFJlZ0V4cChgXiR7ZXNjYXBlZH1gKTtcbn1cblxuZXhwb3J0IGRlZmF1bHQgY2xhc3MgTW9udGhseVRyYWNrZXJQbHVnaW4gZXh0ZW5kcyBQbHVnaW4ge1xuICBzZXR0aW5nczogUGx1Z2luU2V0dGluZ3M7XG5cbiAgYXN5bmMgb25sb2FkKCkge1xuICAgIGF3YWl0IHRoaXMubG9hZFNldHRpbmdzKCk7XG4gICAgdGhpcy5hZGRTZXR0aW5nVGFiKG5ldyBNb250aGx5VHJhY2tlclNldHRpbmdUYWIodGhpcy5hcHAsIHRoaXMpKTtcblxuICAgIHRoaXMucmVnaXN0ZXJNYXJrZG93bkNvZGVCbG9ja1Byb2Nlc3NvcihcbiAgICAgICdtb250aGx5LXRyYWNrZXInLFxuICAgICAgYXN5bmMgKHNvdXJjZSwgZWwsIGN0eCkgPT4ge1xuICAgICAgICB0cnkge1xuICAgICAgICAgIGF3YWl0IHRoaXMucHJvY2Vzc0Jsb2NrKHNvdXJjZSwgZWwsIGN0eCk7XG4gICAgICAgIH0gY2F0Y2ggKGVycikge1xuICAgICAgICAgIGVsLmNyZWF0ZUVsKCdwcmUnLCB7XG4gICAgICAgICAgICB0ZXh0OiBgTW9udGhseSBUcmFja2VyIEVycm9yOlxcbiR7ZXJyIGluc3RhbmNlb2YgRXJyb3IgPyBlcnIubWVzc2FnZSA6IFN0cmluZyhlcnIpfWAsXG4gICAgICAgICAgICBjbHM6ICdtb250aGx5LXRyYWNrZXItZXJyb3InLFxuICAgICAgICAgIH0pO1xuICAgICAgICB9XG4gICAgICB9LFxuICAgICk7XG4gIH1cblxuICBwcml2YXRlIGFzeW5jIHByb2Nlc3NCbG9jayhcbiAgICBzb3VyY2U6IHN0cmluZyxcbiAgICBlbDogSFRNTEVsZW1lbnQsXG4gICAgY3R4OiBNYXJrZG93blBvc3RQcm9jZXNzb3JDb250ZXh0LFxuICApOiBQcm9taXNlPHZvaWQ+IHtcbiAgICBjb25zdCBjb25maWcgPSBwYXJzZVlhbWwoc291cmNlLnRyaW0oKSkgYXMgVHJhY2tlckNvbmZpZztcbiAgICBpZiAoIWNvbmZpZz8udHlwZSkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKCdNaXNzaW5nIHJlcXVpcmVkIGZpZWxkOiB0eXBlIChib29sZWFuIHwgY29sb3JtYXAgfCBoZWF0bWFwKScpO1xuICAgIH1cbiAgICBpZiAoIWNvbmZpZy5wcm9wZXJ0eSAmJiBjb25maWcudHlwZSAhPT0gJ2Jvb2xlYW4nKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoJ01pc3NpbmcgcmVxdWlyZWQgZmllbGQ6IHByb3BlcnR5Jyk7XG4gICAgfVxuXG4gICAgLy8gUmVhZCB5ZWFyL21vbnRoIGZyb20gdGhlIGN1cnJlbnQgbm90ZSdzIGZyb250bWF0dGVyXG4gICAgY29uc3QgY3VycmVudEZpbGUgPSB0aGlzLmFwcC52YXVsdC5nZXRBYnN0cmFjdEZpbGVCeVBhdGgoY3R4LnNvdXJjZVBhdGgpO1xuICAgIGlmICghKGN1cnJlbnRGaWxlIGluc3RhbmNlb2YgVEZpbGUpKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoJ0Nhbm5vdCByZXNvbHZlIGN1cnJlbnQgZmlsZScpO1xuICAgIH1cbiAgICBjb25zdCBmbSA9IHRoaXMuYXBwLm1ldGFkYXRhQ2FjaGUuZ2V0RmlsZUNhY2hlKGN1cnJlbnRGaWxlKT8uZnJvbnRtYXR0ZXI7XG4gICAgY29uc3QgeWVhcjogbnVtYmVyID0gZm0/LnllYXI7XG4gICAgY29uc3QgbW9udGg6IG51bWJlciA9IGZtPy5tb250aDtcbiAgICBpZiAoIXllYXIgfHwgIW1vbnRoKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoXCJDdXJyZW50IG5vdGUgbXVzdCBoYXZlICd5ZWFyJyBhbmQgJ21vbnRoJyBpbiBmcm9udG1hdHRlclwiKTtcbiAgICB9XG5cbiAgICBjb25zdCBkYXlzSW5Nb250aCA9IG5ldyBEYXRlKHllYXIsIG1vbnRoLCAwKS5nZXREYXRlKCk7XG4gICAgY29uc3QgZm9sZGVyID0gY29uZmlnLnNvdXJjZSA/PyB0aGlzLnNldHRpbmdzLmRhaWx5Tm90ZXNGb2xkZXI7XG4gICAgY29uc3QgcGF0dGVybiA9IGJ1aWxkRGF0ZVBhdHRlcm4odGhpcy5zZXR0aW5ncy5kYXRlRm9ybWF0LCB5ZWFyLCBOdW1iZXIobW9udGgpKTtcblxuICAgIC8vIFNjYW4gdmF1bHQgZm9sZGVyIGZvciBtYXRjaGluZyBkYWlseSBub3Rlc1xuICAgIGNvbnN0IGRhdGEgPSBuZXcgTWFwPG51bWJlciwgRGF5RGF0YT4oKTtcbiAgICBjb25zdCBhYnN0cmFjdEZvbGRlciA9IHRoaXMuYXBwLnZhdWx0LmdldEFic3RyYWN0RmlsZUJ5UGF0aChmb2xkZXIpO1xuXG4gICAgaWYgKGFic3RyYWN0Rm9sZGVyKSB7XG4gICAgICAvLyBAdHMtaWdub3JlIOKAlCBURm9sZGVyIGhhcyBjaGlsZHJlblxuICAgICAgY29uc3QgY2hpbGRyZW46IHVua25vd25bXSA9IGFic3RyYWN0Rm9sZGVyLmNoaWxkcmVuID8/IFtdO1xuICAgICAgZm9yIChjb25zdCBjaGlsZCBvZiBjaGlsZHJlbikge1xuICAgICAgICBpZiAoIShjaGlsZCBpbnN0YW5jZW9mIFRGaWxlKSkgY29udGludWU7XG4gICAgICAgIGNvbnN0IG1hdGNoID0gY2hpbGQubmFtZS5tYXRjaChwYXR0ZXJuKTtcbiAgICAgICAgaWYgKCFtYXRjaCkgY29udGludWU7XG4gICAgICAgIGNvbnN0IGRheSA9IHBhcnNlSW50KG1hdGNoWzFdKTtcblxuICAgICAgICBjb25zdCBjaGlsZEZtID0gdGhpcy5hcHAubWV0YWRhdGFDYWNoZS5nZXRGaWxlQ2FjaGUoY2hpbGQpPy5mcm9udG1hdHRlcjtcbiAgICAgICAgbGV0IHZhbHVlOiB1bmtub3duID0gdW5kZWZpbmVkO1xuXG4gICAgICAgIGlmIChjb25maWcucHJvcGVydHkgPT09IG51bGwgfHwgY29uZmlnLnByb3BlcnR5ID09PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAvLyBGaWxlLWV4aXN0ZW5jZSBtb2RlIChlLmcuIE1vcm5pbmcgSm91cm5hbCBmb2xkZXIpXG4gICAgICAgICAgdmFsdWUgPSB0cnVlO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHZhbHVlID0gY2hpbGRGbT8uW2NvbmZpZy5wcm9wZXJ0eV07XG4gICAgICAgIH1cblxuICAgICAgICBkYXRhLnNldChkYXksIHsgZGF5LCB2YWx1ZSwgZmlsZVBhdGg6IGNoaWxkLnBhdGggfSk7XG4gICAgICB9XG4gICAgfVxuXG4gICAgY29uc3QgcmVuZGVyZWQgPSByZW5kZXJUcmFja2VyKGNvbmZpZywgZGF0YSwgZGF5c0luTW9udGgpO1xuICAgIGVsLmFwcGVuZENoaWxkKHJlbmRlcmVkKTtcbiAgfVxuXG4gIGFzeW5jIGxvYWRTZXR0aW5ncygpIHtcbiAgICB0aGlzLnNldHRpbmdzID0gT2JqZWN0LmFzc2lnbih7fSwgREVGQVVMVF9TRVRUSU5HUywgYXdhaXQgdGhpcy5sb2FkRGF0YSgpKTtcbiAgfVxuXG4gIGFzeW5jIHNhdmVTZXR0aW5ncygpIHtcbiAgICBhd2FpdCB0aGlzLnNhdmVEYXRhKHRoaXMuc2V0dGluZ3MpO1xuICB9XG59XG4iXSwibmFtZXMiOlsiUGx1Z2luU2V0dGluZ1RhYiIsIlNldHRpbmciLCJQbHVnaW4iLCJwYXJzZVlhbWwiLCJURmlsZSJdLCJtYXBwaW5ncyI6Ijs7OztBQTRDTyxNQUFNLGdCQUFnQixHQUFtQjtBQUM5QyxJQUFBLGdCQUFnQixFQUFFLGtCQUFrQjtBQUNwQyxJQUFBLFVBQVUsRUFBRSxZQUFZO0NBQ3pCOztBQzVDSyxNQUFPLHdCQUF5QixTQUFRQSx5QkFBZ0IsQ0FBQTtJQUc1RCxXQUFZLENBQUEsR0FBUSxFQUFFLE1BQTRCLEVBQUE7QUFDaEQsUUFBQSxLQUFLLENBQUMsR0FBRyxFQUFFLE1BQU0sQ0FBQyxDQUFDO0FBQ25CLFFBQUEsSUFBSSxDQUFDLE1BQU0sR0FBRyxNQUFNLENBQUM7S0FDdEI7SUFFRCxPQUFPLEdBQUE7QUFDTCxRQUFBLE1BQU0sRUFBRSxXQUFXLEVBQUUsR0FBRyxJQUFJLENBQUM7UUFDN0IsV0FBVyxDQUFDLEtBQUssRUFBRSxDQUFDO1FBRXBCLElBQUlDLGdCQUFPLENBQUMsV0FBVyxDQUFDO2FBQ3JCLE9BQU8sQ0FBQyxvQkFBb0IsQ0FBQzthQUM3QixPQUFPLENBQUMsdURBQXVELENBQUM7QUFDaEUsYUFBQSxPQUFPLENBQUMsSUFBSSxJQUNYLElBQUk7YUFDRCxjQUFjLENBQUMsa0JBQWtCLENBQUM7YUFDbEMsUUFBUSxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsUUFBUSxDQUFDLGdCQUFnQixDQUFDO0FBQy9DLGFBQUEsUUFBUSxDQUFDLE9BQU8sS0FBSyxLQUFJO1lBQ3hCLElBQUksQ0FBQyxNQUFNLENBQUMsUUFBUSxDQUFDLGdCQUFnQixHQUFHLEtBQUssQ0FBQyxJQUFJLEVBQUUsQ0FBQztBQUNyRCxZQUFBLE1BQU0sSUFBSSxDQUFDLE1BQU0sQ0FBQyxZQUFZLEVBQUUsQ0FBQztTQUNsQyxDQUFDLENBQ0wsQ0FBQztRQUVKLElBQUlBLGdCQUFPLENBQUMsV0FBVyxDQUFDO2FBQ3JCLE9BQU8sQ0FBQyxhQUFhLENBQUM7YUFDdEIsT0FBTyxDQUFDLDBFQUEwRSxDQUFDO0FBQ25GLGFBQUEsT0FBTyxDQUFDLElBQUksSUFDWCxJQUFJO2FBQ0QsY0FBYyxDQUFDLFlBQVksQ0FBQzthQUM1QixRQUFRLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxRQUFRLENBQUMsVUFBVSxDQUFDO0FBQ3pDLGFBQUEsUUFBUSxDQUFDLE9BQU8sS0FBSyxLQUFJO1lBQ3hCLElBQUksQ0FBQyxNQUFNLENBQUMsUUFBUSxDQUFDLFVBQVUsR0FBRyxLQUFLLENBQUMsSUFBSSxFQUFFLENBQUM7QUFDL0MsWUFBQSxNQUFNLElBQUksQ0FBQyxNQUFNLENBQUMsWUFBWSxFQUFFLENBQUM7U0FDbEMsQ0FBQyxDQUNMLENBQUM7S0FDTDtBQUNGOztBQ3pDRDtBQUNPLE1BQU0sYUFBYSxHQUEyQjtBQUNuRCxJQUFBLElBQUksRUFBSSxTQUFTO0FBQ2pCLElBQUEsS0FBSyxFQUFHLFNBQVM7QUFDakIsSUFBQSxHQUFHLEVBQUssU0FBUztBQUNqQixJQUFBLE1BQU0sRUFBRSxTQUFTO0FBQ2pCLElBQUEsTUFBTSxFQUFFLFNBQVM7QUFDakIsSUFBQSxNQUFNLEVBQUUsU0FBUztBQUNqQixJQUFBLElBQUksRUFBSSxTQUFTO0FBQ2pCLElBQUEsTUFBTSxFQUFFLFNBQVM7QUFDakIsSUFBQSxJQUFJLEVBQUksU0FBUztDQUNsQixDQUFDO0FBRUY7OztBQUdHO0FBQ0ksTUFBTSxlQUFlLEdBQTZCO0FBQ3ZELElBQUEsSUFBSSxFQUFJLENBQUMsU0FBUyxFQUFFLFNBQVMsRUFBRSxTQUFTLEVBQUUsU0FBUyxFQUFFLFNBQVMsRUFBRSxTQUFTLENBQUM7QUFDMUUsSUFBQSxLQUFLLEVBQUcsQ0FBQyxTQUFTLEVBQUUsU0FBUyxFQUFFLFNBQVMsRUFBRSxTQUFTLEVBQUUsU0FBUyxFQUFFLFNBQVMsQ0FBQztBQUMxRSxJQUFBLEdBQUcsRUFBSyxDQUFDLFNBQVMsRUFBRSxTQUFTLEVBQUUsU0FBUyxFQUFFLFNBQVMsRUFBRSxTQUFTLEVBQUUsU0FBUyxDQUFDO0FBQzFFLElBQUEsTUFBTSxFQUFFLENBQUMsU0FBUyxFQUFFLFNBQVMsRUFBRSxTQUFTLEVBQUUsU0FBUyxFQUFFLFNBQVMsRUFBRSxTQUFTLENBQUM7QUFDMUUsSUFBQSxNQUFNLEVBQUUsQ0FBQyxTQUFTLEVBQUUsU0FBUyxFQUFFLFNBQVMsRUFBRSxTQUFTLEVBQUUsU0FBUyxFQUFFLFNBQVMsQ0FBQztBQUMxRSxJQUFBLE1BQU0sRUFBRSxDQUFDLFNBQVMsRUFBRSxTQUFTLEVBQUUsU0FBUyxFQUFFLFNBQVMsRUFBRSxTQUFTLEVBQUUsU0FBUyxDQUFDO0FBQzFFLElBQUEsSUFBSSxFQUFJLENBQUMsU0FBUyxFQUFFLFNBQVMsRUFBRSxTQUFTLEVBQUUsU0FBUyxFQUFFLFNBQVMsRUFBRSxTQUFTLENBQUM7QUFDMUUsSUFBQSxNQUFNLEVBQUUsQ0FBQyxTQUFTLEVBQUUsU0FBUyxFQUFFLFNBQVMsRUFBRSxTQUFTLEVBQUUsU0FBUyxFQUFFLFNBQVMsQ0FBQztBQUMxRSxJQUFBLElBQUksRUFBSSxDQUFDLFNBQVMsRUFBRSxTQUFTLEVBQUUsU0FBUyxFQUFFLFNBQVMsRUFBRSxTQUFTLEVBQUUsU0FBUyxDQUFDO0NBQzNFLENBQUM7QUFFRjtBQUNNLFNBQVUsWUFBWSxDQUFDLEtBQWEsRUFBQTs7SUFDeEMsT0FBTyxDQUFBLEVBQUEsR0FBQSxhQUFhLENBQUMsS0FBSyxDQUFDLFdBQVcsRUFBRSxDQUFDLE1BQUksSUFBQSxJQUFBLEVBQUEsS0FBQSxLQUFBLENBQUEsR0FBQSxFQUFBLEdBQUEsS0FBSyxDQUFDO0FBQ3JELENBQUM7QUFFRDtBQUNnQixTQUFBLG9CQUFvQixDQUFDLE1BQWlCLEVBQUUsV0FBb0IsRUFBQTtBQUMxRSxJQUFBLElBQUksTUFBTSxJQUFJLE1BQU0sQ0FBQyxNQUFNLEdBQUcsQ0FBQztBQUFFLFFBQUEsT0FBTyxNQUFNLENBQUM7SUFDL0MsSUFBSSxXQUFXLEVBQUU7UUFDZixNQUFNLE1BQU0sR0FBRyxlQUFlLENBQUMsV0FBVyxDQUFDLFdBQVcsRUFBRSxDQUFDLENBQUM7QUFDMUQsUUFBQSxJQUFJLE1BQU07QUFBRSxZQUFBLE9BQU8sTUFBTSxDQUFDO0tBQzNCO0FBQ0QsSUFBQSxPQUFPLGVBQWUsQ0FBQyxRQUFRLENBQUMsQ0FBQztBQUNuQzs7QUNqQ0EsTUFBTSxXQUFXLEdBQUcsU0FBUyxDQUFDO0FBRTlCLFNBQVMsT0FBTyxDQUNkLEdBQVcsRUFDWCxPQUFlLEVBQ2YsUUFBNEIsRUFDNUIsT0FBZSxFQUNmLFNBQWlCLEVBQUE7QUFFakIsSUFBQSxNQUFNLElBQUksR0FBRyxDQUFBLGlCQUFBLEVBQW9CLE9BQU8sQ0FBa0osK0lBQUEsRUFBQSxTQUFTLEVBQUUsQ0FBQztJQUV0TSxJQUFJLFFBQVEsRUFBRTtRQUNaLE9BQU8sQ0FBQSxTQUFBLEVBQVksUUFBUSxDQUFrQywrQkFBQSxFQUFBLE9BQU8sWUFBWSxJQUFJLENBQUEsd0JBQUEsRUFBMkIsR0FBRyxDQUFBLElBQUEsQ0FBTSxDQUFDO0tBQzFIO0FBQ0QsSUFBQSxPQUFPLGVBQWUsT0FBTyxDQUFBLFNBQUEsRUFBWSxJQUFJLENBQUssRUFBQSxFQUFBLEdBQUcsUUFBUSxDQUFDO0FBQ2hFLENBQUM7QUFFRCxTQUFTLFFBQVEsQ0FBQyxLQUFhLEVBQUE7SUFDN0IsT0FBTyxDQUFBLHFEQUFBLEVBQXdELEtBQUssQ0FBQSxNQUFBLENBQVEsQ0FBQztBQUMvRSxDQUFDO1NBRWUsYUFBYSxDQUFDLE1BQXFCLEVBQUUsSUFBMEIsRUFBRSxXQUFtQixFQUFBO0lBQ2xHLE1BQU0sV0FBVyxHQUFHLFlBQVksQ0FBQyxNQUFNLENBQUMsS0FBSyxDQUFDLENBQUM7SUFDL0MsSUFBSSxLQUFLLEdBQUcsRUFBRSxDQUFDO0FBRWYsSUFBQSxLQUFLLElBQUksR0FBRyxHQUFHLENBQUMsRUFBRSxHQUFHLElBQUksV0FBVyxFQUFFLEdBQUcsRUFBRSxFQUFFO1FBQzNDLE1BQU0sS0FBSyxHQUFHLElBQUksQ0FBQyxHQUFHLENBQUMsR0FBRyxDQUFDLENBQUM7UUFDNUIsTUFBTSxNQUFNLEdBQUcsS0FBSyxLQUFLLFNBQVMsSUFBSSxDQUFDLENBQUMsS0FBSyxDQUFDLEtBQUssQ0FBQztRQUNwRCxNQUFNLE9BQU8sR0FBRyxNQUFNLEdBQUcsV0FBVyxHQUFHLFdBQVcsQ0FBQztRQUNuRCxNQUFNLFNBQVMsR0FBRyxNQUFNLEdBQUcsOEJBQThCLEdBQUcsYUFBYSxDQUFDO1FBQzFFLEtBQUssSUFBSSxPQUFPLENBQUMsR0FBRyxFQUFFLE9BQU8sRUFBRSxLQUFLLEtBQUEsSUFBQSxJQUFMLEtBQUssS0FBQSxLQUFBLENBQUEsR0FBQSxLQUFBLENBQUEsR0FBTCxLQUFLLENBQUUsUUFBUSxFQUFFLE1BQU0sR0FBRyxLQUFLLEdBQUcsRUFBRSxFQUFFLFNBQVMsQ0FBQyxDQUFDO0tBQ2pGO0FBRUQsSUFBQSxPQUFPLFFBQVEsQ0FBQyxLQUFLLENBQUMsQ0FBQztBQUN6QixDQUFDO1NBRWUsY0FBYyxDQUFDLE1BQXNCLEVBQUUsSUFBMEIsRUFBRSxXQUFtQixFQUFBOztJQUNwRyxNQUFNLFFBQVEsR0FBRyxDQUFBLEVBQUEsR0FBQSxNQUFNLENBQUMsTUFBTSxNQUFBLElBQUEsSUFBQSxFQUFBLEtBQUEsS0FBQSxDQUFBLEdBQUEsRUFBQSxHQUFJLEVBQUUsQ0FBQztJQUNyQyxJQUFJLEtBQUssR0FBRyxFQUFFLENBQUM7QUFFZixJQUFBLEtBQUssSUFBSSxHQUFHLEdBQUcsQ0FBQyxFQUFFLEdBQUcsSUFBSSxXQUFXLEVBQUUsR0FBRyxFQUFFLEVBQUU7UUFDM0MsTUFBTSxLQUFLLEdBQUcsSUFBSSxDQUFDLEdBQUcsQ0FBQyxHQUFHLENBQUMsQ0FBQztRQUM1QixNQUFNLEdBQUcsR0FBRyxLQUFLLEtBQUEsSUFBQSxJQUFMLEtBQUssS0FBTCxLQUFBLENBQUEsR0FBQSxLQUFBLENBQUEsR0FBQSxLQUFLLENBQUUsS0FBMkIsQ0FBQztRQUMvQyxNQUFNLE9BQU8sR0FBRyxDQUFDLEdBQUcsSUFBSSxRQUFRLENBQUMsR0FBRyxDQUFDLElBQUksUUFBUSxDQUFDLEdBQUcsQ0FBQyxHQUFHLFdBQVcsQ0FBQztRQUNyRSxNQUFNLE9BQU8sR0FBRyxHQUFHLElBQUksUUFBUSxDQUFDLEdBQUcsQ0FBQyxDQUFDO1FBQ3JDLE1BQU0sU0FBUyxHQUFHLE9BQU8sR0FBRyw4QkFBOEIsR0FBRyxhQUFhLENBQUM7UUFDM0UsS0FBSyxJQUFJLE9BQU8sQ0FBQyxHQUFHLEVBQUUsT0FBTyxFQUFFLEtBQUssS0FBTCxJQUFBLElBQUEsS0FBSyxLQUFMLEtBQUEsQ0FBQSxHQUFBLEtBQUEsQ0FBQSxHQUFBLEtBQUssQ0FBRSxRQUFRLEVBQUUsR0FBRyxLQUFBLElBQUEsSUFBSCxHQUFHLEtBQUEsS0FBQSxDQUFBLEdBQUgsR0FBRyxHQUFJLEVBQUUsRUFBRSxTQUFTLENBQUMsQ0FBQztLQUN2RTtBQUVELElBQUEsT0FBTyxRQUFRLENBQUMsS0FBSyxDQUFDLENBQUM7QUFDekIsQ0FBQztTQUVlLGFBQWEsQ0FBQyxNQUFxQixFQUFFLElBQTBCLEVBQUUsV0FBbUIsRUFBQTs7QUFDbEcsSUFBQSxNQUFNLE1BQU0sR0FBRyxvQkFBb0IsQ0FBQyxNQUFNLENBQUMsTUFBTSxFQUFFLE1BQU0sQ0FBQyxXQUFXLENBQUMsQ0FBQztJQUN2RSxJQUFJLENBQUMsTUFBTSxDQUFDLElBQUksSUFBSSxNQUFNLENBQUMsSUFBSSxDQUFDLE1BQU0sS0FBSyxDQUFDO0FBQUUsUUFBQSxNQUFNLElBQUksS0FBSyxDQUFDLG9EQUFvRCxDQUFDLENBQUM7QUFDcEgsSUFBQSxNQUFNLElBQUksR0FBRyxNQUFNLENBQUMsSUFBSSxDQUFDO0lBQ3pCLE1BQU0sSUFBSSxHQUFHLENBQUEsRUFBQSxHQUFBLE1BQU0sQ0FBQyxJQUFJLE1BQUEsSUFBQSxJQUFBLEVBQUEsS0FBQSxLQUFBLENBQUEsR0FBQSxFQUFBLEdBQUksRUFBRSxDQUFDO0lBRS9CLFNBQVMsWUFBWSxDQUFDLEdBQVcsRUFBQTtBQUMvQixRQUFBLElBQUksQ0FBQyxHQUFHLElBQUksR0FBRyxJQUFJLENBQUM7QUFBRSxZQUFBLE9BQU8sQ0FBQyxDQUFDO0FBQy9CLFFBQUEsS0FBSyxJQUFJLENBQUMsR0FBRyxDQUFDLEVBQUUsQ0FBQyxHQUFHLElBQUksQ0FBQyxNQUFNLEVBQUUsQ0FBQyxFQUFFLEVBQUU7QUFDcEMsWUFBQSxJQUFJLEdBQUcsR0FBRyxJQUFJLENBQUMsQ0FBQyxDQUFDO2dCQUFFLE9BQU8sQ0FBQyxHQUFHLENBQUMsQ0FBQztTQUNqQztBQUNELFFBQUEsT0FBTyxJQUFJLENBQUMsTUFBTSxHQUFHLENBQUMsQ0FBQztLQUN4QjtBQUVELElBQUEsTUFBTSxZQUFZLEdBQUcsSUFBSSxDQUFDLE1BQU0sR0FBRyxDQUFDLENBQUM7QUFDckMsSUFBQSxNQUFNLFVBQVUsR0FBRyxNQUFNLENBQUMsTUFBTSxJQUFJLFlBQVksR0FBRyxDQUFDLEdBQUcsTUFBTSxHQUFHO0FBQzlELFFBQUEsR0FBRyxNQUFNO1FBQ1QsR0FBRyxLQUFLLENBQUMsWUFBWSxHQUFHLENBQUMsR0FBRyxNQUFNLENBQUMsTUFBTSxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUEsRUFBQSxHQUFBLE1BQU0sQ0FBQyxNQUFNLENBQUMsTUFBTSxHQUFHLENBQUMsQ0FBQyxNQUFJLElBQUEsSUFBQSxFQUFBLEtBQUEsS0FBQSxDQUFBLEdBQUEsRUFBQSxHQUFBLFdBQVcsQ0FBQztLQUMxRixDQUFDO0lBRUYsSUFBSSxLQUFLLEdBQUcsQ0FBQyxDQUFDO0lBQ2QsSUFBSSxLQUFLLEdBQUcsRUFBRSxDQUFDO0FBRWYsSUFBQSxLQUFLLElBQUksR0FBRyxHQUFHLENBQUMsRUFBRSxHQUFHLElBQUksV0FBVyxFQUFFLEdBQUcsRUFBRSxFQUFFO1FBQzNDLE1BQU0sS0FBSyxHQUFHLElBQUksQ0FBQyxHQUFHLENBQUMsR0FBRyxDQUFDLENBQUM7UUFDNUIsTUFBTSxHQUFHLEdBQUcsUUFBTyxLQUFLLGFBQUwsS0FBSyxLQUFBLEtBQUEsQ0FBQSxHQUFBLEtBQUEsQ0FBQSxHQUFMLEtBQUssQ0FBRSxLQUFLLENBQUEsS0FBSyxRQUFRLEdBQUcsS0FBSyxDQUFDLEtBQUssR0FBRyxDQUFDLENBQUM7UUFDL0QsS0FBSyxJQUFJLEdBQUcsQ0FBQztBQUNiLFFBQUEsTUFBTSxTQUFTLEdBQUcsWUFBWSxDQUFDLEdBQUcsQ0FBQyxDQUFDO1FBQ3BDLE1BQU0sT0FBTyxHQUFHLENBQUEsRUFBQSxHQUFBLFVBQVUsQ0FBQyxTQUFTLENBQUMsTUFBSSxJQUFBLElBQUEsRUFBQSxLQUFBLEtBQUEsQ0FBQSxHQUFBLEVBQUEsR0FBQSxXQUFXLENBQUM7QUFDckQsUUFBQSxNQUFNLE9BQU8sR0FBRyxTQUFTLEdBQUcsQ0FBQyxDQUFDO1FBQzlCLE1BQU0sU0FBUyxHQUFHLE9BQU8sR0FBRyw4QkFBOEIsR0FBRyxhQUFhLENBQUM7QUFDM0UsUUFBQSxNQUFNLE9BQU8sR0FBRyxHQUFHLEdBQUcsQ0FBQyxHQUFHLENBQUcsRUFBQSxHQUFHLEdBQUcsSUFBSSxDQUFBLENBQUUsR0FBRyxFQUFFLENBQUM7QUFDL0MsUUFBQSxLQUFLLElBQUksT0FBTyxDQUFDLEdBQUcsRUFBRSxPQUFPLEVBQUUsS0FBSyxLQUFBLElBQUEsSUFBTCxLQUFLLEtBQUwsS0FBQSxDQUFBLEdBQUEsS0FBQSxDQUFBLEdBQUEsS0FBSyxDQUFFLFFBQVEsRUFBRSxPQUFPLEVBQUUsU0FBUyxDQUFDLENBQUM7S0FDckU7SUFFRCxJQUFJLElBQUksR0FBRyxFQUFFLENBQUM7QUFDZCxJQUFBLElBQUksTUFBTSxDQUFDLFNBQVMsRUFBRTtBQUNwQixRQUFBLE1BQU0sS0FBSyxHQUFHLENBQUEsRUFBQSxHQUFBLE1BQU0sQ0FBQyxVQUFVLG9DQUFLLElBQUksR0FBRyxDQUFJLEVBQUEsQ0FBQSxHQUFHLElBQUksQ0FBQyxDQUFDO0FBQ3hELFFBQUEsSUFBSSxJQUFJLENBQUEsdUVBQUEsRUFBMEUsS0FBSyxDQUFBLDBEQUFBLEVBQTZELEtBQUssQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDLENBQUcsRUFBQSxJQUFJLGVBQWUsQ0FBQztLQUM1TDtBQUNELElBQUEsSUFBSSxJQUFJLFFBQVEsQ0FBQyxLQUFLLENBQUMsQ0FBQztBQUN4QixJQUFBLE9BQU8sSUFBSSxDQUFDO0FBQ2QsQ0FBQztTQUVlLGFBQWEsQ0FDM0IsTUFBcUIsRUFDckIsSUFBMEIsRUFDMUIsV0FBbUIsRUFBQTtJQUVuQixNQUFNLFNBQVMsR0FBRyxRQUFRLENBQUMsYUFBYSxDQUFDLEtBQUssQ0FBQyxDQUFDO0FBQ2hELElBQUEsU0FBUyxDQUFDLEtBQUssQ0FBQyxVQUFVLEdBQUcsMkRBQTJELENBQUM7SUFFekYsSUFBSSxLQUFLLEdBQUcsRUFBRSxDQUFDO0FBQ2YsSUFBQSxJQUFJLE1BQU0sQ0FBQyxJQUFJLEtBQUssU0FBUyxFQUFFO1FBQzdCLEtBQUssR0FBRyxhQUFhLENBQUMsTUFBTSxFQUFFLElBQUksRUFBRSxXQUFXLENBQUMsQ0FBQztLQUNsRDtBQUFNLFNBQUEsSUFBSSxNQUFNLENBQUMsSUFBSSxLQUFLLFVBQVUsRUFBRTtRQUNyQyxLQUFLLEdBQUcsY0FBYyxDQUFDLE1BQU0sRUFBRSxJQUFJLEVBQUUsV0FBVyxDQUFDLENBQUM7S0FDbkQ7QUFBTSxTQUFBLElBQUksTUFBTSxDQUFDLElBQUksS0FBSyxTQUFTLEVBQUU7UUFDcEMsS0FBSyxHQUFHLGFBQWEsQ0FBQyxNQUFNLEVBQUUsSUFBSSxFQUFFLFdBQVcsQ0FBQyxDQUFDO0tBQ2xEO0FBRUQsSUFBQSxTQUFTLENBQUMsU0FBUyxHQUFHLEtBQUssQ0FBQztBQUM1QixJQUFBLE9BQU8sU0FBUyxDQUFDO0FBQ25COztBQ3ZIQSxTQUFTLGdCQUFnQixDQUFDLFVBQWtCLEVBQUUsSUFBWSxFQUFFLEtBQWEsRUFBQTtBQUN2RSxJQUFBLE1BQU0sRUFBRSxHQUFHLE1BQU0sQ0FBQyxLQUFLLENBQUMsQ0FBQyxRQUFRLENBQUMsQ0FBQyxFQUFFLEdBQUcsQ0FBQyxDQUFDO0lBQzFDLE1BQU0sT0FBTyxHQUFHLFVBQVU7QUFDdkIsU0FBQSxPQUFPLENBQUMsTUFBTSxFQUFFLFdBQVcsQ0FBQztBQUM1QixTQUFBLE9BQU8sQ0FBQyxJQUFJLEVBQUUsV0FBVyxDQUFDO0FBQzFCLFNBQUEsT0FBTyxDQUFDLElBQUksRUFBRSxXQUFXLENBQUM7QUFDMUIsU0FBQSxPQUFPLENBQUMscUJBQXFCLEVBQUUsTUFBTSxDQUFDO0FBQ3RDLFNBQUEsT0FBTyxDQUFDLFdBQVcsRUFBRSxNQUFNLENBQUMsSUFBSSxDQUFDLENBQUM7QUFDbEMsU0FBQSxPQUFPLENBQUMsV0FBVyxFQUFFLEVBQUUsQ0FBQztBQUN4QixTQUFBLE9BQU8sQ0FBQyxXQUFXLEVBQUUsVUFBVSxDQUFDLENBQUM7QUFDcEMsSUFBQSxPQUFPLElBQUksTUFBTSxDQUFDLElBQUksT0FBTyxDQUFBLENBQUUsQ0FBQyxDQUFDO0FBQ25DLENBQUM7QUFFb0IsTUFBQSxvQkFBcUIsU0FBUUMsZUFBTSxDQUFBO0FBR3RELElBQUEsTUFBTSxNQUFNLEdBQUE7QUFDVixRQUFBLE1BQU0sSUFBSSxDQUFDLFlBQVksRUFBRSxDQUFDO0FBQzFCLFFBQUEsSUFBSSxDQUFDLGFBQWEsQ0FBQyxJQUFJLHdCQUF3QixDQUFDLElBQUksQ0FBQyxHQUFHLEVBQUUsSUFBSSxDQUFDLENBQUMsQ0FBQztBQUVqRSxRQUFBLElBQUksQ0FBQyxrQ0FBa0MsQ0FDckMsaUJBQWlCLEVBQ2pCLE9BQU8sTUFBTSxFQUFFLEVBQUUsRUFBRSxHQUFHLEtBQUk7QUFDeEIsWUFBQSxJQUFJO2dCQUNGLE1BQU0sSUFBSSxDQUFDLFlBQVksQ0FBQyxNQUFNLEVBQUUsRUFBRSxFQUFFLEdBQUcsQ0FBQyxDQUFDO2FBQzFDO1lBQUMsT0FBTyxHQUFHLEVBQUU7QUFDWixnQkFBQSxFQUFFLENBQUMsUUFBUSxDQUFDLEtBQUssRUFBRTtBQUNqQixvQkFBQSxJQUFJLEVBQUUsQ0FBMkIsd0JBQUEsRUFBQSxHQUFHLFlBQVksS0FBSyxHQUFHLEdBQUcsQ0FBQyxPQUFPLEdBQUcsTUFBTSxDQUFDLEdBQUcsQ0FBQyxDQUFFLENBQUE7QUFDbkYsb0JBQUEsR0FBRyxFQUFFLHVCQUF1QjtBQUM3QixpQkFBQSxDQUFDLENBQUM7YUFDSjtBQUNILFNBQUMsQ0FDRixDQUFDO0tBQ0g7QUFFTyxJQUFBLE1BQU0sWUFBWSxDQUN4QixNQUFjLEVBQ2QsRUFBZSxFQUNmLEdBQWlDLEVBQUE7O1FBRWpDLE1BQU0sTUFBTSxHQUFHQyxrQkFBUyxDQUFDLE1BQU0sQ0FBQyxJQUFJLEVBQUUsQ0FBa0IsQ0FBQztRQUN6RCxJQUFJLEVBQUMsTUFBTSxLQUFOLElBQUEsSUFBQSxNQUFNLEtBQU4sS0FBQSxDQUFBLEdBQUEsS0FBQSxDQUFBLEdBQUEsTUFBTSxDQUFFLElBQUksQ0FBQSxFQUFFO0FBQ2pCLFlBQUEsTUFBTSxJQUFJLEtBQUssQ0FBQyw2REFBNkQsQ0FBQyxDQUFDO1NBQ2hGO1FBQ0QsSUFBSSxDQUFDLE1BQU0sQ0FBQyxRQUFRLElBQUksTUFBTSxDQUFDLElBQUksS0FBSyxTQUFTLEVBQUU7QUFDakQsWUFBQSxNQUFNLElBQUksS0FBSyxDQUFDLGtDQUFrQyxDQUFDLENBQUM7U0FDckQ7O0FBR0QsUUFBQSxNQUFNLFdBQVcsR0FBRyxJQUFJLENBQUMsR0FBRyxDQUFDLEtBQUssQ0FBQyxxQkFBcUIsQ0FBQyxHQUFHLENBQUMsVUFBVSxDQUFDLENBQUM7QUFDekUsUUFBQSxJQUFJLEVBQUUsV0FBVyxZQUFZQyxjQUFLLENBQUMsRUFBRTtBQUNuQyxZQUFBLE1BQU0sSUFBSSxLQUFLLENBQUMsNkJBQTZCLENBQUMsQ0FBQztTQUNoRDtBQUNELFFBQUEsTUFBTSxFQUFFLEdBQUcsQ0FBQSxFQUFBLEdBQUEsSUFBSSxDQUFDLEdBQUcsQ0FBQyxhQUFhLENBQUMsWUFBWSxDQUFDLFdBQVcsQ0FBQyxNQUFBLElBQUEsSUFBQSxFQUFBLEtBQUEsS0FBQSxDQUFBLEdBQUEsS0FBQSxDQUFBLEdBQUEsRUFBQSxDQUFFLFdBQVcsQ0FBQztRQUN6RSxNQUFNLElBQUksR0FBVyxFQUFFLEtBQUEsSUFBQSxJQUFGLEVBQUUsS0FBRixLQUFBLENBQUEsR0FBQSxLQUFBLENBQUEsR0FBQSxFQUFFLENBQUUsSUFBSSxDQUFDO1FBQzlCLE1BQU0sS0FBSyxHQUFXLEVBQUUsS0FBQSxJQUFBLElBQUYsRUFBRSxLQUFGLEtBQUEsQ0FBQSxHQUFBLEtBQUEsQ0FBQSxHQUFBLEVBQUUsQ0FBRSxLQUFLLENBQUM7QUFDaEMsUUFBQSxJQUFJLENBQUMsSUFBSSxJQUFJLENBQUMsS0FBSyxFQUFFO0FBQ25CLFlBQUEsTUFBTSxJQUFJLEtBQUssQ0FBQywwREFBMEQsQ0FBQyxDQUFDO1NBQzdFO0FBRUQsUUFBQSxNQUFNLFdBQVcsR0FBRyxJQUFJLElBQUksQ0FBQyxJQUFJLEVBQUUsS0FBSyxFQUFFLENBQUMsQ0FBQyxDQUFDLE9BQU8sRUFBRSxDQUFDO0FBQ3ZELFFBQUEsTUFBTSxNQUFNLEdBQUcsQ0FBQSxFQUFBLEdBQUEsTUFBTSxDQUFDLE1BQU0sTUFBSSxJQUFBLElBQUEsRUFBQSxLQUFBLEtBQUEsQ0FBQSxHQUFBLEVBQUEsR0FBQSxJQUFJLENBQUMsUUFBUSxDQUFDLGdCQUFnQixDQUFDO0FBQy9ELFFBQUEsTUFBTSxPQUFPLEdBQUcsZ0JBQWdCLENBQUMsSUFBSSxDQUFDLFFBQVEsQ0FBQyxVQUFVLEVBQUUsSUFBSSxFQUFFLE1BQU0sQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDOztBQUdoRixRQUFBLE1BQU0sSUFBSSxHQUFHLElBQUksR0FBRyxFQUFtQixDQUFDO0FBQ3hDLFFBQUEsTUFBTSxjQUFjLEdBQUcsSUFBSSxDQUFDLEdBQUcsQ0FBQyxLQUFLLENBQUMscUJBQXFCLENBQUMsTUFBTSxDQUFDLENBQUM7UUFFcEUsSUFBSSxjQUFjLEVBQUU7O1lBRWxCLE1BQU0sUUFBUSxHQUFjLENBQUEsRUFBQSxHQUFBLGNBQWMsQ0FBQyxRQUFRLE1BQUEsSUFBQSxJQUFBLEVBQUEsS0FBQSxLQUFBLENBQUEsR0FBQSxFQUFBLEdBQUksRUFBRSxDQUFDO0FBQzFELFlBQUEsS0FBSyxNQUFNLEtBQUssSUFBSSxRQUFRLEVBQUU7QUFDNUIsZ0JBQUEsSUFBSSxFQUFFLEtBQUssWUFBWUEsY0FBSyxDQUFDO29CQUFFLFNBQVM7Z0JBQ3hDLE1BQU0sS0FBSyxHQUFHLEtBQUssQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLE9BQU8sQ0FBQyxDQUFDO0FBQ3hDLGdCQUFBLElBQUksQ0FBQyxLQUFLO29CQUFFLFNBQVM7Z0JBQ3JCLE1BQU0sR0FBRyxHQUFHLFFBQVEsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQztBQUUvQixnQkFBQSxNQUFNLE9BQU8sR0FBRyxDQUFBLEVBQUEsR0FBQSxJQUFJLENBQUMsR0FBRyxDQUFDLGFBQWEsQ0FBQyxZQUFZLENBQUMsS0FBSyxDQUFDLE1BQUEsSUFBQSxJQUFBLEVBQUEsS0FBQSxLQUFBLENBQUEsR0FBQSxLQUFBLENBQUEsR0FBQSxFQUFBLENBQUUsV0FBVyxDQUFDO2dCQUN4RSxJQUFJLEtBQUssR0FBWSxTQUFTLENBQUM7QUFFL0IsZ0JBQUEsSUFBSSxNQUFNLENBQUMsUUFBUSxLQUFLLElBQUksSUFBSSxNQUFNLENBQUMsUUFBUSxLQUFLLFNBQVMsRUFBRTs7b0JBRTdELEtBQUssR0FBRyxJQUFJLENBQUM7aUJBQ2Q7cUJBQU07b0JBQ0wsS0FBSyxHQUFHLE9BQU8sS0FBQSxJQUFBLElBQVAsT0FBTyxLQUFBLEtBQUEsQ0FBQSxHQUFBLEtBQUEsQ0FBQSxHQUFQLE9BQU8sQ0FBRyxNQUFNLENBQUMsUUFBUSxDQUFDLENBQUM7aUJBQ3BDO0FBRUQsZ0JBQUEsSUFBSSxDQUFDLEdBQUcsQ0FBQyxHQUFHLEVBQUUsRUFBRSxHQUFHLEVBQUUsS0FBSyxFQUFFLFFBQVEsRUFBRSxLQUFLLENBQUMsSUFBSSxFQUFFLENBQUMsQ0FBQzthQUNyRDtTQUNGO1FBRUQsTUFBTSxRQUFRLEdBQUcsYUFBYSxDQUFDLE1BQU0sRUFBRSxJQUFJLEVBQUUsV0FBVyxDQUFDLENBQUM7QUFDMUQsUUFBQSxFQUFFLENBQUMsV0FBVyxDQUFDLFFBQVEsQ0FBQyxDQUFDO0tBQzFCO0FBRUQsSUFBQSxNQUFNLFlBQVksR0FBQTtBQUNoQixRQUFBLElBQUksQ0FBQyxRQUFRLEdBQUcsTUFBTSxDQUFDLE1BQU0sQ0FBQyxFQUFFLEVBQUUsZ0JBQWdCLEVBQUUsTUFBTSxJQUFJLENBQUMsUUFBUSxFQUFFLENBQUMsQ0FBQztLQUM1RTtBQUVELElBQUEsTUFBTSxZQUFZLEdBQUE7UUFDaEIsTUFBTSxJQUFJLENBQUMsUUFBUSxDQUFDLElBQUksQ0FBQyxRQUFRLENBQUMsQ0FBQztLQUNwQztBQUNGOzs7OyJ9
