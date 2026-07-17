import type { ExamPaper, ExamQuestion, ExamSection } from '../types/exam'

const questionTypes = ['single_choice', 'multiple_choice', 'fill_blank', 'translation', 'essay']

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const requireString = (obj: Record<string, unknown>, key: string, path: string, errors: string[]) => {
  if (typeof obj[key] !== 'string' || !(obj[key] as string).trim()) errors.push(`${path}.${key} 必须是非空文本`)
}

const validateQuestion = (value: unknown, path: string, errors: string[]): value is ExamQuestion => {
  if (!isObject(value)) {
    errors.push(`${path} 必须是对象`)
    return false
  }
  for (const key of ['id', 'type', 'category', 'knowledgePoint', 'difficulty', 'question']) {
    requireString(value, key, path, errors)
  }
  if (!questionTypes.includes(String(value.type))) errors.push(`${path}.type 是不支持的题型`)
  if (typeof value.score !== 'number' || value.score <= 0) errors.push(`${path}.score 必须是大于 0 的数字`)
  if (value.type === 'single_choice' || value.type === 'multiple_choice') {
    if (!Array.isArray(value.options) || value.options.length < 2 || value.options.length > 5) {
      errors.push(`${path}.options 必须包含 2 至 5 个选项`)
    } else {
      value.options.forEach((option, index) => {
        const optionPath = `${path}.options[${index}]`
        if (!isObject(option)) errors.push(`${optionPath} 必须是对象`)
        else {
          requireString(option, 'key', optionPath, errors)
          requireString(option, 'text', optionPath, errors)
        }
      })
    }
  }
  if (value.type === 'single_choice' && typeof value.correctAnswer !== 'string') {
    errors.push(`${path}.correctAnswer 必须是选项字母`)
  } else if (value.type === 'single_choice' && Array.isArray(value.options)) {
    const keys = value.options.filter(isObject).map((option) => option.key)
    if (!keys.includes(value.correctAnswer)) errors.push(`${path}.correctAnswer 必须对应一个已有选项`)
    if (new Set(keys).size !== keys.length) errors.push(`${path}.options 的 key 不能重复`)
  }
  return true
}

const validateSection = (value: unknown, path: string, errors: string[]): value is ExamSection => {
  if (!isObject(value)) {
    errors.push(`${path} 必须是对象`)
    return false
  }
  requireString(value, 'sectionId', path, errors)
  requireString(value, 'title', path, errors)
  if (value.passage !== undefined && typeof value.passage !== 'string') errors.push(`${path}.passage 必须是文本`)
  if (!Array.isArray(value.questions) || value.questions.length === 0) errors.push(`${path}.questions 至少需要一道题`)
  else value.questions.forEach((question, index) => validateQuestion(question, `${path}.questions[${index}]`, errors))
  return true
}

export const validateExam = (value: unknown): { ok: true; exam: ExamPaper } | { ok: false; errors: string[] } => {
  const errors: string[] = []
  if (!isObject(value)) return { ok: false, errors: ['JSON 根节点必须是对象'] }
  for (const key of ['examId', 'title', 'subject', 'description', 'version']) requireString(value, key, '试卷', errors)
  if (typeof value.durationMinutes !== 'number' || value.durationMinutes <= 0) errors.push('试卷.durationMinutes 必须是大于 0 的数字')
  if (typeof value.totalScore !== 'number' || value.totalScore <= 0) errors.push('试卷.totalScore 必须是大于 0 的数字')
  if (!Array.isArray(value.sections) || value.sections.length === 0) errors.push('试卷.sections 至少需要一个模块')
  else value.sections.forEach((section, index) => validateSection(section, `试卷.sections[${index}]`, errors))

  const ids: string[] = []
  if (Array.isArray(value.sections)) {
    value.sections.forEach((section) => {
      if (isObject(section) && Array.isArray(section.questions)) {
        section.questions.forEach((q) => { if (isObject(q) && typeof q.id === 'string') ids.push(q.id) })
      }
    })
  }
  if (new Set(ids).size !== ids.length) errors.push('题目 id 不能重复')
  if (Array.isArray(value.sections) && typeof value.totalScore === 'number') {
    const scoreSum = value.sections.reduce((sum, section) => {
      if (!isObject(section) || !Array.isArray(section.questions)) return sum
      return sum + section.questions.reduce((sectionSum, question) => sectionSum + (isObject(question) && typeof question.score === 'number' ? question.score : 0), 0)
    }, 0)
    if (scoreSum !== value.totalScore) errors.push(`试卷.totalScore（${value.totalScore}）与题目分值合计（${scoreSum}）不一致`)
  }
  return errors.length ? { ok: false, errors } : { ok: true, exam: value as unknown as ExamPaper }
}

export const parseExamJson = (text: string) => {
  try {
    return validateExam(JSON.parse(text))
  } catch (error) {
    const message = error instanceof Error ? error.message : '未知解析错误'
    return { ok: false as const, errors: [`JSON 语法错误：${message}`] }
  }
}
