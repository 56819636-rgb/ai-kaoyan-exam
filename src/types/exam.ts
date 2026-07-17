export type Subject = '管综数学' | '逻辑推理' | '英语二' | '综合模拟' | string
export type QuestionType = 'single_choice' | 'multiple_choice' | 'fill_blank' | 'translation' | 'essay'
export type Difficulty = '基础' | '中等' | '困难' | string
export type OptionKey = 'A' | 'B' | 'C' | 'D' | 'E' | string
export type AnswerValue = string | string[]

export interface ExamOption {
  key: OptionKey
  text: string
}

export interface ExamQuestion {
  id: string
  type: QuestionType
  category: string
  knowledgePoint: string
  difficulty: Difficulty
  score: number
  question: string
  options?: ExamOption[]
  correctAnswer?: AnswerValue
  explanation?: string
}

export interface ExamSection {
  sectionId: string
  title: string
  passage?: string
  questions: ExamQuestion[]
}

export interface ExamPaper {
  examId: string
  title: string
  subject: Subject
  description: string
  durationMinutes: number
  totalScore: number
  version: string
  sections: ExamSection[]
}

export interface FlatQuestion {
  sectionId: string
  sectionTitle: string
  passage?: string
  question: ExamQuestion
}

export const flattenExam = (exam: ExamPaper): FlatQuestion[] =>
  exam.sections.flatMap((section) =>
    section.questions.map((question) => ({
      sectionId: section.sectionId,
      sectionTitle: section.title,
      passage: section.passage,
      question,
    })),
  )

export const examQuestionCount = (exam: ExamPaper) => flattenExam(exam).length
