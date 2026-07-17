import { flattenExam, type AnswerValue, type ExamPaper } from '../types/exam'
import type { AccuracyGroup, ExamProgress, ExamResult, QuestionResult } from '../types/result'

export const answersEqual = (answer?: AnswerValue, correct?: AnswerValue) => {
  if (answer === undefined || correct === undefined) return false
  if (Array.isArray(answer) && Array.isArray(correct)) {
    return [...answer].sort().join('|') === [...correct].sort().join('|')
  }
  return answer === correct
}

const groupResults = (results: QuestionResult[], key: keyof Pick<QuestionResult, 'category' | 'knowledgePoint' | 'difficulty'>): AccuracyGroup[] => {
  const groups = new Map<string, QuestionResult[]>()
  results.filter((r) => r.isCorrect !== null).forEach((result) => {
    const label = result[key]
    groups.set(label, [...(groups.get(label) ?? []), result])
  })
  return [...groups.entries()].map(([label, items]) => {
    const correct = items.filter((item) => item.isCorrect).length
    const earnedScore = items.reduce((sum, item) => sum + item.earnedScore, 0)
    const maxScore = items.reduce((sum, item) => sum + item.maxScore, 0)
    return { label, correct, total: items.length, earnedScore, maxScore, accuracy: items.length ? correct / items.length : 0 }
  })
}

export const scoreExam = (exam: ExamPaper, progress: ExamProgress, submittedAt = new Date().toISOString()): ExamResult => {
  const allowed = progress.questionIds ? new Set(progress.questionIds) : null
  const flat = flattenExam(exam).filter(({ question }) => !allowed || allowed.has(question.id))
  const questionResults: QuestionResult[] = flat.map(({ question }) => {
    const userAnswer = progress.answers[question.id]
    const isGradable = question.type === 'single_choice'
    const isCorrect = isGradable ? answersEqual(userAnswer, question.correctAnswer) : null
    return {
      questionId: question.id,
      userAnswer,
      correctAnswer: question.correctAnswer,
      isCorrect,
      earnedScore: isCorrect ? question.score : 0,
      maxScore: question.score,
      timeSeconds: progress.timeByQuestion[question.id] ?? 0,
      category: question.category,
      knowledgePoint: question.knowledgePoint,
      difficulty: question.difficulty,
      marked: progress.marked.includes(question.id),
    }
  })
  const gradable = questionResults.filter((item) => item.isCorrect !== null)
  const correctCount = gradable.filter((item) => item.isCorrect).length
  const wrongCount = gradable.filter((item) => item.userAnswer !== undefined && !item.isCorrect).length
  const unansweredCount = questionResults.filter((item) => item.userAnswer === undefined || item.userAnswer === '').length
  const score = questionResults.reduce((sum, item) => sum + item.earnedScore, 0)
  const maxScore = questionResults.reduce((sum, item) => sum + item.maxScore, 0)
  return {
    resultId: `${exam.examId}-${Date.now()}`,
    sessionId: progress.sessionId,
    examId: exam.examId,
    examSnapshot: exam,
    title: exam.title,
    subject: exam.subject,
    submittedAt,
    score,
    maxScore,
    correctCount,
    wrongCount,
    unansweredCount,
    ungradedCount: questionResults.filter((item) => item.isCorrect === null).length,
    accuracy: gradable.length ? correctCount / gradable.length : 0,
    elapsedSeconds: progress.elapsedSeconds,
    answers: progress.answers,
    marked: progress.marked,
    timeByQuestion: progress.timeByQuestion,
    questionResults,
    bySection: groupResults(questionResults, 'category'),
    byKnowledgePoint: groupResults(questionResults, 'knowledgePoint'),
    byDifficulty: groupResults(questionResults, 'difficulty'),
    questionIds: progress.questionIds,
  }
}
