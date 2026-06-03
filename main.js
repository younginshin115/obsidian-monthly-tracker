'use strict';

var obsidian = require('obsidian');

const DEFAULT_SETTINGS = {
    dailyNotesFolder: '',
    dateFormat: 'YYYY-MM-DD',
};

const en = {
    errorPrefix: 'Monthly Tracker Error',
    errMissingType: 'Missing required field: type (boolean | colormap | heatmap)',
    errMissingProperty: 'Missing required field: property',
    errMissingColors: 'Missing required field: colors (e.g. colors: {value: "#hex"})',
    errCannotResolveFile: 'Cannot resolve current file',
    errMissingYearMonth: "Current note must have 'year' and 'month' in frontmatter",
    errYearMonthType: "'year' and 'month' must be numbers in frontmatter",
    errInvalidMonth: (month) => `Invalid month: ${month} (must be 1–12)`,
    errHeatmapBins: 'heatmap requires "bins" (e.g. bins: [3, 5, 7, 10])',
    errBinsPositive: (value) => `bins values must be positive (got ${value})`,
    errBinsAscending: (prev, next) => `bins must be in ascending order (got ${prev}, ${next})`,
    tooltipYes: 'Yes',
    totalLabel: 'Total',
    settingsFolderName: 'Daily notes folder',
    settingsFolderDesc: 'Folder containing daily notes (e.g. Calendar/Days)',
    settingsDateFormatName: 'Date format',
    settingsDateFormatDesc: 'File name date format. Must match YYYY-MM-DD at the start of file names.',
};
const ko = {
    errorPrefix: 'Monthly Tracker 오류',
    errMissingType: '필수 항목 누락: type (boolean | colormap | heatmap)',
    errMissingProperty: '필수 항목 누락: property',
    errMissingColors: '필수 항목 누락: colors (예: colors: {value: "#hex"})',
    errCannotResolveFile: '현재 파일을 찾을 수 없습니다',
    errMissingYearMonth: "현재 노트의 프론트매터에 'year'와 'month'가 있어야 합니다",
    errYearMonthType: "프론트매터의 'year'와 'month'는 숫자여야 합니다",
    errInvalidMonth: (month) => `잘못된 month: ${month} (1–12 사이여야 합니다)`,
    errHeatmapBins: 'heatmap에는 "bins"가 필요합니다 (예: bins: [3, 5, 7, 10])',
    errBinsPositive: (value) => `bins 값은 양수여야 합니다 (입력값: ${value})`,
    errBinsAscending: (prev, next) => `bins는 오름차순이어야 합니다 (입력값: ${prev}, ${next})`,
    tooltipYes: '완료',
    totalLabel: '합계',
    settingsFolderName: '데일리 노트 폴더',
    settingsFolderDesc: '데일리 노트가 들어 있는 폴더 (예: Calendar/Days)',
    settingsDateFormatName: '날짜 형식',
    settingsDateFormatDesc: '파일 이름의 날짜 형식. 파일 이름 앞부분이 YYYY-MM-DD와 일치해야 합니다.',
};
function currentLocale() {
    return obsidian.getLanguage() === 'ko' ? 'ko' : 'en';
}
/** Returns the message table for the current Obsidian UI language. */
function t() {
    return currentLocale() === 'ko' ? ko : en;
}

class MonthlyTrackerSettingTab extends obsidian.PluginSettingTab {
    constructor(app, plugin) {
        super(app, plugin);
        this.plugin = plugin;
    }
    display() {
        const { containerEl } = this;
        const m = t();
        containerEl.empty();
        new obsidian.Setting(containerEl)
            .setName(m.settingsFolderName)
            .setDesc(m.settingsFolderDesc)
            .addText(text => text
            // eslint-disable-next-line obsidianmd/ui/sentence-case -- folder path example, not prose
            .setPlaceholder('Calendar/Days')
            .setValue(this.plugin.settings.dailyNotesFolder)
            .onChange(async (value) => {
            this.plugin.settings.dailyNotesFolder = value.trim();
            await this.plugin.saveSettings();
        }));
        new obsidian.Setting(containerEl)
            .setName(m.settingsDateFormatName)
            .setDesc(m.settingsDateFormatDesc)
            .addText(text => text
            // eslint-disable-next-line obsidianmd/ui/sentence-case -- date-format token, must stay uppercase
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
    if (!color)
        return COLOR_PRESETS.blue;
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

/**
 * Build a single day cell.
 * @param bgColor inline background color for active cells; null lets the theme
 *   (`.is-empty`) style empty cells so dark mode is respected.
 */
function dayCell(day, bgColor, active, filePath, tooltip) {
    const el = filePath
        ? activeDocument.createElement('a')
        : activeDocument.createElement('div');
    el.classList.add('monthly-tracker-cell', active ? 'is-active' : 'is-empty');
    if (bgColor)
        el.style.backgroundColor = bgColor;
    if (filePath) {
        const anchor = el;
        anchor.classList.add('internal-link');
        anchor.setAttribute('href', filePath);
        anchor.dataset.href = filePath;
    }
    if (tooltip)
        obsidian.setTooltip(el, tooltip);
    el.textContent = String(day);
    return el;
}
function wrapGrid(cells) {
    const row = activeDocument.createElement('div');
    row.classList.add('monthly-tracker-row');
    for (const cell of cells)
        row.appendChild(cell);
    return row;
}
function renderBoolean(config, data, daysInMonth) {
    const activeColor = resolveColor(config.color);
    const cells = [];
    for (let day = 1; day <= daysInMonth; day++) {
        const entry = data.get(day);
        const active = entry !== undefined && !!entry.value;
        cells.push(dayCell(day, active ? activeColor : null, active, entry === null || entry === void 0 ? void 0 : entry.filePath, active ? t().tooltipYes : ''));
    }
    return wrapGrid(cells);
}
function renderColormap(config, data, daysInMonth) {
    const colorMap = config.colors;
    const cells = [];
    for (let day = 1; day <= daysInMonth; day++) {
        const entry = data.get(day);
        const raw = entry === null || entry === void 0 ? void 0 : entry.value;
        // Only scalar frontmatter values map to a color key; objects/arrays are ignored.
        const key = typeof raw === 'string' || typeof raw === 'number' || typeof raw === 'boolean'
            ? String(raw)
            : undefined;
        const mappedColor = key != null ? colorMap[key] : undefined;
        cells.push(dayCell(day, mappedColor !== null && mappedColor !== void 0 ? mappedColor : null, !!mappedColor, entry === null || entry === void 0 ? void 0 : entry.filePath, key !== null && key !== void 0 ? key : ''));
    }
    return wrapGrid(cells);
}
function renderHeatmap(config, data, daysInMonth) {
    var _a, _b, _c;
    const colors = resolveHeatmapColors(config.colors, config.colorScheme);
    // bins are validated upstream in processBlock; non-null assertion is safe here.
    const bins = config.bins;
    const unit = (_a = config.unit) !== null && _a !== void 0 ? _a : '';
    function getIntensity(val) {
        if (val <= 0)
            return 0;
        for (let i = 0; i < bins.length; i++) {
            if (val < bins[i])
                return i + 1;
        }
        return bins.length + 1;
    }
    const maxIntensity = bins.length + 1;
    const fillColor = (_b = colors[colors.length - 1]) !== null && _b !== void 0 ? _b : '';
    const padding = new Array(Math.max(0, maxIntensity + 1 - colors.length)).fill(fillColor);
    const safeColors = colors.length >= maxIntensity + 1 ? colors : [...colors, ...padding];
    let total = 0;
    const cells = [];
    for (let day = 1; day <= daysInMonth; day++) {
        const entry = data.get(day);
        const raw = entry === null || entry === void 0 ? void 0 : entry.value;
        const val = typeof raw === 'number' && isFinite(raw) ? raw : 0;
        total += val;
        const intensity = getIntensity(val);
        const active = intensity > 0;
        const bgColor = active ? (safeColors[intensity] || null) : null;
        cells.push(dayCell(day, bgColor, active, entry === null || entry === void 0 ? void 0 : entry.filePath, val > 0 ? `${val}${unit}` : ''));
    }
    const container = activeDocument.createElement('div');
    if (config.showTotal) {
        const label = (_c = config.totalLabel) !== null && _c !== void 0 ? _c : t().totalLabel;
        const summary = activeDocument.createElement('div');
        summary.classList.add('monthly-tracker-summary');
        summary.textContent = `${label}: `;
        const value = activeDocument.createElement('span');
        value.classList.add('monthly-tracker-summary-value');
        const displayTotal = Number.isInteger(total) ? String(total) : total.toFixed(1);
        value.textContent = `${displayTotal}${unit}`;
        summary.appendChild(value);
        container.appendChild(summary);
    }
    container.appendChild(wrapGrid(cells));
    return container;
}
function renderTracker(config, data, daysInMonth) {
    const container = activeDocument.createElement('div');
    container.classList.add('monthly-tracker');
    let inner = null;
    if (config.type === 'boolean') {
        inner = renderBoolean(config, data, daysInMonth);
    }
    else if (config.type === 'colormap') {
        inner = renderColormap(config, data, daysInMonth);
    }
    else if (config.type === 'heatmap') {
        inner = renderHeatmap(config, data, daysInMonth);
    }
    if (inner)
        container.appendChild(inner);
    return container;
}

/**
 * Build a regex that matches daily-note filenames for a given year/month.
 *
 * The `dateFormat` uses `YYYY`/`MM`/`DD` tokens. `YYYY` and `MM` are filled in
 * with the concrete year/month, while `DD` becomes a captured `(\d{2})` group so
 * callers can read the day back out. Any other characters in the format are
 * treated literally and regex-escaped.
 */
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

/**
 * Best-effort detection of the daily-notes folder from the core Daily notes
 * plugin, falling back to the community Periodic Notes plugin. Returns `''`
 * when neither is configured.
 */
function detectDailyNotesFolder(app) {
    var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k;
    const a = app;
    const internal = (_e = (_d = (_c = (_b = (_a = a.internalPlugins) === null || _a === void 0 ? void 0 : _a.plugins) === null || _b === void 0 ? void 0 : _b['daily-notes']) === null || _c === void 0 ? void 0 : _c.instance) === null || _d === void 0 ? void 0 : _d.options) === null || _e === void 0 ? void 0 : _e.folder;
    if (internal)
        return internal;
    const periodic = (_k = (_j = (_h = (_g = (_f = a.plugins) === null || _f === void 0 ? void 0 : _f.plugins) === null || _g === void 0 ? void 0 : _g['periodic-notes']) === null || _h === void 0 ? void 0 : _h.settings) === null || _j === void 0 ? void 0 : _j.daily) === null || _k === void 0 ? void 0 : _k.folder;
    if (periodic)
        return periodic;
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
function resolveDailyNotesFolder(source, settingsFolder, detectedFolder) {
    const resolved = source !== null && source !== void 0 ? source : (settingsFolder || detectedFolder);
    return resolved ? obsidian.normalizePath(resolved) : '';
}

/** Validate config-level invariants up front so renderers can assume valid input. */
function validateConfig(config) {
    const m = t();
    if (!(config === null || config === void 0 ? void 0 : config.type)) {
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
                    text: `${t().errorPrefix}:\n${err instanceof Error ? err.message : String(err)}`,
                    cls: 'monthly-tracker-error',
                });
            }
        });
    }
    async processBlock(source, el, ctx) {
        var _a, _b;
        const config = obsidian.parseYaml(source.trim());
        validateConfig(config);
        // Read year/month from the current note's frontmatter
        const currentFile = this.app.vault.getAbstractFileByPath(ctx.sourcePath);
        if (!(currentFile instanceof obsidian.TFile)) {
            throw new Error(t().errCannotResolveFile);
        }
        const fm = (_a = this.app.metadataCache.getFileCache(currentFile)) === null || _a === void 0 ? void 0 : _a.frontmatter;
        const year = fm === null || fm === void 0 ? void 0 : fm.year;
        const month = fm === null || fm === void 0 ? void 0 : fm.month;
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
        const folder = resolveDailyNotesFolder(config.source, this.settings.dailyNotesFolder, detectDailyNotesFolder(this.app));
        const pattern = buildDatePattern(this.settings.dateFormat, year, month);
        // Scan vault folder for matching daily notes
        const data = new Map();
        const abstractFolder = this.app.vault.getAbstractFileByPath(folder);
        if (abstractFolder instanceof obsidian.TFolder) {
            for (const child of abstractFolder.children) {
                if (!(child instanceof obsidian.TFile))
                    continue;
                const match = child.name.match(pattern);
                if (!match)
                    continue;
                const day = parseInt(match[1], 10);
                const childFm = (_b = this.app.metadataCache.getFileCache(child)) === null || _b === void 0 ? void 0 : _b.frontmatter;
                // File-existence mode (property omitted) marks every matching note as true.
                const value = config.property == null ? true : childFm === null || childFm === void 0 ? void 0 : childFm[config.property];
                data.set(day, { day, value, filePath: child.path });
            }
        }
        const rendered = renderTracker(config, data, daysInMonth);
        // Delegate internal-link clicks to Obsidian so day cells open the note.
        this.registerDomEvent(rendered, 'click', (evt) => {
            const link = evt.target.closest('a.internal-link');
            const path = link === null || link === void 0 ? void 0 : link.getAttribute('data-href');
            if (!path)
                return;
            evt.preventDefault();
            void this.app.workspace.openLinkText(path, ctx.sourcePath, evt.ctrlKey || evt.metaKey);
        });
        // Trigger Obsidian's page-preview on hover (data-href alone doesn't enable it).
        this.registerDomEvent(rendered, 'mouseover', (evt) => {
            const link = evt.target.closest('a.internal-link');
            const path = link === null || link === void 0 ? void 0 : link.getAttribute('data-href');
            if (!path)
                return;
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
        const data = (await this.loadData());
        this.settings = Object.assign({}, DEFAULT_SETTINGS, data);
    }
    async saveSettings() {
        await this.saveData(this.settings);
    }
}

module.exports = MonthlyTrackerPlugin;
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWFpbi5qcyIsInNvdXJjZXMiOlsic3JjL3R5cGVzLnRzIiwic3JjL2kxOG4udHMiLCJzcmMvc2V0dGluZ3MudHMiLCJzcmMvcHJlc2V0cy50cyIsInNyYy9yZW5kZXJlci50cyIsInNyYy9kYXRlLXBhdHRlcm4udHMiLCJzcmMvZm9sZGVyLnRzIiwic3JjL3ZhbGlkYXRlLnRzIiwic3JjL21haW4udHMiXSwic291cmNlc0NvbnRlbnQiOlsiZXhwb3J0IGludGVyZmFjZSBCb29sZWFuQ29uZmlnIHtcbiAgdHlwZTogJ2Jvb2xlYW4nO1xuICB0aXRsZT86IHN0cmluZztcbiAgcHJvcGVydHk/OiBzdHJpbmc7XG4gIHNvdXJjZT86IHN0cmluZztcbiAgLyoqIGhleCBjb2xvciBzdHJpbmcgb3IgcHJlc2V0IG5hbWUgKGUuZy4gXCJibHVlXCIpICovXG4gIGNvbG9yOiBzdHJpbmc7XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgQ29sb3JtYXBDb25maWcge1xuICB0eXBlOiAnY29sb3JtYXAnO1xuICB0aXRsZT86IHN0cmluZztcbiAgcHJvcGVydHk6IHN0cmluZztcbiAgc291cmNlPzogc3RyaW5nO1xuICBjb2xvcnM6IFJlY29yZDxzdHJpbmcsIHN0cmluZz47XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgSGVhdG1hcENvbmZpZyB7XG4gIHR5cGU6ICdoZWF0bWFwJztcbiAgdGl0bGU/OiBzdHJpbmc7XG4gIHByb3BlcnR5OiBzdHJpbmc7XG4gIHNvdXJjZT86IHN0cmluZztcbiAgdW5pdD86IHN0cmluZztcbiAgLyoqXG4gICAqIFRocmVzaG9sZHMgc2VwYXJhdGluZyBpbnRlbnNpdHkgbGV2ZWxzLlxuICAgKiBlLmcuIFszLCA1LCA3LCAxMF0g4oaSIDUgYnVja2V0czogWzAsMyksIFszLDUpLCBbNSw3KSwgWzcsMTApLCBbMTAs4oieKVxuICAgKi9cbiAgYmlucz86IG51bWJlcltdO1xuICAvKiogYXJyYXkgb2YgaGV4IGNvbG9ycywgbGVuZ3RoID0gYmlucy5sZW5ndGggKyAxLCBvciBvbWl0IGFuZCB1c2UgY29sb3JTY2hlbWUgKi9cbiAgY29sb3JzPzogc3RyaW5nW107XG4gIC8qKiBidWlsdC1pbiBoZWF0bWFwIGNvbG9yIHNjaGVtZSBuYW1lIChlLmcuIFwiaW5kaWdvXCIpICovXG4gIGNvbG9yU2NoZW1lPzogc3RyaW5nO1xuICBzaG93VG90YWw/OiBib29sZWFuO1xuICAvKiogbGFiZWwgc2hvd24gbmV4dCB0byB0b3RhbCwgZGVmYXVsdHMgdG8gcHJvcGVydHkgbmFtZSAqL1xuICB0b3RhbExhYmVsPzogc3RyaW5nO1xufVxuXG5leHBvcnQgdHlwZSBUcmFja2VyQ29uZmlnID0gQm9vbGVhbkNvbmZpZyB8IENvbG9ybWFwQ29uZmlnIHwgSGVhdG1hcENvbmZpZztcblxuZXhwb3J0IGludGVyZmFjZSBQbHVnaW5TZXR0aW5ncyB7XG4gIGRhaWx5Tm90ZXNGb2xkZXI6IHN0cmluZztcbiAgZGF0ZUZvcm1hdDogc3RyaW5nO1xufVxuXG5leHBvcnQgY29uc3QgREVGQVVMVF9TRVRUSU5HUzogUGx1Z2luU2V0dGluZ3MgPSB7XG4gIGRhaWx5Tm90ZXNGb2xkZXI6ICcnLFxuICBkYXRlRm9ybWF0OiAnWVlZWS1NTS1ERCcsXG59O1xuIiwiaW1wb3J0IHsgZ2V0TGFuZ3VhZ2UgfSBmcm9tICdvYnNpZGlhbic7XG5cbnR5cGUgTG9jYWxlID0gJ2VuJyB8ICdrbyc7XG5cbmV4cG9ydCBpbnRlcmZhY2UgTWVzc2FnZXMge1xuICBlcnJvclByZWZpeDogc3RyaW5nO1xuICBlcnJNaXNzaW5nVHlwZTogc3RyaW5nO1xuICBlcnJNaXNzaW5nUHJvcGVydHk6IHN0cmluZztcbiAgZXJyTWlzc2luZ0NvbG9yczogc3RyaW5nO1xuICBlcnJDYW5ub3RSZXNvbHZlRmlsZTogc3RyaW5nO1xuICBlcnJNaXNzaW5nWWVhck1vbnRoOiBzdHJpbmc7XG4gIGVyclllYXJNb250aFR5cGU6IHN0cmluZztcbiAgZXJySW52YWxpZE1vbnRoOiAobW9udGg6IG51bWJlcikgPT4gc3RyaW5nO1xuICBlcnJIZWF0bWFwQmluczogc3RyaW5nO1xuICBlcnJCaW5zUG9zaXRpdmU6ICh2YWx1ZTogbnVtYmVyKSA9PiBzdHJpbmc7XG4gIGVyckJpbnNBc2NlbmRpbmc6IChwcmV2OiBudW1iZXIsIG5leHQ6IG51bWJlcikgPT4gc3RyaW5nO1xuICB0b29sdGlwWWVzOiBzdHJpbmc7XG4gIHRvdGFsTGFiZWw6IHN0cmluZztcbiAgc2V0dGluZ3NGb2xkZXJOYW1lOiBzdHJpbmc7XG4gIHNldHRpbmdzRm9sZGVyRGVzYzogc3RyaW5nO1xuICBzZXR0aW5nc0RhdGVGb3JtYXROYW1lOiBzdHJpbmc7XG4gIHNldHRpbmdzRGF0ZUZvcm1hdERlc2M6IHN0cmluZztcbn1cblxuY29uc3QgZW46IE1lc3NhZ2VzID0ge1xuICBlcnJvclByZWZpeDogJ01vbnRobHkgVHJhY2tlciBFcnJvcicsXG4gIGVyck1pc3NpbmdUeXBlOiAnTWlzc2luZyByZXF1aXJlZCBmaWVsZDogdHlwZSAoYm9vbGVhbiB8IGNvbG9ybWFwIHwgaGVhdG1hcCknLFxuICBlcnJNaXNzaW5nUHJvcGVydHk6ICdNaXNzaW5nIHJlcXVpcmVkIGZpZWxkOiBwcm9wZXJ0eScsXG4gIGVyck1pc3NpbmdDb2xvcnM6ICdNaXNzaW5nIHJlcXVpcmVkIGZpZWxkOiBjb2xvcnMgKGUuZy4gY29sb3JzOiB7dmFsdWU6IFwiI2hleFwifSknLFxuICBlcnJDYW5ub3RSZXNvbHZlRmlsZTogJ0Nhbm5vdCByZXNvbHZlIGN1cnJlbnQgZmlsZScsXG4gIGVyck1pc3NpbmdZZWFyTW9udGg6IFwiQ3VycmVudCBub3RlIG11c3QgaGF2ZSAneWVhcicgYW5kICdtb250aCcgaW4gZnJvbnRtYXR0ZXJcIixcbiAgZXJyWWVhck1vbnRoVHlwZTogXCIneWVhcicgYW5kICdtb250aCcgbXVzdCBiZSBudW1iZXJzIGluIGZyb250bWF0dGVyXCIsXG4gIGVyckludmFsaWRNb250aDogKG1vbnRoKSA9PiBgSW52YWxpZCBtb250aDogJHttb250aH0gKG11c3QgYmUgMeKAkzEyKWAsXG4gIGVyckhlYXRtYXBCaW5zOiAnaGVhdG1hcCByZXF1aXJlcyBcImJpbnNcIiAoZS5nLiBiaW5zOiBbMywgNSwgNywgMTBdKScsXG4gIGVyckJpbnNQb3NpdGl2ZTogKHZhbHVlKSA9PiBgYmlucyB2YWx1ZXMgbXVzdCBiZSBwb3NpdGl2ZSAoZ290ICR7dmFsdWV9KWAsXG4gIGVyckJpbnNBc2NlbmRpbmc6IChwcmV2LCBuZXh0KSA9PiBgYmlucyBtdXN0IGJlIGluIGFzY2VuZGluZyBvcmRlciAoZ290ICR7cHJldn0sICR7bmV4dH0pYCxcbiAgdG9vbHRpcFllczogJ1llcycsXG4gIHRvdGFsTGFiZWw6ICdUb3RhbCcsXG4gIHNldHRpbmdzRm9sZGVyTmFtZTogJ0RhaWx5IG5vdGVzIGZvbGRlcicsXG4gIHNldHRpbmdzRm9sZGVyRGVzYzogJ0ZvbGRlciBjb250YWluaW5nIGRhaWx5IG5vdGVzIChlLmcuIENhbGVuZGFyL0RheXMpJyxcbiAgc2V0dGluZ3NEYXRlRm9ybWF0TmFtZTogJ0RhdGUgZm9ybWF0JyxcbiAgc2V0dGluZ3NEYXRlRm9ybWF0RGVzYzogJ0ZpbGUgbmFtZSBkYXRlIGZvcm1hdC4gTXVzdCBtYXRjaCBZWVlZLU1NLUREIGF0IHRoZSBzdGFydCBvZiBmaWxlIG5hbWVzLicsXG59O1xuXG5jb25zdCBrbzogTWVzc2FnZXMgPSB7XG4gIGVycm9yUHJlZml4OiAnTW9udGhseSBUcmFja2VyIOyYpOulmCcsXG4gIGVyck1pc3NpbmdUeXBlOiAn7ZWE7IiYIO2VreuqqSDriITrnb06IHR5cGUgKGJvb2xlYW4gfCBjb2xvcm1hcCB8IGhlYXRtYXApJyxcbiAgZXJyTWlzc2luZ1Byb3BlcnR5OiAn7ZWE7IiYIO2VreuqqSDriITrnb06IHByb3BlcnR5JyxcbiAgZXJyTWlzc2luZ0NvbG9yczogJ+2VhOyImCDtla3rqqkg64iE6529OiBjb2xvcnMgKOyYiDogY29sb3JzOiB7dmFsdWU6IFwiI2hleFwifSknLFxuICBlcnJDYW5ub3RSZXNvbHZlRmlsZTogJ+2YhOyerCDtjIzsnbzsnYQg7LC+7J2EIOyImCDsl4bsirXri4jri6QnLFxuICBlcnJNaXNzaW5nWWVhck1vbnRoOiBcIu2YhOyerCDrhbjtirjsnZgg7ZSE66Gg7Yq466ek7YSw7JeQICd5ZWFyJ+yZgCAnbW9udGgn6rCAIOyeiOyWtOyVvCDtlanri4jri6RcIixcbiAgZXJyWWVhck1vbnRoVHlwZTogXCLtlITroaDtirjrp6TthLDsnZggJ3llYXIn7JmAICdtb250aCfripQg7Iir7J6Q7Jes7JW8IO2VqeuLiOuLpFwiLFxuICBlcnJJbnZhbGlkTW9udGg6IChtb250aCkgPT4gYOyemOuqu+uQnCBtb250aDogJHttb250aH0gKDHigJMxMiDsgqzsnbTsl6zslbwg7ZWp64uI64ukKWAsXG4gIGVyckhlYXRtYXBCaW5zOiAnaGVhdG1hcOyXkOuKlCBcImJpbnNcIuqwgCDtlYTsmpTtlanri4jri6QgKOyYiDogYmluczogWzMsIDUsIDcsIDEwXSknLFxuICBlcnJCaW5zUG9zaXRpdmU6ICh2YWx1ZSkgPT4gYGJpbnMg6rCS7J2AIOyWkeyImOyXrOyVvCDtlanri4jri6QgKOyeheugpeqwkjogJHt2YWx1ZX0pYCxcbiAgZXJyQmluc0FzY2VuZGluZzogKHByZXYsIG5leHQpID0+IGBiaW5z64qUIOyYpOumhOywqOyInOydtOyWtOyVvCDtlanri4jri6QgKOyeheugpeqwkjogJHtwcmV2fSwgJHtuZXh0fSlgLFxuICB0b29sdGlwWWVzOiAn7JmE66OMJyxcbiAgdG90YWxMYWJlbDogJ+2VqeqzhCcsXG4gIHNldHRpbmdzRm9sZGVyTmFtZTogJ+uNsOydvOumrCDrhbjtirgg7Y+0642UJyxcbiAgc2V0dGluZ3NGb2xkZXJEZXNjOiAn642w7J2866asIOuFuO2KuOqwgCDrk6TslrQg7J6I64qUIO2PtOuNlCAo7JiIOiBDYWxlbmRhci9EYXlzKScsXG4gIHNldHRpbmdzRGF0ZUZvcm1hdE5hbWU6ICfrgqDsp5wg7ZiV7IudJyxcbiAgc2V0dGluZ3NEYXRlRm9ybWF0RGVzYzogJ+2MjOydvCDsnbTrpoTsnZgg64Kg7KecIO2YleyLnS4g7YyM7J28IOydtOumhCDslZ7rtoDrtoTsnbQgWVlZWS1NTS1EROyZgCDsnbzsuZjtlbTslbwg7ZWp64uI64ukLicsXG59O1xuXG5mdW5jdGlvbiBjdXJyZW50TG9jYWxlKCk6IExvY2FsZSB7XG4gIHJldHVybiBnZXRMYW5ndWFnZSgpID09PSAna28nID8gJ2tvJyA6ICdlbic7XG59XG5cbi8qKiBSZXR1cm5zIHRoZSBtZXNzYWdlIHRhYmxlIGZvciB0aGUgY3VycmVudCBPYnNpZGlhbiBVSSBsYW5ndWFnZS4gKi9cbmV4cG9ydCBmdW5jdGlvbiB0KCk6IE1lc3NhZ2VzIHtcbiAgcmV0dXJuIGN1cnJlbnRMb2NhbGUoKSA9PT0gJ2tvJyA/IGtvIDogZW47XG59XG4iLCJpbXBvcnQgeyBBcHAsIFBsdWdpblNldHRpbmdUYWIsIFNldHRpbmcgfSBmcm9tICdvYnNpZGlhbic7XG5pbXBvcnQgdHlwZSBNb250aGx5VHJhY2tlclBsdWdpbiBmcm9tICcuL21haW4nO1xuaW1wb3J0IHsgdCB9IGZyb20gJy4vaTE4bic7XG5cbmV4cG9ydCBjbGFzcyBNb250aGx5VHJhY2tlclNldHRpbmdUYWIgZXh0ZW5kcyBQbHVnaW5TZXR0aW5nVGFiIHtcbiAgcGx1Z2luOiBNb250aGx5VHJhY2tlclBsdWdpbjtcblxuICBjb25zdHJ1Y3RvcihhcHA6IEFwcCwgcGx1Z2luOiBNb250aGx5VHJhY2tlclBsdWdpbikge1xuICAgIHN1cGVyKGFwcCwgcGx1Z2luKTtcbiAgICB0aGlzLnBsdWdpbiA9IHBsdWdpbjtcbiAgfVxuXG4gIGRpc3BsYXkoKTogdm9pZCB7XG4gICAgY29uc3QgeyBjb250YWluZXJFbCB9ID0gdGhpcztcbiAgICBjb25zdCBtID0gdCgpO1xuICAgIGNvbnRhaW5lckVsLmVtcHR5KCk7XG5cbiAgICBuZXcgU2V0dGluZyhjb250YWluZXJFbClcbiAgICAgIC5zZXROYW1lKG0uc2V0dGluZ3NGb2xkZXJOYW1lKVxuICAgICAgLnNldERlc2MobS5zZXR0aW5nc0ZvbGRlckRlc2MpXG4gICAgICAuYWRkVGV4dCh0ZXh0ID0+XG4gICAgICAgIHRleHRcbiAgICAgICAgICAvLyBlc2xpbnQtZGlzYWJsZS1uZXh0LWxpbmUgb2JzaWRpYW5tZC91aS9zZW50ZW5jZS1jYXNlIC0tIGZvbGRlciBwYXRoIGV4YW1wbGUsIG5vdCBwcm9zZVxuICAgICAgICAgIC5zZXRQbGFjZWhvbGRlcignQ2FsZW5kYXIvRGF5cycpXG4gICAgICAgICAgLnNldFZhbHVlKHRoaXMucGx1Z2luLnNldHRpbmdzLmRhaWx5Tm90ZXNGb2xkZXIpXG4gICAgICAgICAgLm9uQ2hhbmdlKGFzeW5jICh2YWx1ZSkgPT4ge1xuICAgICAgICAgICAgdGhpcy5wbHVnaW4uc2V0dGluZ3MuZGFpbHlOb3Rlc0ZvbGRlciA9IHZhbHVlLnRyaW0oKTtcbiAgICAgICAgICAgIGF3YWl0IHRoaXMucGx1Z2luLnNhdmVTZXR0aW5ncygpO1xuICAgICAgICAgIH0pLFxuICAgICAgKTtcblxuICAgIG5ldyBTZXR0aW5nKGNvbnRhaW5lckVsKVxuICAgICAgLnNldE5hbWUobS5zZXR0aW5nc0RhdGVGb3JtYXROYW1lKVxuICAgICAgLnNldERlc2MobS5zZXR0aW5nc0RhdGVGb3JtYXREZXNjKVxuICAgICAgLmFkZFRleHQodGV4dCA9PlxuICAgICAgICB0ZXh0XG4gICAgICAgICAgLy8gZXNsaW50LWRpc2FibGUtbmV4dC1saW5lIG9ic2lkaWFubWQvdWkvc2VudGVuY2UtY2FzZSAtLSBkYXRlLWZvcm1hdCB0b2tlbiwgbXVzdCBzdGF5IHVwcGVyY2FzZVxuICAgICAgICAgIC5zZXRQbGFjZWhvbGRlcignWVlZWS1NTS1ERCcpXG4gICAgICAgICAgLnNldFZhbHVlKHRoaXMucGx1Z2luLnNldHRpbmdzLmRhdGVGb3JtYXQpXG4gICAgICAgICAgLm9uQ2hhbmdlKGFzeW5jICh2YWx1ZSkgPT4ge1xuICAgICAgICAgICAgdGhpcy5wbHVnaW4uc2V0dGluZ3MuZGF0ZUZvcm1hdCA9IHZhbHVlLnRyaW0oKTtcbiAgICAgICAgICAgIGF3YWl0IHRoaXMucGx1Z2luLnNhdmVTZXR0aW5ncygpO1xuICAgICAgICAgIH0pLFxuICAgICAgKTtcbiAgfVxufVxuIiwiLyoqIFNpbmdsZS1jb2xvciBwcmVzZXRzIGZvciBib29sZWFuIHRyYWNrZXIgKi9cbmV4cG9ydCBjb25zdCBDT0xPUl9QUkVTRVRTOiBSZWNvcmQ8c3RyaW5nLCBzdHJpbmc+ID0ge1xuICBibHVlOiAnIzY0YjVmNicsXG4gIGdyZWVuOiAnIzY2YmI2YScsXG4gIHJlZDogJyNlNTczNzMnLFxuICBwdXJwbGU6ICcjYmE2OGM4JyxcbiAgb3JhbmdlOiAnI2ZmYjc0ZCcsXG4gIHllbGxvdzogJyNmZmQ1NGYnLFxuICB0ZWFsOiAnIzRkYjZhYycsXG4gIGluZGlnbzogJyM3OTg2Y2InLFxuICBwaW5rOiAnI2YwNjI5MicsXG59O1xuXG4vKipcbiAqIEhlYXRtYXAgY29sb3Itc2NoZW1lIHByZXNldHMuXG4gKiBJbmRleCAwID0gbm8gZGF0YSwgaW5kZXggMS4ubiA9IGluY3JlYXNpbmcgaW50ZW5zaXR5LlxuICovXG5leHBvcnQgY29uc3QgSEVBVE1BUF9TQ0hFTUVTOiBSZWNvcmQ8c3RyaW5nLCBzdHJpbmdbXT4gPSB7XG4gIGJsdWU6IFsnI2ViZWRmMCcsICcjYmJkZWZiJywgJyM5MGNhZjknLCAnIzY0YjVmNicsICcjNDJhNWY1JywgJyMxZTg4ZTUnXSxcbiAgZ3JlZW46IFsnI2ViZWRmMCcsICcjYzhlNmM5JywgJyNhNWQ2YTcnLCAnIzgxYzc4NCcsICcjNjZiYjZhJywgJyM0M2EwNDcnXSxcbiAgcmVkOiBbJyNlYmVkZjAnLCAnI2ZmY2RkMicsICcjZWY5YTlhJywgJyNlNTczNzMnLCAnI2VmNTM1MCcsICcjZTUzOTM1J10sXG4gIHB1cnBsZTogWycjZWJlZGYwJywgJyNlMWJlZTcnLCAnI2NlOTNkOCcsICcjYmE2OGM4JywgJyNhYjQ3YmMnLCAnIzhlMjRhYSddLFxuICBvcmFuZ2U6IFsnI2ViZWRmMCcsICcjZmZlMGIyJywgJyNmZmNjODAnLCAnI2ZmYjc0ZCcsICcjZmZhNzI2JywgJyNmYjhjMDAnXSxcbiAgeWVsbG93OiBbJyNlYmVkZjAnLCAnI2ZmZjljNCcsICcjZmZmNTlkJywgJyNmZmYxNzYnLCAnI2ZmZWU1OCcsICcjZmRkODM1J10sXG4gIHRlYWw6IFsnI2ViZWRmMCcsICcjYjJkZmRiJywgJyM4MGNiYzQnLCAnIzRkYjZhYycsICcjMjZhNjlhJywgJyMwMDg5N2InXSxcbiAgaW5kaWdvOiBbJyNlYmVkZjAnLCAnI2U4ZWFmNicsICcjYzVjYWU5JywgJyM5ZmE4ZGEnLCAnIzc5ODZjYicsICcjNWM2YmMwJ10sXG4gIHBpbms6IFsnI2ViZWRmMCcsICcjZmNlNGVjJywgJyNmNDhmYjEnLCAnI2YwNjI5MicsICcjZWM0MDdhJywgJyNkODFiNjAnXSxcbn07XG5cbi8qKiBSZXNvbHZlIGEgY29sb3Igc3RyaW5nOiBpZiBpdCdzIGEga25vd24gcHJlc2V0IG5hbWUsIHJldHVybiB0aGUgaGV4OyBvdGhlcndpc2UgcmV0dXJuIGFzLWlzLiAqL1xuZXhwb3J0IGZ1bmN0aW9uIHJlc29sdmVDb2xvcihjb2xvcj86IHN0cmluZyk6IHN0cmluZyB7XG4gIGlmICghY29sb3IpIHJldHVybiBDT0xPUl9QUkVTRVRTLmJsdWU7XG4gIHJldHVybiBDT0xPUl9QUkVTRVRTW2NvbG9yLnRvTG93ZXJDYXNlKCldID8/IGNvbG9yO1xufVxuXG4vKiogUmVzb2x2ZSBoZWF0bWFwIGNvbG9ycyBhcnJheSBmcm9tIGNvbG9yU2NoZW1lIHByZXNldCBvciBleHBsaWNpdCBjb2xvcnMgYXJyYXkuICovXG5leHBvcnQgZnVuY3Rpb24gcmVzb2x2ZUhlYXRtYXBDb2xvcnMoY29sb3JzPzogc3RyaW5nW10sIGNvbG9yU2NoZW1lPzogc3RyaW5nKTogc3RyaW5nW10ge1xuICBpZiAoY29sb3JzICYmIGNvbG9ycy5sZW5ndGggPiAwKSByZXR1cm4gY29sb3JzO1xuICBpZiAoY29sb3JTY2hlbWUpIHtcbiAgICBjb25zdCBzY2hlbWUgPSBIRUFUTUFQX1NDSEVNRVNbY29sb3JTY2hlbWUudG9Mb3dlckNhc2UoKV07XG4gICAgaWYgKHNjaGVtZSkgcmV0dXJuIHNjaGVtZTtcbiAgfVxuICByZXR1cm4gSEVBVE1BUF9TQ0hFTUVTWydpbmRpZ28nXTtcbn1cblxuIiwiaW1wb3J0IHsgc2V0VG9vbHRpcCB9IGZyb20gJ29ic2lkaWFuJztcbmltcG9ydCB7IFRyYWNrZXJDb25maWcsIEJvb2xlYW5Db25maWcsIENvbG9ybWFwQ29uZmlnLCBIZWF0bWFwQ29uZmlnIH0gZnJvbSAnLi90eXBlcyc7XG5pbXBvcnQgeyByZXNvbHZlQ29sb3IsIHJlc29sdmVIZWF0bWFwQ29sb3JzIH0gZnJvbSAnLi9wcmVzZXRzJztcbmltcG9ydCB7IHQgfSBmcm9tICcuL2kxOG4nO1xuXG5leHBvcnQgaW50ZXJmYWNlIERheURhdGEge1xuICBkYXk6IG51bWJlcjtcbiAgdmFsdWU6IHVua25vd247XG4gIGZpbGVQYXRoPzogc3RyaW5nO1xufVxuXG4vKipcbiAqIEJ1aWxkIGEgc2luZ2xlIGRheSBjZWxsLlxuICogQHBhcmFtIGJnQ29sb3IgaW5saW5lIGJhY2tncm91bmQgY29sb3IgZm9yIGFjdGl2ZSBjZWxsczsgbnVsbCBsZXRzIHRoZSB0aGVtZVxuICogICAoYC5pcy1lbXB0eWApIHN0eWxlIGVtcHR5IGNlbGxzIHNvIGRhcmsgbW9kZSBpcyByZXNwZWN0ZWQuXG4gKi9cbmZ1bmN0aW9uIGRheUNlbGwoXG4gIGRheTogbnVtYmVyLFxuICBiZ0NvbG9yOiBzdHJpbmcgfCBudWxsLFxuICBhY3RpdmU6IGJvb2xlYW4sXG4gIGZpbGVQYXRoOiBzdHJpbmcgfCB1bmRlZmluZWQsXG4gIHRvb2x0aXA6IHN0cmluZyxcbik6IEhUTUxFbGVtZW50IHtcbiAgY29uc3QgZWw6IEhUTUxFbGVtZW50ID0gZmlsZVBhdGhcbiAgICA/IGFjdGl2ZURvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2EnKVxuICAgIDogYWN0aXZlRG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnZGl2Jyk7XG5cbiAgZWwuY2xhc3NMaXN0LmFkZCgnbW9udGhseS10cmFja2VyLWNlbGwnLCBhY3RpdmUgPyAnaXMtYWN0aXZlJyA6ICdpcy1lbXB0eScpO1xuICBpZiAoYmdDb2xvcikgZWwuc3R5bGUuYmFja2dyb3VuZENvbG9yID0gYmdDb2xvcjtcblxuICBpZiAoZmlsZVBhdGgpIHtcbiAgICBjb25zdCBhbmNob3IgPSBlbCBhcyBIVE1MQW5jaG9yRWxlbWVudDtcbiAgICBhbmNob3IuY2xhc3NMaXN0LmFkZCgnaW50ZXJuYWwtbGluaycpO1xuICAgIGFuY2hvci5zZXRBdHRyaWJ1dGUoJ2hyZWYnLCBmaWxlUGF0aCk7XG4gICAgYW5jaG9yLmRhdGFzZXQuaHJlZiA9IGZpbGVQYXRoO1xuICB9XG5cbiAgaWYgKHRvb2x0aXApIHNldFRvb2x0aXAoZWwsIHRvb2x0aXApO1xuICBlbC50ZXh0Q29udGVudCA9IFN0cmluZyhkYXkpO1xuICByZXR1cm4gZWw7XG59XG5cbmZ1bmN0aW9uIHdyYXBHcmlkKGNlbGxzOiBIVE1MRWxlbWVudFtdKTogSFRNTEVsZW1lbnQge1xuICBjb25zdCByb3cgPSBhY3RpdmVEb2N1bWVudC5jcmVhdGVFbGVtZW50KCdkaXYnKTtcbiAgcm93LmNsYXNzTGlzdC5hZGQoJ21vbnRobHktdHJhY2tlci1yb3cnKTtcbiAgZm9yIChjb25zdCBjZWxsIG9mIGNlbGxzKSByb3cuYXBwZW5kQ2hpbGQoY2VsbCk7XG4gIHJldHVybiByb3c7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiByZW5kZXJCb29sZWFuKGNvbmZpZzogQm9vbGVhbkNvbmZpZywgZGF0YTogTWFwPG51bWJlciwgRGF5RGF0YT4sIGRheXNJbk1vbnRoOiBudW1iZXIpOiBIVE1MRWxlbWVudCB7XG4gIGNvbnN0IGFjdGl2ZUNvbG9yID0gcmVzb2x2ZUNvbG9yKGNvbmZpZy5jb2xvcik7XG4gIGNvbnN0IGNlbGxzOiBIVE1MRWxlbWVudFtdID0gW107XG5cbiAgZm9yIChsZXQgZGF5ID0gMTsgZGF5IDw9IGRheXNJbk1vbnRoOyBkYXkrKykge1xuICAgIGNvbnN0IGVudHJ5ID0gZGF0YS5nZXQoZGF5KTtcbiAgICBjb25zdCBhY3RpdmUgPSBlbnRyeSAhPT0gdW5kZWZpbmVkICYmICEhZW50cnkudmFsdWU7XG4gICAgY2VsbHMucHVzaChkYXlDZWxsKGRheSwgYWN0aXZlID8gYWN0aXZlQ29sb3IgOiBudWxsLCBhY3RpdmUsIGVudHJ5Py5maWxlUGF0aCwgYWN0aXZlID8gdCgpLnRvb2x0aXBZZXMgOiAnJykpO1xuICB9XG5cbiAgcmV0dXJuIHdyYXBHcmlkKGNlbGxzKTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHJlbmRlckNvbG9ybWFwKGNvbmZpZzogQ29sb3JtYXBDb25maWcsIGRhdGE6IE1hcDxudW1iZXIsIERheURhdGE+LCBkYXlzSW5Nb250aDogbnVtYmVyKTogSFRNTEVsZW1lbnQge1xuICBjb25zdCBjb2xvck1hcCA9IGNvbmZpZy5jb2xvcnM7XG4gIGNvbnN0IGNlbGxzOiBIVE1MRWxlbWVudFtdID0gW107XG5cbiAgZm9yIChsZXQgZGF5ID0gMTsgZGF5IDw9IGRheXNJbk1vbnRoOyBkYXkrKykge1xuICAgIGNvbnN0IGVudHJ5ID0gZGF0YS5nZXQoZGF5KTtcbiAgICBjb25zdCByYXcgPSBlbnRyeT8udmFsdWU7XG4gICAgLy8gT25seSBzY2FsYXIgZnJvbnRtYXR0ZXIgdmFsdWVzIG1hcCB0byBhIGNvbG9yIGtleTsgb2JqZWN0cy9hcnJheXMgYXJlIGlnbm9yZWQuXG4gICAgY29uc3Qga2V5ID0gdHlwZW9mIHJhdyA9PT0gJ3N0cmluZycgfHwgdHlwZW9mIHJhdyA9PT0gJ251bWJlcicgfHwgdHlwZW9mIHJhdyA9PT0gJ2Jvb2xlYW4nXG4gICAgICA/IFN0cmluZyhyYXcpXG4gICAgICA6IHVuZGVmaW5lZDtcbiAgICBjb25zdCBtYXBwZWRDb2xvciA9IGtleSAhPSBudWxsID8gY29sb3JNYXBba2V5XSA6IHVuZGVmaW5lZDtcbiAgICBjZWxscy5wdXNoKGRheUNlbGwoZGF5LCBtYXBwZWRDb2xvciA/PyBudWxsLCAhIW1hcHBlZENvbG9yLCBlbnRyeT8uZmlsZVBhdGgsIGtleSA/PyAnJykpO1xuICB9XG5cbiAgcmV0dXJuIHdyYXBHcmlkKGNlbGxzKTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHJlbmRlckhlYXRtYXAoY29uZmlnOiBIZWF0bWFwQ29uZmlnLCBkYXRhOiBNYXA8bnVtYmVyLCBEYXlEYXRhPiwgZGF5c0luTW9udGg6IG51bWJlcik6IEhUTUxFbGVtZW50IHtcbiAgY29uc3QgY29sb3JzID0gcmVzb2x2ZUhlYXRtYXBDb2xvcnMoY29uZmlnLmNvbG9ycywgY29uZmlnLmNvbG9yU2NoZW1lKTtcbiAgLy8gYmlucyBhcmUgdmFsaWRhdGVkIHVwc3RyZWFtIGluIHByb2Nlc3NCbG9jazsgbm9uLW51bGwgYXNzZXJ0aW9uIGlzIHNhZmUgaGVyZS5cbiAgY29uc3QgYmlucyA9IGNvbmZpZy5iaW5zITtcbiAgY29uc3QgdW5pdCA9IGNvbmZpZy51bml0ID8/ICcnO1xuXG4gIGZ1bmN0aW9uIGdldEludGVuc2l0eSh2YWw6IG51bWJlcik6IG51bWJlciB7XG4gICAgaWYgKHZhbCA8PSAwKSByZXR1cm4gMDtcbiAgICBmb3IgKGxldCBpID0gMDsgaSA8IGJpbnMubGVuZ3RoOyBpKyspIHtcbiAgICAgIGlmICh2YWwgPCBiaW5zW2ldKSByZXR1cm4gaSArIDE7XG4gICAgfVxuICAgIHJldHVybiBiaW5zLmxlbmd0aCArIDE7XG4gIH1cblxuICBjb25zdCBtYXhJbnRlbnNpdHkgPSBiaW5zLmxlbmd0aCArIDE7XG4gIGNvbnN0IGZpbGxDb2xvciA9IGNvbG9yc1tjb2xvcnMubGVuZ3RoIC0gMV0gPz8gJyc7XG4gIGNvbnN0IHBhZGRpbmcgPSBuZXcgQXJyYXk8c3RyaW5nPihNYXRoLm1heCgwLCBtYXhJbnRlbnNpdHkgKyAxIC0gY29sb3JzLmxlbmd0aCkpLmZpbGwoZmlsbENvbG9yKTtcbiAgY29uc3Qgc2FmZUNvbG9ycyA9IGNvbG9ycy5sZW5ndGggPj0gbWF4SW50ZW5zaXR5ICsgMSA/IGNvbG9ycyA6IFsuLi5jb2xvcnMsIC4uLnBhZGRpbmddO1xuXG4gIGxldCB0b3RhbCA9IDA7XG4gIGNvbnN0IGNlbGxzOiBIVE1MRWxlbWVudFtdID0gW107XG5cbiAgZm9yIChsZXQgZGF5ID0gMTsgZGF5IDw9IGRheXNJbk1vbnRoOyBkYXkrKykge1xuICAgIGNvbnN0IGVudHJ5ID0gZGF0YS5nZXQoZGF5KTtcbiAgICBjb25zdCByYXcgPSBlbnRyeT8udmFsdWU7XG4gICAgY29uc3QgdmFsID0gdHlwZW9mIHJhdyA9PT0gJ251bWJlcicgJiYgaXNGaW5pdGUocmF3KSA/IHJhdyA6IDA7XG4gICAgdG90YWwgKz0gdmFsO1xuICAgIGNvbnN0IGludGVuc2l0eSA9IGdldEludGVuc2l0eSh2YWwpO1xuICAgIGNvbnN0IGFjdGl2ZSA9IGludGVuc2l0eSA+IDA7XG4gICAgY29uc3QgYmdDb2xvciA9IGFjdGl2ZSA/IChzYWZlQ29sb3JzW2ludGVuc2l0eV0gfHwgbnVsbCkgOiBudWxsO1xuICAgIGNlbGxzLnB1c2goZGF5Q2VsbChkYXksIGJnQ29sb3IsIGFjdGl2ZSwgZW50cnk/LmZpbGVQYXRoLCB2YWwgPiAwID8gYCR7dmFsfSR7dW5pdH1gIDogJycpKTtcbiAgfVxuXG4gIGNvbnN0IGNvbnRhaW5lciA9IGFjdGl2ZURvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2RpdicpO1xuXG4gIGlmIChjb25maWcuc2hvd1RvdGFsKSB7XG4gICAgY29uc3QgbGFiZWwgPSBjb25maWcudG90YWxMYWJlbCA/PyB0KCkudG90YWxMYWJlbDtcbiAgICBjb25zdCBzdW1tYXJ5ID0gYWN0aXZlRG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnZGl2Jyk7XG4gICAgc3VtbWFyeS5jbGFzc0xpc3QuYWRkKCdtb250aGx5LXRyYWNrZXItc3VtbWFyeScpO1xuICAgIHN1bW1hcnkudGV4dENvbnRlbnQgPSBgJHtsYWJlbH06IGA7XG4gICAgY29uc3QgdmFsdWUgPSBhY3RpdmVEb2N1bWVudC5jcmVhdGVFbGVtZW50KCdzcGFuJyk7XG4gICAgdmFsdWUuY2xhc3NMaXN0LmFkZCgnbW9udGhseS10cmFja2VyLXN1bW1hcnktdmFsdWUnKTtcbiAgICBjb25zdCBkaXNwbGF5VG90YWwgPSBOdW1iZXIuaXNJbnRlZ2VyKHRvdGFsKSA/IFN0cmluZyh0b3RhbCkgOiB0b3RhbC50b0ZpeGVkKDEpO1xuICAgIHZhbHVlLnRleHRDb250ZW50ID0gYCR7ZGlzcGxheVRvdGFsfSR7dW5pdH1gO1xuICAgIHN1bW1hcnkuYXBwZW5kQ2hpbGQodmFsdWUpO1xuICAgIGNvbnRhaW5lci5hcHBlbmRDaGlsZChzdW1tYXJ5KTtcbiAgfVxuXG4gIGNvbnRhaW5lci5hcHBlbmRDaGlsZCh3cmFwR3JpZChjZWxscykpO1xuICByZXR1cm4gY29udGFpbmVyO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gcmVuZGVyVHJhY2tlcihcbiAgY29uZmlnOiBUcmFja2VyQ29uZmlnLFxuICBkYXRhOiBNYXA8bnVtYmVyLCBEYXlEYXRhPixcbiAgZGF5c0luTW9udGg6IG51bWJlcixcbik6IEhUTUxFbGVtZW50IHtcbiAgY29uc3QgY29udGFpbmVyID0gYWN0aXZlRG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnZGl2Jyk7XG4gIGNvbnRhaW5lci5jbGFzc0xpc3QuYWRkKCdtb250aGx5LXRyYWNrZXInKTtcblxuICBsZXQgaW5uZXI6IEhUTUxFbGVtZW50IHwgbnVsbCA9IG51bGw7XG4gIGlmIChjb25maWcudHlwZSA9PT0gJ2Jvb2xlYW4nKSB7XG4gICAgaW5uZXIgPSByZW5kZXJCb29sZWFuKGNvbmZpZywgZGF0YSwgZGF5c0luTW9udGgpO1xuICB9IGVsc2UgaWYgKGNvbmZpZy50eXBlID09PSAnY29sb3JtYXAnKSB7XG4gICAgaW5uZXIgPSByZW5kZXJDb2xvcm1hcChjb25maWcsIGRhdGEsIGRheXNJbk1vbnRoKTtcbiAgfSBlbHNlIGlmIChjb25maWcudHlwZSA9PT0gJ2hlYXRtYXAnKSB7XG4gICAgaW5uZXIgPSByZW5kZXJIZWF0bWFwKGNvbmZpZywgZGF0YSwgZGF5c0luTW9udGgpO1xuICB9XG5cbiAgaWYgKGlubmVyKSBjb250YWluZXIuYXBwZW5kQ2hpbGQoaW5uZXIpO1xuICByZXR1cm4gY29udGFpbmVyO1xufVxuIiwiLyoqXG4gKiBCdWlsZCBhIHJlZ2V4IHRoYXQgbWF0Y2hlcyBkYWlseS1ub3RlIGZpbGVuYW1lcyBmb3IgYSBnaXZlbiB5ZWFyL21vbnRoLlxuICpcbiAqIFRoZSBgZGF0ZUZvcm1hdGAgdXNlcyBgWVlZWWAvYE1NYC9gRERgIHRva2Vucy4gYFlZWVlgIGFuZCBgTU1gIGFyZSBmaWxsZWQgaW5cbiAqIHdpdGggdGhlIGNvbmNyZXRlIHllYXIvbW9udGgsIHdoaWxlIGBERGAgYmVjb21lcyBhIGNhcHR1cmVkIGAoXFxkezJ9KWAgZ3JvdXAgc29cbiAqIGNhbGxlcnMgY2FuIHJlYWQgdGhlIGRheSBiYWNrIG91dC4gQW55IG90aGVyIGNoYXJhY3RlcnMgaW4gdGhlIGZvcm1hdCBhcmVcbiAqIHRyZWF0ZWQgbGl0ZXJhbGx5IGFuZCByZWdleC1lc2NhcGVkLlxuICovXG5leHBvcnQgZnVuY3Rpb24gYnVpbGREYXRlUGF0dGVybihkYXRlRm9ybWF0OiBzdHJpbmcsIHllYXI6IG51bWJlciwgbW9udGg6IG51bWJlcik6IFJlZ0V4cCB7XG4gIGNvbnN0IG1tID0gU3RyaW5nKG1vbnRoKS5wYWRTdGFydCgyLCAnMCcpO1xuICBjb25zdCBlc2NhcGVkID0gZGF0ZUZvcm1hdFxuICAgIC5yZXBsYWNlKCdZWVlZJywgJ1xceDAwWVxceDAwJylcbiAgICAucmVwbGFjZSgnTU0nLCAnXFx4MDBNXFx4MDAnKVxuICAgIC5yZXBsYWNlKCdERCcsICdcXHgwMERcXHgwMCcpXG4gICAgLnJlcGxhY2UoL1suKis/XiR7fSgpfFtcXF1cXFxcXS9nLCAnXFxcXCQmJylcbiAgICAucmVwbGFjZSgnXFx4MDBZXFx4MDAnLCBTdHJpbmcoeWVhcikpXG4gICAgLnJlcGxhY2UoJ1xceDAwTVxceDAwJywgbW0pXG4gICAgLnJlcGxhY2UoJ1xceDAwRFxceDAwJywgJyhcXFxcZHsyfSknKTtcbiAgcmV0dXJuIG5ldyBSZWdFeHAoYF4ke2VzY2FwZWR9YCk7XG59XG4iLCJpbXBvcnQgeyBBcHAsIG5vcm1hbGl6ZVBhdGggfSBmcm9tICdvYnNpZGlhbic7XG5cbi8qKiBNaW5pbWFsIHNoYXBlcyBmb3IgdGhlIHVudHlwZWQgaW50ZXJuYWwvY29tbXVuaXR5IHBsdWdpbiBBUElzIHdlIHJlYWQgZnJvbS4gKi9cbmludGVyZmFjZSBEYWlseU5vdGVzSW50ZXJuYWxQbHVnaW4ge1xuICBpbnN0YW5jZT86IHsgb3B0aW9ucz86IHsgZm9sZGVyPzogc3RyaW5nIH0gfTtcbn1cbmludGVyZmFjZSBQZXJpb2RpY05vdGVzUGx1Z2luIHtcbiAgc2V0dGluZ3M/OiB7IGRhaWx5PzogeyBmb2xkZXI/OiBzdHJpbmcgfSB9O1xufVxuaW50ZXJmYWNlIEFwcFdpdGhQbHVnaW5zIGV4dGVuZHMgQXBwIHtcbiAgaW50ZXJuYWxQbHVnaW5zPzogeyBwbHVnaW5zPzogUmVjb3JkPHN0cmluZywgRGFpbHlOb3Rlc0ludGVybmFsUGx1Z2luIHwgdW5kZWZpbmVkPiB9O1xuICBwbHVnaW5zPzogeyBwbHVnaW5zPzogUmVjb3JkPHN0cmluZywgUGVyaW9kaWNOb3Rlc1BsdWdpbiB8IHVuZGVmaW5lZD4gfTtcbn1cblxuLyoqXG4gKiBCZXN0LWVmZm9ydCBkZXRlY3Rpb24gb2YgdGhlIGRhaWx5LW5vdGVzIGZvbGRlciBmcm9tIHRoZSBjb3JlIERhaWx5IG5vdGVzXG4gKiBwbHVnaW4sIGZhbGxpbmcgYmFjayB0byB0aGUgY29tbXVuaXR5IFBlcmlvZGljIE5vdGVzIHBsdWdpbi4gUmV0dXJucyBgJydgXG4gKiB3aGVuIG5laXRoZXIgaXMgY29uZmlndXJlZC5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGRldGVjdERhaWx5Tm90ZXNGb2xkZXIoYXBwOiBBcHApOiBzdHJpbmcge1xuICBjb25zdCBhID0gYXBwIGFzIEFwcFdpdGhQbHVnaW5zO1xuICBjb25zdCBpbnRlcm5hbCA9IGEuaW50ZXJuYWxQbHVnaW5zPy5wbHVnaW5zPy5bJ2RhaWx5LW5vdGVzJ10/Lmluc3RhbmNlPy5vcHRpb25zPy5mb2xkZXI7XG4gIGlmIChpbnRlcm5hbCkgcmV0dXJuIGludGVybmFsO1xuICBjb25zdCBwZXJpb2RpYyA9IGEucGx1Z2lucz8ucGx1Z2lucz8uWydwZXJpb2RpYy1ub3RlcyddPy5zZXR0aW5ncz8uZGFpbHk/LmZvbGRlcjtcbiAgaWYgKHBlcmlvZGljKSByZXR1cm4gcGVyaW9kaWM7XG4gIHJldHVybiAnJztcbn1cblxuLyoqXG4gKiBSZXNvbHZlIHdoaWNoIHZhdWx0IGZvbGRlciB0byBzY2FuIGZvciBkYWlseSBub3RlcywgaW4gcHJpb3JpdHkgb3JkZXI6XG4gKiB0aGUgY29kZS1ibG9jayBgc291cmNlYCwgdGhlbiB0aGUgcGx1Z2luIHNldHRpbmcsIHRoZW4gYW4gYXV0by1kZXRlY3RlZCBmb2xkZXIuXG4gKlxuICogVGhlIHJlc3VsdCBpcyBydW4gdGhyb3VnaCBgbm9ybWFsaXplUGF0aCgpYCBzbyB1c2VyLXByb3ZpZGVkIHBhdGhzIHdpdGhcbiAqIHRyYWlsaW5nL2xlYWRpbmcgc2xhc2hlcyBvciBiYWNrc2xhc2hlcyByZXNvbHZlIGNvcnJlY3RseS4gQW4gdW5yZXNvbHZlZFxuICogKGVtcHR5KSBwYXRoIGlzIGRlbGliZXJhdGVseSBrZXB0IGVtcHR5IHJhdGhlciB0aGFuIG5vcm1hbGl6ZWQ6IE9ic2lkaWFuJ3NcbiAqIGBub3JtYWxpemVQYXRoKCcnKWAgcmV0dXJucyBgJy8nYCwgd2hpY2ggd291bGQgc2lsZW50bHkgbWF0Y2ggdGhlIHZhdWx0IHJvb3RcbiAqIGFuZCBzY2FuIGV2ZXJ5IGZpbGUuIFJldHVybmluZyBgJydgIGluc3RlYWQgbGV0cyB0aGUgbG9va3VwIGZhaWwgYW5kIHByb2R1Y2VcbiAqIGFuIGVtcHR5IHRyYWNrZXIuXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiByZXNvbHZlRGFpbHlOb3Rlc0ZvbGRlcihcbiAgc291cmNlOiBzdHJpbmcgfCB1bmRlZmluZWQsXG4gIHNldHRpbmdzRm9sZGVyOiBzdHJpbmcsXG4gIGRldGVjdGVkRm9sZGVyOiBzdHJpbmcsXG4pOiBzdHJpbmcge1xuICBjb25zdCByZXNvbHZlZCA9IHNvdXJjZSA/PyAoc2V0dGluZ3NGb2xkZXIgfHwgZGV0ZWN0ZWRGb2xkZXIpO1xuICByZXR1cm4gcmVzb2x2ZWQgPyBub3JtYWxpemVQYXRoKHJlc29sdmVkKSA6ICcnO1xufVxuIiwiaW1wb3J0IHsgVHJhY2tlckNvbmZpZyB9IGZyb20gJy4vdHlwZXMnO1xuaW1wb3J0IHsgdCB9IGZyb20gJy4vaTE4bic7XG5cbi8qKiBWYWxpZGF0ZSBjb25maWctbGV2ZWwgaW52YXJpYW50cyB1cCBmcm9udCBzbyByZW5kZXJlcnMgY2FuIGFzc3VtZSB2YWxpZCBpbnB1dC4gKi9cbmV4cG9ydCBmdW5jdGlvbiB2YWxpZGF0ZUNvbmZpZyhjb25maWc6IFRyYWNrZXJDb25maWcpOiB2b2lkIHtcbiAgY29uc3QgbSA9IHQoKTtcbiAgaWYgKCFjb25maWc/LnR5cGUpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IobS5lcnJNaXNzaW5nVHlwZSk7XG4gIH1cbiAgaWYgKCFjb25maWcucHJvcGVydHkgJiYgY29uZmlnLnR5cGUgIT09ICdib29sZWFuJykge1xuICAgIHRocm93IG5ldyBFcnJvcihtLmVyck1pc3NpbmdQcm9wZXJ0eSk7XG4gIH1cbiAgaWYgKGNvbmZpZy50eXBlID09PSAnY29sb3JtYXAnICYmICFjb25maWcuY29sb3JzKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKG0uZXJyTWlzc2luZ0NvbG9ycyk7XG4gIH1cbiAgaWYgKGNvbmZpZy50eXBlID09PSAnaGVhdG1hcCcpIHtcbiAgICBjb25zdCBiaW5zID0gY29uZmlnLmJpbnM7XG4gICAgaWYgKCFiaW5zIHx8IGJpbnMubGVuZ3RoID09PSAwKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IobS5lcnJIZWF0bWFwQmlucyk7XG4gICAgfVxuICAgIGlmIChiaW5zWzBdIDw9IDApIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihtLmVyckJpbnNQb3NpdGl2ZShiaW5zWzBdKSk7XG4gICAgfVxuICAgIGZvciAobGV0IGkgPSAxOyBpIDwgYmlucy5sZW5ndGg7IGkrKykge1xuICAgICAgaWYgKGJpbnNbaV0gPD0gYmluc1tpIC0gMV0pIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKG0uZXJyQmluc0FzY2VuZGluZyhiaW5zW2kgLSAxXSwgYmluc1tpXSkpO1xuICAgICAgfVxuICAgIH1cbiAgfVxufVxuIiwiaW1wb3J0IHsgUGx1Z2luLCBNYXJrZG93blBvc3RQcm9jZXNzb3JDb250ZXh0LCBURmlsZSwgVEZvbGRlciwgcGFyc2VZYW1sIH0gZnJvbSAnb2JzaWRpYW4nO1xuaW1wb3J0IHsgUGx1Z2luU2V0dGluZ3MsIERFRkFVTFRfU0VUVElOR1MsIFRyYWNrZXJDb25maWcgfSBmcm9tICcuL3R5cGVzJztcbmltcG9ydCB7IE1vbnRobHlUcmFja2VyU2V0dGluZ1RhYiB9IGZyb20gJy4vc2V0dGluZ3MnO1xuaW1wb3J0IHsgcmVuZGVyVHJhY2tlciwgRGF5RGF0YSB9IGZyb20gJy4vcmVuZGVyZXInO1xuaW1wb3J0IHsgYnVpbGREYXRlUGF0dGVybiB9IGZyb20gJy4vZGF0ZS1wYXR0ZXJuJztcbmltcG9ydCB7IGRldGVjdERhaWx5Tm90ZXNGb2xkZXIsIHJlc29sdmVEYWlseU5vdGVzRm9sZGVyIH0gZnJvbSAnLi9mb2xkZXInO1xuaW1wb3J0IHsgdmFsaWRhdGVDb25maWcgfSBmcm9tICcuL3ZhbGlkYXRlJztcbmltcG9ydCB7IHQgfSBmcm9tICcuL2kxOG4nO1xuXG5leHBvcnQgZGVmYXVsdCBjbGFzcyBNb250aGx5VHJhY2tlclBsdWdpbiBleHRlbmRzIFBsdWdpbiB7XG4gIHNldHRpbmdzITogUGx1Z2luU2V0dGluZ3M7XG5cbiAgYXN5bmMgb25sb2FkKCkge1xuICAgIGF3YWl0IHRoaXMubG9hZFNldHRpbmdzKCk7XG4gICAgdGhpcy5hZGRTZXR0aW5nVGFiKG5ldyBNb250aGx5VHJhY2tlclNldHRpbmdUYWIodGhpcy5hcHAsIHRoaXMpKTtcblxuICAgIHRoaXMucmVnaXN0ZXJNYXJrZG93bkNvZGVCbG9ja1Byb2Nlc3NvcihcbiAgICAgICdtb250aGx5LXRyYWNrZXInLFxuICAgICAgYXN5bmMgKHNvdXJjZSwgZWwsIGN0eCkgPT4ge1xuICAgICAgICB0cnkge1xuICAgICAgICAgIGF3YWl0IHRoaXMucHJvY2Vzc0Jsb2NrKHNvdXJjZSwgZWwsIGN0eCk7XG4gICAgICAgIH0gY2F0Y2ggKGVycikge1xuICAgICAgICAgIGVsLmNyZWF0ZUVsKCdwcmUnLCB7XG4gICAgICAgICAgICB0ZXh0OiBgJHt0KCkuZXJyb3JQcmVmaXh9OlxcbiR7ZXJyIGluc3RhbmNlb2YgRXJyb3IgPyBlcnIubWVzc2FnZSA6IFN0cmluZyhlcnIpfWAsXG4gICAgICAgICAgICBjbHM6ICdtb250aGx5LXRyYWNrZXItZXJyb3InLFxuICAgICAgICAgIH0pO1xuICAgICAgICB9XG4gICAgICB9LFxuICAgICk7XG4gIH1cblxuICBwcml2YXRlIGFzeW5jIHByb2Nlc3NCbG9jayhcbiAgICBzb3VyY2U6IHN0cmluZyxcbiAgICBlbDogSFRNTEVsZW1lbnQsXG4gICAgY3R4OiBNYXJrZG93blBvc3RQcm9jZXNzb3JDb250ZXh0LFxuICApOiBQcm9taXNlPHZvaWQ+IHtcbiAgICBjb25zdCBjb25maWcgPSBwYXJzZVlhbWwoc291cmNlLnRyaW0oKSkgYXMgVHJhY2tlckNvbmZpZztcbiAgICB2YWxpZGF0ZUNvbmZpZyhjb25maWcpO1xuXG4gICAgLy8gUmVhZCB5ZWFyL21vbnRoIGZyb20gdGhlIGN1cnJlbnQgbm90ZSdzIGZyb250bWF0dGVyXG4gICAgY29uc3QgY3VycmVudEZpbGUgPSB0aGlzLmFwcC52YXVsdC5nZXRBYnN0cmFjdEZpbGVCeVBhdGgoY3R4LnNvdXJjZVBhdGgpO1xuICAgIGlmICghKGN1cnJlbnRGaWxlIGluc3RhbmNlb2YgVEZpbGUpKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IodCgpLmVyckNhbm5vdFJlc29sdmVGaWxlKTtcbiAgICB9XG4gICAgY29uc3QgZm0gPSB0aGlzLmFwcC5tZXRhZGF0YUNhY2hlLmdldEZpbGVDYWNoZShjdXJyZW50RmlsZSk/LmZyb250bWF0dGVyO1xuICAgIGNvbnN0IHllYXI6IHVua25vd24gPSBmbT8ueWVhcjtcbiAgICBjb25zdCBtb250aDogdW5rbm93biA9IGZtPy5tb250aDtcbiAgICBpZiAoeWVhciA9PSBudWxsIHx8IG1vbnRoID09IG51bGwpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcih0KCkuZXJyTWlzc2luZ1llYXJNb250aCk7XG4gICAgfVxuICAgIGlmICh0eXBlb2YgeWVhciAhPT0gJ251bWJlcicgfHwgdHlwZW9mIG1vbnRoICE9PSAnbnVtYmVyJykge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKHQoKS5lcnJZZWFyTW9udGhUeXBlKTtcbiAgICB9XG4gICAgaWYgKG1vbnRoIDwgMSB8fCBtb250aCA+IDEyKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IodCgpLmVyckludmFsaWRNb250aChtb250aCkpO1xuICAgIH1cblxuICAgIGNvbnN0IGRheXNJbk1vbnRoID0gbmV3IERhdGUoeWVhciwgbW9udGgsIDApLmdldERhdGUoKTtcbiAgICBjb25zdCBmb2xkZXIgPSByZXNvbHZlRGFpbHlOb3Rlc0ZvbGRlcihcbiAgICAgIGNvbmZpZy5zb3VyY2UsXG4gICAgICB0aGlzLnNldHRpbmdzLmRhaWx5Tm90ZXNGb2xkZXIsXG4gICAgICBkZXRlY3REYWlseU5vdGVzRm9sZGVyKHRoaXMuYXBwKSxcbiAgICApO1xuICAgIGNvbnN0IHBhdHRlcm4gPSBidWlsZERhdGVQYXR0ZXJuKHRoaXMuc2V0dGluZ3MuZGF0ZUZvcm1hdCwgeWVhciwgbW9udGgpO1xuXG4gICAgLy8gU2NhbiB2YXVsdCBmb2xkZXIgZm9yIG1hdGNoaW5nIGRhaWx5IG5vdGVzXG4gICAgY29uc3QgZGF0YSA9IG5ldyBNYXA8bnVtYmVyLCBEYXlEYXRhPigpO1xuICAgIGNvbnN0IGFic3RyYWN0Rm9sZGVyID0gdGhpcy5hcHAudmF1bHQuZ2V0QWJzdHJhY3RGaWxlQnlQYXRoKGZvbGRlcik7XG5cbiAgICBpZiAoYWJzdHJhY3RGb2xkZXIgaW5zdGFuY2VvZiBURm9sZGVyKSB7XG4gICAgICBmb3IgKGNvbnN0IGNoaWxkIG9mIGFic3RyYWN0Rm9sZGVyLmNoaWxkcmVuKSB7XG4gICAgICAgIGlmICghKGNoaWxkIGluc3RhbmNlb2YgVEZpbGUpKSBjb250aW51ZTtcbiAgICAgICAgY29uc3QgbWF0Y2ggPSBjaGlsZC5uYW1lLm1hdGNoKHBhdHRlcm4pO1xuICAgICAgICBpZiAoIW1hdGNoKSBjb250aW51ZTtcbiAgICAgICAgY29uc3QgZGF5ID0gcGFyc2VJbnQobWF0Y2hbMV0sIDEwKTtcblxuICAgICAgICBjb25zdCBjaGlsZEZtID0gdGhpcy5hcHAubWV0YWRhdGFDYWNoZS5nZXRGaWxlQ2FjaGUoY2hpbGQpPy5mcm9udG1hdHRlcjtcbiAgICAgICAgLy8gRmlsZS1leGlzdGVuY2UgbW9kZSAocHJvcGVydHkgb21pdHRlZCkgbWFya3MgZXZlcnkgbWF0Y2hpbmcgbm90ZSBhcyB0cnVlLlxuICAgICAgICBjb25zdCB2YWx1ZTogdW5rbm93biA9IGNvbmZpZy5wcm9wZXJ0eSA9PSBudWxsID8gdHJ1ZSA6IGNoaWxkRm0/Lltjb25maWcucHJvcGVydHldO1xuXG4gICAgICAgIGRhdGEuc2V0KGRheSwgeyBkYXksIHZhbHVlLCBmaWxlUGF0aDogY2hpbGQucGF0aCB9KTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICBjb25zdCByZW5kZXJlZCA9IHJlbmRlclRyYWNrZXIoY29uZmlnLCBkYXRhLCBkYXlzSW5Nb250aCk7XG5cbiAgICAvLyBEZWxlZ2F0ZSBpbnRlcm5hbC1saW5rIGNsaWNrcyB0byBPYnNpZGlhbiBzbyBkYXkgY2VsbHMgb3BlbiB0aGUgbm90ZS5cbiAgICB0aGlzLnJlZ2lzdGVyRG9tRXZlbnQocmVuZGVyZWQsICdjbGljaycsIChldnQpID0+IHtcbiAgICAgIGNvbnN0IGxpbmsgPSAoZXZ0LnRhcmdldCBhcyBIVE1MRWxlbWVudCkuY2xvc2VzdCgnYS5pbnRlcm5hbC1saW5rJyk7XG4gICAgICBjb25zdCBwYXRoID0gbGluaz8uZ2V0QXR0cmlidXRlKCdkYXRhLWhyZWYnKTtcbiAgICAgIGlmICghcGF0aCkgcmV0dXJuO1xuICAgICAgZXZ0LnByZXZlbnREZWZhdWx0KCk7XG4gICAgICB2b2lkIHRoaXMuYXBwLndvcmtzcGFjZS5vcGVuTGlua1RleHQocGF0aCwgY3R4LnNvdXJjZVBhdGgsIGV2dC5jdHJsS2V5IHx8IGV2dC5tZXRhS2V5KTtcbiAgICB9KTtcblxuICAgIC8vIFRyaWdnZXIgT2JzaWRpYW4ncyBwYWdlLXByZXZpZXcgb24gaG92ZXIgKGRhdGEtaHJlZiBhbG9uZSBkb2Vzbid0IGVuYWJsZSBpdCkuXG4gICAgdGhpcy5yZWdpc3RlckRvbUV2ZW50KHJlbmRlcmVkLCAnbW91c2VvdmVyJywgKGV2dCkgPT4ge1xuICAgICAgY29uc3QgbGluayA9IChldnQudGFyZ2V0IGFzIEhUTUxFbGVtZW50KS5jbG9zZXN0KCdhLmludGVybmFsLWxpbmsnKTtcbiAgICAgIGNvbnN0IHBhdGggPSBsaW5rPy5nZXRBdHRyaWJ1dGUoJ2RhdGEtaHJlZicpO1xuICAgICAgaWYgKCFwYXRoKSByZXR1cm47XG4gICAgICB0aGlzLmFwcC53b3Jrc3BhY2UudHJpZ2dlcignaG92ZXItbGluaycsIHtcbiAgICAgICAgZXZlbnQ6IGV2dCxcbiAgICAgICAgc291cmNlOiAnbW9udGhseS10cmFja2VyJyxcbiAgICAgICAgaG92ZXJQYXJlbnQ6IHJlbmRlcmVkLFxuICAgICAgICB0YXJnZXRFbDogbGluayxcbiAgICAgICAgbGlua3RleHQ6IHBhdGgsXG4gICAgICAgIHNvdXJjZVBhdGg6IGN0eC5zb3VyY2VQYXRoLFxuICAgICAgfSk7XG4gICAgfSk7XG5cbiAgICBlbC5hcHBlbmRDaGlsZChyZW5kZXJlZCk7XG4gIH1cblxuICBhc3luYyBsb2FkU2V0dGluZ3MoKSB7XG4gICAgY29uc3QgZGF0YSA9IChhd2FpdCB0aGlzLmxvYWREYXRhKCkpIGFzIFBhcnRpYWw8UGx1Z2luU2V0dGluZ3M+IHwgbnVsbDtcbiAgICB0aGlzLnNldHRpbmdzID0gT2JqZWN0LmFzc2lnbih7fSwgREVGQVVMVF9TRVRUSU5HUywgZGF0YSk7XG4gIH1cblxuICBhc3luYyBzYXZlU2V0dGluZ3MoKSB7XG4gICAgYXdhaXQgdGhpcy5zYXZlRGF0YSh0aGlzLnNldHRpbmdzKTtcbiAgfVxufVxuIl0sIm5hbWVzIjpbImdldExhbmd1YWdlIiwiUGx1Z2luU2V0dGluZ1RhYiIsIlNldHRpbmciLCJzZXRUb29sdGlwIiwibm9ybWFsaXplUGF0aCIsIlBsdWdpbiIsInBhcnNlWWFtbCIsIlRGaWxlIiwiVEZvbGRlciJdLCJtYXBwaW5ncyI6Ijs7OztBQTRDTyxNQUFNLGdCQUFnQixHQUFtQjtBQUM5QyxJQUFBLGdCQUFnQixFQUFFLEVBQUU7QUFDcEIsSUFBQSxVQUFVLEVBQUUsWUFBWTtDQUN6Qjs7QUN2QkQsTUFBTSxFQUFFLEdBQWE7QUFDbkIsSUFBQSxXQUFXLEVBQUUsdUJBQXVCO0FBQ3BDLElBQUEsY0FBYyxFQUFFLDZEQUE2RDtBQUM3RSxJQUFBLGtCQUFrQixFQUFFLGtDQUFrQztBQUN0RCxJQUFBLGdCQUFnQixFQUFFLCtEQUErRDtBQUNqRixJQUFBLG9CQUFvQixFQUFFLDZCQUE2QjtBQUNuRCxJQUFBLG1CQUFtQixFQUFFLDBEQUEwRDtBQUMvRSxJQUFBLGdCQUFnQixFQUFFLG1EQUFtRDtJQUNyRSxlQUFlLEVBQUUsQ0FBQyxLQUFLLEtBQUssQ0FBQSxlQUFBLEVBQWtCLEtBQUssQ0FBaUIsZUFBQSxDQUFBO0FBQ3BFLElBQUEsY0FBYyxFQUFFLG9EQUFvRDtJQUNwRSxlQUFlLEVBQUUsQ0FBQyxLQUFLLEtBQUssQ0FBQSxrQ0FBQSxFQUFxQyxLQUFLLENBQUcsQ0FBQSxDQUFBO0FBQ3pFLElBQUEsZ0JBQWdCLEVBQUUsQ0FBQyxJQUFJLEVBQUUsSUFBSSxLQUFLLENBQXdDLHFDQUFBLEVBQUEsSUFBSSxDQUFLLEVBQUEsRUFBQSxJQUFJLENBQUcsQ0FBQSxDQUFBO0FBQzFGLElBQUEsVUFBVSxFQUFFLEtBQUs7QUFDakIsSUFBQSxVQUFVLEVBQUUs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
