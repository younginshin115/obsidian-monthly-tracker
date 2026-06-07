import { getLanguage } from 'obsidian';

type Locale = 'en' | 'ko';

export interface Messages {
  errorPrefix: string;
  errMissingType: string;
  errMissingProperty: string;
  errMissingColors: string;
  errCannotResolveFile: string;
  errMissingYearMonth: string;
  errYearMonthType: string;
  errInvalidMonth: (month: number) => string;
  errHeatmapBins: string;
  errBinsPositive: (value: number) => string;
  errBinsAscending: (prev: number, next: number) => string;
  tooltipYes: string;
  totalLabel: string;
  settingsFolderName: string;
  settingsFolderDesc: string;
  settingsFolderPlaceholder: string;
  settingsDateFormatName: string;
  settingsDateFormatDesc: string;
  settingsDateFormatPlaceholder: string;
}

const en: Messages = {
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
  settingsFolderPlaceholder: 'Calendar/Days',
  settingsDateFormatName: 'Date format',
  settingsDateFormatDesc: 'File name date format. Must match YYYY-MM-DD at the start of file names.',
  settingsDateFormatPlaceholder: 'YYYY-MM-DD',
};

const ko: Messages = {
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
  settingsFolderPlaceholder: 'Calendar/Days',
  settingsDateFormatName: '날짜 형식',
  settingsDateFormatDesc: '파일 이름의 날짜 형식. 파일 이름 앞부분이 YYYY-MM-DD와 일치해야 합니다.',
  settingsDateFormatPlaceholder: 'YYYY-MM-DD',
};

function currentLocale(): Locale {
  return getLanguage() === 'ko' ? 'ko' : 'en';
}

/** Returns the message table for the current Obsidian UI language. */
export function t(): Messages {
  return currentLocale() === 'ko' ? ko : en;
}
