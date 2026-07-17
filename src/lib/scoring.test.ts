import { describe, expect, it } from 'vitest'
import type { ExamPaper } from '../types/exam'
import type { ExamProgress } from '../types/result'
import { restoreProgress, serializeProgress } from './storage'
import { isAnswerEmpty, scoreExam } from './scoring'

const exam: ExamPaper = {
  examId: 'test', title: '测试卷', subject: '逻辑推理', description: '', durationMinutes: 10, totalScore: 6, version: '1.0',
  sections: [{ sectionId: 's1', title: '形式逻辑', questions: [
    { id: 'q1', type: 'single_choice', category: '形式逻辑', knowledgePoint: '条件关系', difficulty: '基础', score: 3, question: '题1', options: [{ key: 'A', text: 'A' }, { key: 'B', text: 'B' }], correctAnswer: 'A' },
    { id: 'q2', type: 'single_choice', category: '形式逻辑', knowledgePoint: '条件关系', difficulty: '中等', score: 3, question: '题2', options: [{ key: 'A', text: 'A' }, { key: 'B', text: 'B' }], correctAnswer: 'B' },
  ] }],
}

const progress: ExamProgress = {
  examId: 'test', sessionId: 'session', currentIndex: 1, answers: { q1: 'A', q2: 'A' }, marked: ['q2'], timeByQuestion: { q1: 12, q2: 20 }, elapsedSeconds: 32, startedAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:32.000Z',
}

describe('scoreExam', () => {
  it('计算总分、正确率和分组统计', () => {
    const result = scoreExam(exam, progress)
    expect(result.score).toBe(3)
    expect(result.maxScore).toBe(6)
    expect(result.correctCount).toBe(1)
    expect(result.wrongCount).toBe(1)
    expect(result.accuracy).toBe(0.5)
    expect(result.bySection[0]).toMatchObject({ label: '形式逻辑', correct: 1, total: 2 })
    expect(result.byKnowledgePoint[0].accuracy).toBe(0.5)
    expect(result.byDifficulty).toHaveLength(2)
  })

  it('不会把未答或不可自动评分的题目误计为错误', () => {
    const mixedExam: ExamPaper = { ...exam, totalScore: 9, sections: [{ ...exam.sections[0], questions: [...exam.sections[0].questions, { id: 'q3', type: 'essay', category: '写作', knowledgePoint: '论证有效性分析', difficulty: '中等', score: 3, question: '请作答' }] }] }
    const mixedProgress: ExamProgress = { ...progress, answers: { q1: 'A', q2: [], q3: '一段答案' } }
    const result = scoreExam(mixedExam, mixedProgress)
    expect(result.correctCount).toBe(1)
    expect(result.wrongCount).toBe(0)
    expect(result.unansweredCount).toBe(1)
    expect(result.ungradedCount).toBe(1)
    expect(isAnswerEmpty([])).toBe(true)
  })
})

describe('progress persistence', () => {
  it('序列化后完整恢复答案、标记和逐题用时', () => {
    expect(restoreProgress(serializeProgress(progress))).toEqual(progress)
  })
})
