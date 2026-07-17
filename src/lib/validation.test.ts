import { describe, expect, it } from 'vitest'
import { parseExamJson, validateExam } from './validation'

describe('exam validation', () => {
  it('为无效 JSON 返回中文语法提示', () => {
    const result = parseExamJson('{"examId":')
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.errors[0]).toContain('JSON 语法错误')
  })

  it('指出单选答案不在选项中和总分不一致', () => {
    const result = validateExam({
      examId: 'bad', title: '错误卷', subject: '逻辑推理', description: '测试', durationMinutes: 10, totalScore: 9, version: '1.0',
      sections: [{ sectionId: 's1', title: '模块', questions: [{ id: 'q1', type: 'single_choice', category: '逻辑', knowledgePoint: '条件', difficulty: '基础', score: 3, question: '题目', options: [{ key: 'A', text: '选项A' }, { key: 'B', text: '选项B' }], correctAnswer: 'C' }] }],
    })
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.errors).toContain('试卷.sections[0].questions[0].correctAnswer 必须对应一个已有选项')
      expect(result.errors).toContain('试卷.totalScore（9）与题目分值合计（3）不一致')
    }
  })
})
