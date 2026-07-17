import { describe, expect, it } from 'vitest'
import { makeExport } from './export'
import { scoreExam } from './scoring'
import type { ExamPaper } from '../types/exam'
import type { ExamProgress } from '../types/result'

const exam: ExamPaper = { examId: 'export-test', title: '导出测试卷', subject: '逻辑推理', description: '', durationMinutes: 10, totalScore: 6, version: '1.0', sections: [{ sectionId: 's', title: '模块', questions: [
  { id: 'q1', type: 'single_choice', category: '模块', knowledgePoint: '知识点A', difficulty: '基础', score: 3, question: '第一题', options: [{ key: 'A', text: '甲' }, { key: 'B', text: '乙' }], correctAnswer: 'A' },
  { id: 'q2', type: 'single_choice', category: '模块', knowledgePoint: '知识点B', difficulty: '中等', score: 3, question: '第二题', options: [{ key: 'A', text: '甲' }, { key: 'B', text: '乙' }], correctAnswer: 'B' },
] }] }
const progress: ExamProgress = { examId: 'export-test', sessionId: 's', currentIndex: 1, answers: { q1: 'B' }, marked: [], timeByQuestion: { q1: 9 }, elapsedSeconds: 22, startedAt: '2026-07-17T00:00:00Z', updatedAt: '2026-07-17T00:00:22Z' }

describe('makeExport', () => {
  it('TXT 清楚包含汇总、知识点与未答状态', () => {
    const result = scoreExam(exam, progress, '2026-07-17T00:00:22Z')
    const txt = makeExport(result, { [`${result.resultId}:q1`]: '蒙题' }, 'txt')
    expect(txt).toContain('【AI 考研答题结果】')
    expect(txt).toContain('【知识点统计】')
    expect(txt).toContain('未答')
    expect(txt).toContain('错误原因：蒙题')
  })
})
