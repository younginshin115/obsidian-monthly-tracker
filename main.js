'use strict';

var obsidian = require('obsidian');

const DEFAULT_SETTINGS = {
    dailyNotesFolder: '',
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
function detectDailyNotesFolder(app) {
    var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k;
    const internal = (_e = (_d = (_c = (_b = (_a = app.internalPlugins) === null || _a === void 0 ? void 0 : _a.plugins) === null || _b === void 0 ? void 0 : _b['daily-notes']) === null || _c === void 0 ? void 0 : _c.instance) === null || _d === void 0 ? void 0 : _d.options) === null || _e === void 0 ? void 0 : _e.folder;
    if (internal)
        return internal;
    const periodic = (_k = (_j = (_h = (_g = (_f = app.plugins) === null || _f === void 0 ? void 0 : _f.plugins) === null || _g === void 0 ? void 0 : _g['periodic-notes']) === null || _h === void 0 ? void 0 : _h.settings) === null || _j === void 0 ? void 0 : _j.daily) === null || _k === void 0 ? void 0 : _k.folder;
    if (periodic)
        return periodic;
    return '';
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
        const folder = (_b = config.source) !== null && _b !== void 0 ? _b : (this.settings.dailyNotesFolder || detectDailyNotesFolder(this.app));
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWFpbi5qcyIsInNvdXJjZXMiOlsic3JjL3R5cGVzLnRzIiwic3JjL3NldHRpbmdzLnRzIiwic3JjL3ByZXNldHMudHMiLCJzcmMvcmVuZGVyZXIudHMiLCJzcmMvbWFpbi50cyJdLCJzb3VyY2VzQ29udGVudCI6WyJleHBvcnQgaW50ZXJmYWNlIEJvb2xlYW5Db25maWcge1xuICB0eXBlOiAnYm9vbGVhbic7XG4gIHRpdGxlPzogc3RyaW5nO1xuICBwcm9wZXJ0eT86IHN0cmluZztcbiAgc291cmNlPzogc3RyaW5nO1xuICAvKiogaGV4IGNvbG9yIHN0cmluZyBvciBwcmVzZXQgbmFtZSAoZS5nLiBcImJsdWVcIikgKi9cbiAgY29sb3I6IHN0cmluZztcbn1cblxuZXhwb3J0IGludGVyZmFjZSBDb2xvcm1hcENvbmZpZyB7XG4gIHR5cGU6ICdjb2xvcm1hcCc7XG4gIHRpdGxlPzogc3RyaW5nO1xuICBwcm9wZXJ0eTogc3RyaW5nO1xuICBzb3VyY2U/OiBzdHJpbmc7XG4gIGNvbG9yczogUmVjb3JkPHN0cmluZywgc3RyaW5nPjtcbn1cblxuZXhwb3J0IGludGVyZmFjZSBIZWF0bWFwQ29uZmlnIHtcbiAgdHlwZTogJ2hlYXRtYXAnO1xuICB0aXRsZT86IHN0cmluZztcbiAgcHJvcGVydHk6IHN0cmluZztcbiAgc291cmNlPzogc3RyaW5nO1xuICB1bml0Pzogc3RyaW5nO1xuICAvKipcbiAgICogVGhyZXNob2xkcyBzZXBhcmF0aW5nIGludGVuc2l0eSBsZXZlbHMuXG4gICAqIGUuZy4gWzMsIDUsIDcsIDEwXSDihpIgNSBidWNrZXRzOiBbMCwzKSwgWzMsNSksIFs1LDcpLCBbNywxMCksIFsxMCziiJ4pXG4gICAqL1xuICBiaW5zPzogbnVtYmVyW107XG4gIC8qKiBhcnJheSBvZiBoZXggY29sb3JzLCBsZW5ndGggPSBiaW5zLmxlbmd0aCArIDEsIG9yIG9taXQgYW5kIHVzZSBjb2xvclNjaGVtZSAqL1xuICBjb2xvcnM/OiBzdHJpbmdbXTtcbiAgLyoqIGJ1aWx0LWluIGhlYXRtYXAgY29sb3Igc2NoZW1lIG5hbWUgKGUuZy4gXCJpbmRpZ29cIikgKi9cbiAgY29sb3JTY2hlbWU/OiBzdHJpbmc7XG4gIHNob3dUb3RhbD86IGJvb2xlYW47XG4gIC8qKiBsYWJlbCBzaG93biBuZXh0IHRvIHRvdGFsLCBkZWZhdWx0cyB0byBwcm9wZXJ0eSBuYW1lICovXG4gIHRvdGFsTGFiZWw/OiBzdHJpbmc7XG59XG5cbmV4cG9ydCB0eXBlIFRyYWNrZXJDb25maWcgPSBCb29sZWFuQ29uZmlnIHwgQ29sb3JtYXBDb25maWcgfCBIZWF0bWFwQ29uZmlnO1xuXG5leHBvcnQgaW50ZXJmYWNlIFBsdWdpblNldHRpbmdzIHtcbiAgZGFpbHlOb3Rlc0ZvbGRlcjogc3RyaW5nO1xuICBkYXRlRm9ybWF0OiBzdHJpbmc7XG59XG5cbmV4cG9ydCBjb25zdCBERUZBVUxUX1NFVFRJTkdTOiBQbHVnaW5TZXR0aW5ncyA9IHtcbiAgZGFpbHlOb3Rlc0ZvbGRlcjogJycsXG4gIGRhdGVGb3JtYXQ6ICdZWVlZLU1NLUREJyxcbn07XG4iLCJpbXBvcnQgeyBBcHAsIFBsdWdpblNldHRpbmdUYWIsIFNldHRpbmcgfSBmcm9tICdvYnNpZGlhbic7XG5pbXBvcnQgdHlwZSBNb250aGx5VHJhY2tlclBsdWdpbiBmcm9tICcuL21haW4nO1xuXG5leHBvcnQgY2xhc3MgTW9udGhseVRyYWNrZXJTZXR0aW5nVGFiIGV4dGVuZHMgUGx1Z2luU2V0dGluZ1RhYiB7XG4gIHBsdWdpbjogTW9udGhseVRyYWNrZXJQbHVnaW47XG5cbiAgY29uc3RydWN0b3IoYXBwOiBBcHAsIHBsdWdpbjogTW9udGhseVRyYWNrZXJQbHVnaW4pIHtcbiAgICBzdXBlcihhcHAsIHBsdWdpbik7XG4gICAgdGhpcy5wbHVnaW4gPSBwbHVnaW47XG4gIH1cblxuICBkaXNwbGF5KCk6IHZvaWQge1xuICAgIGNvbnN0IHsgY29udGFpbmVyRWwgfSA9IHRoaXM7XG4gICAgY29udGFpbmVyRWwuZW1wdHkoKTtcblxuICAgIG5ldyBTZXR0aW5nKGNvbnRhaW5lckVsKVxuICAgICAgLnNldE5hbWUoJ0RhaWx5IG5vdGVzIGZvbGRlcicpXG4gICAgICAuc2V0RGVzYygnRm9sZGVyIGNvbnRhaW5pbmcgZGFpbHkgbm90ZXMgKGUuZy4gMDQgQ2FsZW5kYXIvRGF5cyknKVxuICAgICAgLmFkZFRleHQodGV4dCA9PlxuICAgICAgICB0ZXh0XG4gICAgICAgICAgLnNldFBsYWNlaG9sZGVyKCcwNCBDYWxlbmRhci9EYXlzJylcbiAgICAgICAgICAuc2V0VmFsdWUodGhpcy5wbHVnaW4uc2V0dGluZ3MuZGFpbHlOb3Rlc0ZvbGRlcilcbiAgICAgICAgICAub25DaGFuZ2UoYXN5bmMgKHZhbHVlKSA9PiB7XG4gICAgICAgICAgICB0aGlzLnBsdWdpbi5zZXR0aW5ncy5kYWlseU5vdGVzRm9sZGVyID0gdmFsdWUudHJpbSgpO1xuICAgICAgICAgICAgYXdhaXQgdGhpcy5wbHVnaW4uc2F2ZVNldHRpbmdzKCk7XG4gICAgICAgICAgfSksXG4gICAgICApO1xuXG4gICAgbmV3IFNldHRpbmcoY29udGFpbmVyRWwpXG4gICAgICAuc2V0TmFtZSgnRGF0ZSBmb3JtYXQnKVxuICAgICAgLnNldERlc2MoJ0ZpbGUgbmFtZSBkYXRlIGZvcm1hdC4gTXVzdCBtYXRjaCBZWVlZLU1NLUREIGF0IHRoZSBzdGFydCBvZiBmaWxlIG5hbWVzLicpXG4gICAgICAuYWRkVGV4dCh0ZXh0ID0+XG4gICAgICAgIHRleHRcbiAgICAgICAgICAuc2V0UGxhY2Vob2xkZXIoJ1lZWVktTU0tREQnKVxuICAgICAgICAgIC5zZXRWYWx1ZSh0aGlzLnBsdWdpbi5zZXR0aW5ncy5kYXRlRm9ybWF0KVxuICAgICAgICAgIC5vbkNoYW5nZShhc3luYyAodmFsdWUpID0+IHtcbiAgICAgICAgICAgIHRoaXMucGx1Z2luLnNldHRpbmdzLmRhdGVGb3JtYXQgPSB2YWx1ZS50cmltKCk7XG4gICAgICAgICAgICBhd2FpdCB0aGlzLnBsdWdpbi5zYXZlU2V0dGluZ3MoKTtcbiAgICAgICAgICB9KSxcbiAgICAgICk7XG4gIH1cbn1cbiIsIi8qKiBTaW5nbGUtY29sb3IgcHJlc2V0cyBmb3IgYm9vbGVhbiB0cmFja2VyICovXG5leHBvcnQgY29uc3QgQ09MT1JfUFJFU0VUUzogUmVjb3JkPHN0cmluZywgc3RyaW5nPiA9IHtcbiAgYmx1ZTogICAnIzY0YjVmNicsXG4gIGdyZWVuOiAgJyM2NmJiNmEnLFxuICByZWQ6ICAgICcjZTU3MzczJyxcbiAgcHVycGxlOiAnI2JhNjhjOCcsXG4gIG9yYW5nZTogJyNmZmI3NGQnLFxuICB5ZWxsb3c6ICcjZmZkNTRmJyxcbiAgdGVhbDogICAnIzRkYjZhYycsXG4gIGluZGlnbzogJyM3OTg2Y2InLFxuICBwaW5rOiAgICcjZjA2MjkyJyxcbn07XG5cbi8qKlxuICogSGVhdG1hcCBjb2xvci1zY2hlbWUgcHJlc2V0cy5cbiAqIEluZGV4IDAgPSBubyBkYXRhLCBpbmRleCAxLi5uID0gaW5jcmVhc2luZyBpbnRlbnNpdHkuXG4gKi9cbmV4cG9ydCBjb25zdCBIRUFUTUFQX1NDSEVNRVM6IFJlY29yZDxzdHJpbmcsIHN0cmluZ1tdPiA9IHtcbiAgYmx1ZTogICBbJyNlYmVkZjAnLCAnI2JiZGVmYicsICcjOTBjYWY5JywgJyM2NGI1ZjYnLCAnIzQyYTVmNScsICcjMWU4OGU1J10sXG4gIGdyZWVuOiAgWycjZWJlZGYwJywgJyNjOGU2YzknLCAnI2E1ZDZhNycsICcjODFjNzg0JywgJyM2NmJiNmEnLCAnIzQzYTA0NyddLFxuICByZWQ6ICAgIFsnI2ViZWRmMCcsICcjZmZjZGQyJywgJyNlZjlhOWEnLCAnI2U1NzM3MycsICcjZWY1MzUwJywgJyNlNTM5MzUnXSxcbiAgcHVycGxlOiBbJyNlYmVkZjAnLCAnI2UxYmVlNycsICcjY2U5M2Q4JywgJyNiYTY4YzgnLCAnI2FiNDdiYycsICcjOGUyNGFhJ10sXG4gIG9yYW5nZTogWycjZWJlZGYwJywgJyNmZmUwYjInLCAnI2ZmY2M4MCcsICcjZmZiNzRkJywgJyNmZmE3MjYnLCAnI2ZiOGMwMCddLFxuICB5ZWxsb3c6IFsnI2ViZWRmMCcsICcjZmZmOWM0JywgJyNmZmY1OWQnLCAnI2ZmZjE3NicsICcjZmZlZTU4JywgJyNmZGQ4MzUnXSxcbiAgdGVhbDogICBbJyNlYmVkZjAnLCAnI2IyZGZkYicsICcjODBjYmM0JywgJyM0ZGI2YWMnLCAnIzI2YTY5YScsICcjMDA4OTdiJ10sXG4gIGluZGlnbzogWycjZWJlZGYwJywgJyNlOGVhZjYnLCAnI2M1Y2FlOScsICcjOWZhOGRhJywgJyM3OTg2Y2InLCAnIzVjNmJjMCddLFxuICBwaW5rOiAgIFsnI2ViZWRmMCcsICcjZmNlNGVjJywgJyNmNDhmYjEnLCAnI2YwNjI5MicsICcjZWM0MDdhJywgJyNkODFiNjAnXSxcbn07XG5cbi8qKiBSZXNvbHZlIGEgY29sb3Igc3RyaW5nOiBpZiBpdCdzIGEga25vd24gcHJlc2V0IG5hbWUsIHJldHVybiB0aGUgaGV4OyBvdGhlcndpc2UgcmV0dXJuIGFzLWlzLiAqL1xuZXhwb3J0IGZ1bmN0aW9uIHJlc29sdmVDb2xvcihjb2xvcjogc3RyaW5nKTogc3RyaW5nIHtcbiAgcmV0dXJuIENPTE9SX1BSRVNFVFNbY29sb3IudG9Mb3dlckNhc2UoKV0gPz8gY29sb3I7XG59XG5cbi8qKiBSZXNvbHZlIGhlYXRtYXAgY29sb3JzIGFycmF5IGZyb20gY29sb3JTY2hlbWUgcHJlc2V0IG9yIGV4cGxpY2l0IGNvbG9ycyBhcnJheS4gKi9cbmV4cG9ydCBmdW5jdGlvbiByZXNvbHZlSGVhdG1hcENvbG9ycyhjb2xvcnM/OiBzdHJpbmdbXSwgY29sb3JTY2hlbWU/OiBzdHJpbmcpOiBzdHJpbmdbXSB7XG4gIGlmIChjb2xvcnMgJiYgY29sb3JzLmxlbmd0aCA+IDApIHJldHVybiBjb2xvcnM7XG4gIGlmIChjb2xvclNjaGVtZSkge1xuICAgIGNvbnN0IHNjaGVtZSA9IEhFQVRNQVBfU0NIRU1FU1tjb2xvclNjaGVtZS50b0xvd2VyQ2FzZSgpXTtcbiAgICBpZiAoc2NoZW1lKSByZXR1cm4gc2NoZW1lO1xuICB9XG4gIHJldHVybiBIRUFUTUFQX1NDSEVNRVNbJ2luZGlnbyddO1xufVxuXG4iLCJpbXBvcnQgeyBUcmFja2VyQ29uZmlnLCBCb29sZWFuQ29uZmlnLCBDb2xvcm1hcENvbmZpZywgSGVhdG1hcENvbmZpZyB9IGZyb20gJy4vdHlwZXMnO1xuaW1wb3J0IHsgcmVzb2x2ZUNvbG9yLCByZXNvbHZlSGVhdG1hcENvbG9ycyB9IGZyb20gJy4vcHJlc2V0cyc7XG5cbmV4cG9ydCBpbnRlcmZhY2UgRGF5RGF0YSB7XG4gIGRheTogbnVtYmVyO1xuICB2YWx1ZTogdW5rbm93bjtcbiAgZmlsZVBhdGg/OiBzdHJpbmc7XG59XG5cbmNvbnN0IEVNUFRZX0NPTE9SID0gJyNlYmVkZjAnO1xuXG5mdW5jdGlvbiBkYXlDZWxsKFxuICBkYXk6IG51bWJlcixcbiAgYmdDb2xvcjogc3RyaW5nLFxuICBmaWxlUGF0aDogc3RyaW5nIHwgdW5kZWZpbmVkLFxuICB0b29sdGlwOiBzdHJpbmcsXG4gIHRleHRTdHlsZTogc3RyaW5nLFxuKTogc3RyaW5nIHtcbiAgY29uc3QgYmFzZSA9IGBiYWNrZ3JvdW5kLWNvbG9yOiR7YmdDb2xvcn07ZGlzcGxheTpmbGV4O2FsaWduLWl0ZW1zOmNlbnRlcjtqdXN0aWZ5LWNvbnRlbnQ6Y2VudGVyO3BhZGRpbmc6NHB4IDA7Ym9yZGVyLXJhZGl1czoycHg7Zm9udC1zaXplOjlweDtmbGV4OjE7bWluLXdpZHRoOjA7Ym94LXNpemluZzpib3JkZXItYm94OyR7dGV4dFN0eWxlfWA7XG5cbiAgaWYgKGZpbGVQYXRoKSB7XG4gICAgcmV0dXJuIGA8YSBocmVmPVwiJHtmaWxlUGF0aH1cIiBjbGFzcz1cImludGVybmFsLWxpbmtcIiB0aXRsZT1cIiR7dG9vbHRpcH1cIiBzdHlsZT1cIiR7YmFzZX07dGV4dC1kZWNvcmF0aW9uOm5vbmU7XCI+JHtkYXl9PC9hPmA7XG4gIH1cbiAgcmV0dXJuIGA8ZGl2IHRpdGxlPVwiJHt0b29sdGlwfVwiIHN0eWxlPVwiJHtiYXNlfVwiPiR7ZGF5fTwvZGl2PmA7XG59XG5cbmZ1bmN0aW9uIHdyYXBHcmlkKGNlbGxzOiBzdHJpbmcpOiBzdHJpbmcge1xuICByZXR1cm4gYDxkaXYgc3R5bGU9XCJkaXNwbGF5OmZsZXg7Z2FwOjJweDttYXJnaW4tYm90dG9tOjhweDtcIj4ke2NlbGxzfTwvZGl2PmA7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiByZW5kZXJCb29sZWFuKGNvbmZpZzogQm9vbGVhbkNvbmZpZywgZGF0YTogTWFwPG51bWJlciwgRGF5RGF0YT4sIGRheXNJbk1vbnRoOiBudW1iZXIpOiBzdHJpbmcge1xuICBjb25zdCBhY3RpdmVDb2xvciA9IHJlc29sdmVDb2xvcihjb25maWcuY29sb3IpO1xuICBsZXQgY2VsbHMgPSAnJztcblxuICBmb3IgKGxldCBkYXkgPSAxOyBkYXkgPD0gZGF5c0luTW9udGg7IGRheSsrKSB7XG4gICAgY29uc3QgZW50cnkgPSBkYXRhLmdldChkYXkpO1xuICAgIGNvbnN0IGFjdGl2ZSA9IGVudHJ5ICE9PSB1bmRlZmluZWQgJiYgISFlbnRyeS52YWx1ZTtcbiAgICBjb25zdCBiZ0NvbG9yID0gYWN0aXZlID8gYWN0aXZlQ29sb3IgOiBFTVBUWV9DT0xPUjtcbiAgICBjb25zdCB0ZXh0U3R5bGUgPSBhY3RpdmUgPyAnZm9udC13ZWlnaHQ6NjAwO2NvbG9yOndoaXRlOycgOiAnY29sb3I6Izk5OTsnO1xuICAgIGNlbGxzICs9IGRheUNlbGwoZGF5LCBiZ0NvbG9yLCBlbnRyeT8uZmlsZVBhdGgsIGFjdGl2ZSA/ICdZZXMnIDogJycsIHRleHRTdHlsZSk7XG4gIH1cblxuICByZXR1cm4gd3JhcEdyaWQoY2VsbHMpO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gcmVuZGVyQ29sb3JtYXAoY29uZmlnOiBDb2xvcm1hcENvbmZpZywgZGF0YTogTWFwPG51bWJlciwgRGF5RGF0YT4sIGRheXNJbk1vbnRoOiBudW1iZXIpOiBzdHJpbmcge1xuICBjb25zdCBjb2xvck1hcCA9IGNvbmZpZy5jb2xvcnMgPz8ge307XG4gIGxldCBjZWxscyA9ICcnO1xuXG4gIGZvciAobGV0IGRheSA9IDE7IGRheSA8PSBkYXlzSW5Nb250aDsgZGF5KyspIHtcbiAgICBjb25zdCBlbnRyeSA9IGRhdGEuZ2V0KGRheSk7XG4gICAgY29uc3QgdmFsID0gZW50cnk/LnZhbHVlIGFzIHN0cmluZyB8IHVuZGVmaW5lZDtcbiAgICBjb25zdCBiZ0NvbG9yID0gKHZhbCAmJiBjb2xvck1hcFt2YWxdKSA/IGNvbG9yTWFwW3ZhbF0gOiBFTVBUWV9DT0xPUjtcbiAgICBjb25zdCBoYXNEYXRhID0gdmFsICYmIGNvbG9yTWFwW3ZhbF07XG4gICAgY29uc3QgdGV4dFN0eWxlID0gaGFzRGF0YSA/ICdmb250LXdlaWdodDo2MDA7Y29sb3I6d2hpdGU7JyA6ICdjb2xvcjojOTk5Oyc7XG4gICAgY2VsbHMgKz0gZGF5Q2VsbChkYXksIGJnQ29sb3IsIGVudHJ5Py5maWxlUGF0aCwgdmFsID8/ICcnLCB0ZXh0U3R5bGUpO1xuICB9XG5cbiAgcmV0dXJuIHdyYXBHcmlkKGNlbGxzKTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHJlbmRlckhlYXRtYXAoY29uZmlnOiBIZWF0bWFwQ29uZmlnLCBkYXRhOiBNYXA8bnVtYmVyLCBEYXlEYXRhPiwgZGF5c0luTW9udGg6IG51bWJlcik6IHN0cmluZyB7XG4gIGNvbnN0IGNvbG9ycyA9IHJlc29sdmVIZWF0bWFwQ29sb3JzKGNvbmZpZy5jb2xvcnMsIGNvbmZpZy5jb2xvclNjaGVtZSk7XG4gIGlmICghY29uZmlnLmJpbnMgfHwgY29uZmlnLmJpbnMubGVuZ3RoID09PSAwKSB0aHJvdyBuZXcgRXJyb3IoJ2hlYXRtYXAgcmVxdWlyZXMgXCJiaW5zXCIgKGUuZy4gYmluczogWzMsIDUsIDcsIDEwXSknKTtcbiAgY29uc3QgYmlucyA9IGNvbmZpZy5iaW5zO1xuICBjb25zdCB1bml0ID0gY29uZmlnLnVuaXQgPz8gJyc7XG5cbiAgZnVuY3Rpb24gZ2V0SW50ZW5zaXR5KHZhbDogbnVtYmVyKTogbnVtYmVyIHtcbiAgICBpZiAoIXZhbCB8fCB2YWwgPD0gMCkgcmV0dXJuIDA7XG4gICAgZm9yIChsZXQgaSA9IDA7IGkgPCBiaW5zLmxlbmd0aDsgaSsrKSB7XG4gICAgICBpZiAodmFsIDwgYmluc1tpXSkgcmV0dXJuIGkgKyAxO1xuICAgIH1cbiAgICByZXR1cm4gYmlucy5sZW5ndGggKyAxO1xuICB9XG5cbiAgY29uc3QgbWF4SW50ZW5zaXR5ID0gYmlucy5sZW5ndGggKyAxO1xuICBjb25zdCBzYWZlQ29sb3JzID0gY29sb3JzLmxlbmd0aCA+PSBtYXhJbnRlbnNpdHkgKyAxID8gY29sb3JzIDogW1xuICAgIC4uLmNvbG9ycyxcbiAgICAuLi5BcnJheShtYXhJbnRlbnNpdHkgKyAxIC0gY29sb3JzLmxlbmd0aCkuZmlsbChjb2xvcnNbY29sb3JzLmxlbmd0aCAtIDFdID8/IEVNUFRZX0NPTE9SKSxcbiAgXTtcblxuICBsZXQgdG90YWwgPSAwO1xuICBsZXQgY2VsbHMgPSAnJztcblxuICBmb3IgKGxldCBkYXkgPSAxOyBkYXkgPD0gZGF5c0luTW9udGg7IGRheSsrKSB7XG4gICAgY29uc3QgZW50cnkgPSBkYXRhLmdldChkYXkpO1xuICAgIGNvbnN0IHZhbCA9IHR5cGVvZiBlbnRyeT8udmFsdWUgPT09ICdudW1iZXInID8gZW50cnkudmFsdWUgOiAwO1xuICAgIHRvdGFsICs9IHZhbDtcbiAgICBjb25zdCBpbnRlbnNpdHkgPSBnZXRJbnRlbnNpdHkodmFsKTtcbiAgICBjb25zdCBiZ0NvbG9yID0gc2FmZUNvbG9yc1tpbnRlbnNpdHldID8/IEVNUFRZX0NPTE9SO1xuICAgIGNvbnN0IGhhc0RhdGEgPSBpbnRlbnNpdHkgPiAwO1xuICAgIGNvbnN0IHRleHRTdHlsZSA9IGhhc0RhdGEgPyAnZm9udC13ZWlnaHQ6NjAwO2NvbG9yOndoaXRlOycgOiAnY29sb3I6Izk5OTsnO1xuICAgIGNvbnN0IHRvb2x0aXAgPSB2YWwgPiAwID8gYCR7dmFsfSR7dW5pdH1gIDogJyc7XG4gICAgY2VsbHMgKz0gZGF5Q2VsbChkYXksIGJnQ29sb3IsIGVudHJ5Py5maWxlUGF0aCwgdG9vbHRpcCwgdGV4dFN0eWxlKTtcbiAgfVxuXG4gIGxldCBodG1sID0gJyc7XG4gIGlmIChjb25maWcuc2hvd1RvdGFsKSB7XG4gICAgY29uc3QgbGFiZWwgPSBjb25maWcudG90YWxMYWJlbCA/PyAodW5pdCA/IGDtlanqs4RgIDogJ+2VqeqzhCcpO1xuICAgIGh0bWwgKz0gYDxkaXYgc3R5bGU9XCJtYXJnaW4tYm90dG9tOjZweDtmb250LXNpemU6MTJweDtjb2xvcjp2YXIoLS10ZXh0LW11dGVkKTtcIj4ke2xhYmVsfTogPHNwYW4gc3R5bGU9XCJmb250LXdlaWdodDo2MDA7Y29sb3I6dmFyKC0tdGV4dC1ub3JtYWwpO1wiPiR7dG90YWwudG9GaXhlZCgxKX0ke3VuaXR9PC9zcGFuPjwvZGl2PmA7XG4gIH1cbiAgaHRtbCArPSB3cmFwR3JpZChjZWxscyk7XG4gIHJldHVybiBodG1sO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gcmVuZGVyVHJhY2tlcihcbiAgY29uZmlnOiBUcmFja2VyQ29uZmlnLFxuICBkYXRhOiBNYXA8bnVtYmVyLCBEYXlEYXRhPixcbiAgZGF5c0luTW9udGg6IG51bWJlcixcbik6IEhUTUxFbGVtZW50IHtcbiAgY29uc3QgY29udGFpbmVyID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnZGl2Jyk7XG4gIGNvbnRhaW5lci5zdHlsZS5mb250RmFtaWx5ID0gXCItYXBwbGUtc3lzdGVtLCBCbGlua01hY1N5c3RlbUZvbnQsICdTZWdvZSBVSScsIHNhbnMtc2VyaWZcIjtcblxuICBsZXQgaW5uZXIgPSAnJztcbiAgaWYgKGNvbmZpZy50eXBlID09PSAnYm9vbGVhbicpIHtcbiAgICBpbm5lciA9IHJlbmRlckJvb2xlYW4oY29uZmlnLCBkYXRhLCBkYXlzSW5Nb250aCk7XG4gIH0gZWxzZSBpZiAoY29uZmlnLnR5cGUgPT09ICdjb2xvcm1hcCcpIHtcbiAgICBpbm5lciA9IHJlbmRlckNvbG9ybWFwKGNvbmZpZywgZGF0YSwgZGF5c0luTW9udGgpO1xuICB9IGVsc2UgaWYgKGNvbmZpZy50eXBlID09PSAnaGVhdG1hcCcpIHtcbiAgICBpbm5lciA9IHJlbmRlckhlYXRtYXAoY29uZmlnLCBkYXRhLCBkYXlzSW5Nb250aCk7XG4gIH1cblxuICBjb250YWluZXIuaW5uZXJIVE1MID0gaW5uZXI7XG4gIHJldHVybiBjb250YWluZXI7XG59XG4iLCJpbXBvcnQgeyBQbHVnaW4sIE1hcmtkb3duUG9zdFByb2Nlc3NvckNvbnRleHQsIFRGaWxlLCBwYXJzZVlhbWwgfSBmcm9tICdvYnNpZGlhbic7XG5pbXBvcnQgeyBQbHVnaW5TZXR0aW5ncywgREVGQVVMVF9TRVRUSU5HUywgVHJhY2tlckNvbmZpZyB9IGZyb20gJy4vdHlwZXMnO1xuaW1wb3J0IHsgTW9udGhseVRyYWNrZXJTZXR0aW5nVGFiIH0gZnJvbSAnLi9zZXR0aW5ncyc7XG5pbXBvcnQgeyByZW5kZXJUcmFja2VyLCBEYXlEYXRhIH0gZnJvbSAnLi9yZW5kZXJlcic7XG5cbmZ1bmN0aW9uIGJ1aWxkRGF0ZVBhdHRlcm4oZGF0ZUZvcm1hdDogc3RyaW5nLCB5ZWFyOiBudW1iZXIsIG1vbnRoOiBudW1iZXIpOiBSZWdFeHAge1xuICBjb25zdCBtbSA9IFN0cmluZyhtb250aCkucGFkU3RhcnQoMiwgJzAnKTtcbiAgY29uc3QgZXNjYXBlZCA9IGRhdGVGb3JtYXRcbiAgICAucmVwbGFjZSgnWVlZWScsICdcXHgwMFlcXHgwMCcpXG4gICAgLnJlcGxhY2UoJ01NJywgJ1xceDAwTVxceDAwJylcbiAgICAucmVwbGFjZSgnREQnLCAnXFx4MDBEXFx4MDAnKVxuICAgIC5yZXBsYWNlKC9bLiorP14ke30oKXxbXFxdXFxcXF0vZywgJ1xcXFwkJicpXG4gICAgLnJlcGxhY2UoJ1xceDAwWVxceDAwJywgU3RyaW5nKHllYXIpKVxuICAgIC5yZXBsYWNlKCdcXHgwME1cXHgwMCcsIG1tKVxuICAgIC5yZXBsYWNlKCdcXHgwMERcXHgwMCcsICcoXFxcXGR7Mn0pJyk7XG4gIHJldHVybiBuZXcgUmVnRXhwKGBeJHtlc2NhcGVkfWApO1xufVxuXG5mdW5jdGlvbiBkZXRlY3REYWlseU5vdGVzRm9sZGVyKGFwcDogYW55KTogc3RyaW5nIHtcbiAgY29uc3QgaW50ZXJuYWwgPSBhcHAuaW50ZXJuYWxQbHVnaW5zPy5wbHVnaW5zPy5bJ2RhaWx5LW5vdGVzJ10/Lmluc3RhbmNlPy5vcHRpb25zPy5mb2xkZXI7XG4gIGlmIChpbnRlcm5hbCkgcmV0dXJuIGludGVybmFsO1xuICBjb25zdCBwZXJpb2RpYyA9IGFwcC5wbHVnaW5zPy5wbHVnaW5zPy5bJ3BlcmlvZGljLW5vdGVzJ10/LnNldHRpbmdzPy5kYWlseT8uZm9sZGVyO1xuICBpZiAocGVyaW9kaWMpIHJldHVybiBwZXJpb2RpYztcbiAgcmV0dXJuICcnO1xufVxuXG5leHBvcnQgZGVmYXVsdCBjbGFzcyBNb250aGx5VHJhY2tlclBsdWdpbiBleHRlbmRzIFBsdWdpbiB7XG4gIHNldHRpbmdzITogUGx1Z2luU2V0dGluZ3M7XG5cbiAgYXN5bmMgb25sb2FkKCkge1xuICAgIGF3YWl0IHRoaXMubG9hZFNldHRpbmdzKCk7XG4gICAgdGhpcy5hZGRTZXR0aW5nVGFiKG5ldyBNb250aGx5VHJhY2tlclNldHRpbmdUYWIodGhpcy5hcHAsIHRoaXMpKTtcblxuICAgIHRoaXMucmVnaXN0ZXJNYXJrZG93bkNvZGVCbG9ja1Byb2Nlc3NvcihcbiAgICAgICdtb250aGx5LXRyYWNrZXInLFxuICAgICAgYXN5bmMgKHNvdXJjZSwgZWwsIGN0eCkgPT4ge1xuICAgICAgICB0cnkge1xuICAgICAgICAgIGF3YWl0IHRoaXMucHJvY2Vzc0Jsb2NrKHNvdXJjZSwgZWwsIGN0eCk7XG4gICAgICAgIH0gY2F0Y2ggKGVycikge1xuICAgICAgICAgIGVsLmNyZWF0ZUVsKCdwcmUnLCB7XG4gICAgICAgICAgICB0ZXh0OiBgTW9udGhseSBUcmFja2VyIEVycm9yOlxcbiR7ZXJyIGluc3RhbmNlb2YgRXJyb3IgPyBlcnIubWVzc2FnZSA6IFN0cmluZyhlcnIpfWAsXG4gICAgICAgICAgICBjbHM6ICdtb250aGx5LXRyYWNrZXItZXJyb3InLFxuICAgICAgICAgIH0pO1xuICAgICAgICB9XG4gICAgICB9LFxuICAgICk7XG4gIH1cblxuICBwcml2YXRlIGFzeW5jIHByb2Nlc3NCbG9jayhcbiAgICBzb3VyY2U6IHN0cmluZyxcbiAgICBlbDogSFRNTEVsZW1lbnQsXG4gICAgY3R4OiBNYXJrZG93blBvc3RQcm9jZXNzb3JDb250ZXh0LFxuICApOiBQcm9taXNlPHZvaWQ+IHtcbiAgICBjb25zdCBjb25maWcgPSBwYXJzZVlhbWwoc291cmNlLnRyaW0oKSkgYXMgVHJhY2tlckNvbmZpZztcbiAgICBpZiAoIWNvbmZpZz8udHlwZSkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKCdNaXNzaW5nIHJlcXVpcmVkIGZpZWxkOiB0eXBlIChib29sZWFuIHwgY29sb3JtYXAgfCBoZWF0bWFwKScpO1xuICAgIH1cbiAgICBpZiAoIWNvbmZpZy5wcm9wZXJ0eSAmJiBjb25maWcudHlwZSAhPT0gJ2Jvb2xlYW4nKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoJ01pc3NpbmcgcmVxdWlyZWQgZmllbGQ6IHByb3BlcnR5Jyk7XG4gICAgfVxuXG4gICAgLy8gUmVhZCB5ZWFyL21vbnRoIGZyb20gdGhlIGN1cnJlbnQgbm90ZSdzIGZyb250bWF0dGVyXG4gICAgY29uc3QgY3VycmVudEZpbGUgPSB0aGlzLmFwcC52YXVsdC5nZXRBYnN0cmFjdEZpbGVCeVBhdGgoY3R4LnNvdXJjZVBhdGgpO1xuICAgIGlmICghKGN1cnJlbnRGaWxlIGluc3RhbmNlb2YgVEZpbGUpKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoJ0Nhbm5vdCByZXNvbHZlIGN1cnJlbnQgZmlsZScpO1xuICAgIH1cbiAgICBjb25zdCBmbSA9IHRoaXMuYXBwLm1ldGFkYXRhQ2FjaGUuZ2V0RmlsZUNhY2hlKGN1cnJlbnRGaWxlKT8uZnJvbnRtYXR0ZXI7XG4gICAgY29uc3QgeWVhcjogbnVtYmVyID0gZm0/LnllYXI7XG4gICAgY29uc3QgbW9udGg6IG51bWJlciA9IGZtPy5tb250aDtcbiAgICBpZiAoIXllYXIgfHwgIW1vbnRoKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoXCJDdXJyZW50IG5vdGUgbXVzdCBoYXZlICd5ZWFyJyBhbmQgJ21vbnRoJyBpbiBmcm9udG1hdHRlclwiKTtcbiAgICB9XG5cbiAgICBjb25zdCBkYXlzSW5Nb250aCA9IG5ldyBEYXRlKHllYXIsIG1vbnRoLCAwKS5nZXREYXRlKCk7XG4gICAgY29uc3QgZm9sZGVyID0gY29uZmlnLnNvdXJjZSA/PyAodGhpcy5zZXR0aW5ncy5kYWlseU5vdGVzRm9sZGVyIHx8IGRldGVjdERhaWx5Tm90ZXNGb2xkZXIodGhpcy5hcHApKTtcbiAgICBjb25zdCBwYXR0ZXJuID0gYnVpbGREYXRlUGF0dGVybih0aGlzLnNldHRpbmdzLmRhdGVGb3JtYXQsIHllYXIsIE51bWJlcihtb250aCkpO1xuXG4gICAgLy8gU2NhbiB2YXVsdCBmb2xkZXIgZm9yIG1hdGNoaW5nIGRhaWx5IG5vdGVzXG4gICAgY29uc3QgZGF0YSA9IG5ldyBNYXA8bnVtYmVyLCBEYXlEYXRhPigpO1xuICAgIGNvbnN0IGFic3RyYWN0Rm9sZGVyID0gdGhpcy5hcHAudmF1bHQuZ2V0QWJzdHJhY3RGaWxlQnlQYXRoKGZvbGRlcik7XG5cbiAgICBpZiAoYWJzdHJhY3RGb2xkZXIpIHtcbiAgICAgIC8vIEB0cy1pZ25vcmUg4oCUIFRGb2xkZXIgaGFzIGNoaWxkcmVuXG4gICAgICBjb25zdCBjaGlsZHJlbjogdW5rbm93bltdID0gYWJzdHJhY3RGb2xkZXIuY2hpbGRyZW4gPz8gW107XG4gICAgICBmb3IgKGNvbnN0IGNoaWxkIG9mIGNoaWxkcmVuKSB7XG4gICAgICAgIGlmICghKGNoaWxkIGluc3RhbmNlb2YgVEZpbGUpKSBjb250aW51ZTtcbiAgICAgICAgY29uc3QgbWF0Y2ggPSBjaGlsZC5uYW1lLm1hdGNoKHBhdHRlcm4pO1xuICAgICAgICBpZiAoIW1hdGNoKSBjb250aW51ZTtcbiAgICAgICAgY29uc3QgZGF5ID0gcGFyc2VJbnQobWF0Y2hbMV0pO1xuXG4gICAgICAgIGNvbnN0IGNoaWxkRm0gPSB0aGlzLmFwcC5tZXRhZGF0YUNhY2hlLmdldEZpbGVDYWNoZShjaGlsZCk/LmZyb250bWF0dGVyO1xuICAgICAgICBsZXQgdmFsdWU6IHVua25vd24gPSB1bmRlZmluZWQ7XG5cbiAgICAgICAgaWYgKGNvbmZpZy5wcm9wZXJ0eSA9PT0gbnVsbCB8fCBjb25maWcucHJvcGVydHkgPT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgIC8vIEZpbGUtZXhpc3RlbmNlIG1vZGUgKGUuZy4gTW9ybmluZyBKb3VybmFsIGZvbGRlcilcbiAgICAgICAgICB2YWx1ZSA9IHRydWU7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgdmFsdWUgPSBjaGlsZEZtPy5bY29uZmlnLnByb3BlcnR5XTtcbiAgICAgICAgfVxuXG4gICAgICAgIGRhdGEuc2V0KGRheSwgeyBkYXksIHZhbHVlLCBmaWxlUGF0aDogY2hpbGQucGF0aCB9KTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICBjb25zdCByZW5kZXJlZCA9IHJlbmRlclRyYWNrZXIoY29uZmlnLCBkYXRhLCBkYXlzSW5Nb250aCk7XG4gICAgZWwuYXBwZW5kQ2hpbGQocmVuZGVyZWQpO1xuICB9XG5cbiAgYXN5bmMgbG9hZFNldHRpbmdzKCkge1xuICAgIHRoaXMuc2V0dGluZ3MgPSBPYmplY3QuYXNzaWduKHt9LCBERUZBVUxUX1NFVFRJTkdTLCBhd2FpdCB0aGlzLmxvYWREYXRhKCkpO1xuICB9XG5cbiAgYXN5bmMgc2F2ZVNldHRpbmdzKCkge1xuICAgIGF3YWl0IHRoaXMuc2F2ZURhdGEodGhpcy5zZXR0aW5ncyk7XG4gIH1cbn1cbiJdLCJuYW1lcyI6WyJQbHVnaW5TZXR0aW5nVGFiIiwiU2V0dGluZyIsIlBsdWdpbiIsInBhcnNlWWFtbCIsIlRGaWxlIl0sIm1hcHBpbmdzIjoiOzs7O0FBNENPLE1BQU0sZ0JBQWdCLEdBQW1CO0FBQzlDLElBQUEsZ0JBQWdCLEVBQUUsRUFBRTtBQUNwQixJQUFBLFVBQVUsRUFB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
