import type { ExamPaper } from '../types/exam'
import type { DailyReport, ErrorReason, ExamProgress, ExamResult, UserSettings } from '../types/result'

export const STORAGE_VERSION = 1
const prefix = `ai-kaoyan:v${STORAGE_VERSION}:`

export const STORAGE_KEYS = {
  version: 'ai-kaoyan:storage-version',
  importedExams: `${prefix}imported-exams`,
  progress: `${prefix}exam-progress`,
  history: `${prefix}exam-history`,
  errorReasons: `${prefix}error-reasons`,
  dailyReports: `${prefix}daily-reports`,
  settings: `${prefix}settings`,
} as const

const canUseStorage = () => typeof localStorage !== 'undefined'

export interface SyncSnapshot {
  version: number
  importedExams: ExamPaper[]
  progresses: Record<string, ExamProgress>
  history: ExamResult[]
  errorReasons: Record<string, ErrorReason>
  dailyReports: DailyReport[]
  settings: Pick<UserSettings, 'confirmBeforeSubmit' | 'passageExpanded'>
}

const read = <T>(key: string, fallback: T): T => {
  if (!canUseStorage()) return fallback
  try {
    const raw = localStorage.getItem(key)
    return raw ? JSON.parse(raw) as T : fallback
  } catch {
    return fallback
  }
}

const write = <T>(key: string, value: T): boolean => {
  if (!canUseStorage()) return false
  try {
    localStorage.setItem(STORAGE_KEYS.version, String(STORAGE_VERSION))
    localStorage.setItem(key, JSON.stringify(value))
    if (typeof window !== 'undefined') window.dispatchEvent(new Event('ai-kaoyan-storage-change'))
    return true
  } catch {
    return false
  }
}

export const examStorage = {
  getImported: () => read<ExamPaper[]>(STORAGE_KEYS.importedExams, []),
  saveImported: (exams: ExamPaper[]) => write(STORAGE_KEYS.importedExams, exams),
  getProgresses: () => read<Record<string, ExamProgress>>(STORAGE_KEYS.progress, {}),
  getProgress: (examId: string) => read<Record<string, ExamProgress>>(STORAGE_KEYS.progress, {})[examId],
  saveProgress(progress: ExamProgress) {
    const all = this.getProgresses()
    all[progress.examId] = progress
    write(STORAGE_KEYS.progress, all)
  },
  removeProgress(examId: string) {
    const all = this.getProgresses()
    delete all[examId]
    write(STORAGE_KEYS.progress, all)
  },
  getHistory: () => read<ExamResult[]>(STORAGE_KEYS.history, []),
  saveResult(result: ExamResult) {
    write(STORAGE_KEYS.history, [result, ...this.getHistory()])
  },
  deleteResult(resultId: string) {
    write(STORAGE_KEYS.history, this.getHistory().filter((item) => item.resultId !== resultId))
  },
  getReasons: () => read<Record<string, ErrorReason>>(STORAGE_KEYS.errorReasons, {}),
  saveReason(resultId: string, questionId: string, reason: ErrorReason) {
    const all = this.getReasons()
    all[`${resultId}:${questionId}`] = reason
    write(STORAGE_KEYS.errorReasons, all)
  },
  getDailyReports: () => read<DailyReport[]>(STORAGE_KEYS.dailyReports, []),
  saveDailyReport(report: DailyReport) {
    const next = [report, ...this.getDailyReports().filter((item) => item.date !== report.date)].sort((a, b) => b.date.localeCompare(a.date))
    return write(STORAGE_KEYS.dailyReports, next)
  },
  deleteDailyReport(date: string) {
    return write(STORAGE_KEYS.dailyReports, this.getDailyReports().filter((item) => item.date !== date))
  },
  getSettings: () => read<UserSettings>(STORAGE_KEYS.settings, { confirmBeforeSubmit: true, passageExpanded: true }),
  saveSettings: (settings: UserSettings) => write(STORAGE_KEYS.settings, settings),
  createSyncSnapshot(): SyncSnapshot {
    const settings = this.getSettings()
    return {
      version: STORAGE_VERSION,
      importedExams: this.getImported(),
      progresses: this.getProgresses(),
      history: this.getHistory(),
      errorReasons: this.getReasons(),
      dailyReports: this.getDailyReports(),
      settings: { confirmBeforeSubmit: settings.confirmBeforeSubmit, passageExpanded: settings.passageExpanded },
    }
  },
  replaceWithSyncSnapshot(snapshot: SyncSnapshot): boolean {
    const currentSettings = this.getSettings()
    const validSnapshot = snapshot && snapshot.version === STORAGE_VERSION
    if (!validSnapshot) return false
    const values: Array<[string, unknown]> = [
      [STORAGE_KEYS.importedExams, snapshot.importedExams],
      [STORAGE_KEYS.progress, snapshot.progresses],
      [STORAGE_KEYS.history, snapshot.history],
      [STORAGE_KEYS.errorReasons, snapshot.errorReasons],
      [STORAGE_KEYS.dailyReports, snapshot.dailyReports ?? []],
      [STORAGE_KEYS.settings, { ...snapshot.settings, syncCode: currentSettings.syncCode, cloudEnabled: currentSettings.cloudEnabled } satisfies UserSettings],
    ]
    return values.every(([key, value]) => write(key, value))
  },
}

export const serializeProgress = (progress: ExamProgress) => JSON.stringify(progress)
export const restoreProgress = (raw: string): ExamProgress => JSON.parse(raw) as ExamProgress
