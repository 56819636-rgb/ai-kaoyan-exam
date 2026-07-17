import type { ExamPaper } from '../types/exam'
import type { ErrorReason, ExamProgress, ExamResult, UserSettings } from '../types/result'

export const STORAGE_VERSION = 1
const prefix = `ai-kaoyan:v${STORAGE_VERSION}:`

export const STORAGE_KEYS = {
  version: 'ai-kaoyan:storage-version',
  importedExams: `${prefix}imported-exams`,
  progress: `${prefix}exam-progress`,
  history: `${prefix}exam-history`,
  errorReasons: `${prefix}error-reasons`,
  settings: `${prefix}settings`,
} as const

const canUseStorage = () => typeof localStorage !== 'undefined'

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
  getSettings: () => read<UserSettings>(STORAGE_KEYS.settings, { confirmBeforeSubmit: true, passageExpanded: true }),
  saveSettings: (settings: UserSettings) => write(STORAGE_KEYS.settings, settings),
}

export const serializeProgress = (progress: ExamProgress) => JSON.stringify(progress)
export const restoreProgress = (raw: string): ExamProgress => JSON.parse(raw) as ExamProgress
