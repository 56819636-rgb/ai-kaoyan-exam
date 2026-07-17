import type { AnswerValue, ExamPaper } from './exam'

export type ErrorReason =
  | '完全不会'
  | '知识点遗忘'
  | '方法选择错误'
  | '计算粗心'
  | '题意误读'
  | '时间不足'
  | '蒙题'
  | '其他'

export interface ExamProgress {
  examId: string
  sessionId: string
  currentIndex: number
  answers: Record<string, AnswerValue>
  marked: string[]
  timeByQuestion: Record<string, number>
  elapsedSeconds: number
  startedAt: string
  updatedAt: string
  questionIds?: string[]
}

export interface QuestionResult {
  questionId: string
  userAnswer?: AnswerValue
  correctAnswer?: AnswerValue
  isCorrect: boolean | null
  earnedScore: number
  maxScore: number
  timeSeconds: number
  category: string
  knowledgePoint: string
  difficulty: string
  marked: boolean
}

export interface AccuracyGroup {
  label: string
  correct: number
  total: number
  earnedScore: number
  maxScore: number
  accuracy: number
}

export interface ExamResult {
  resultId: string
  sessionId: string
  examId: string
  examSnapshot: ExamPaper
  title: string
  subject: string
  submittedAt: string
  score: number
  maxScore: number
  correctCount: number
  wrongCount: number
  unansweredCount: number
  ungradedCount: number
  accuracy: number
  elapsedSeconds: number
  answers: Record<string, AnswerValue>
  marked: string[]
  timeByQuestion: Record<string, number>
  questionResults: QuestionResult[]
  bySection: AccuracyGroup[]
  byKnowledgePoint: AccuracyGroup[]
  byDifficulty: AccuracyGroup[]
  questionIds?: string[]
}

export interface UserSettings {
  confirmBeforeSubmit: boolean
  passageExpanded: boolean
}
