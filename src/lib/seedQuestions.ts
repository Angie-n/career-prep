import type { PromptCategory, Question } from './types'
import { BEHAVIORAL_CATEGORY_ID } from './types'

const PROMPTS = [
  'Tell me about yourself.',
  "Tell me about a project you're proud of.",
  'Tell me about a time you failed, and what you did next.',
  'Tell me about a time you had a conflict with a coworker.',
  'Tell me about a time you disagreed with your manager.',
  'Tell me about a time you received critical feedback.',
  'Tell me about a time you had to learn something quickly.',
  'Tell me about a time you had to meet a tight deadline.',
  'Tell me about a time you showed leadership.',
  'Tell me about a time you made a mistake at work.',
  'Tell me about a time you had to make a decision with incomplete information.',
  'Tell me about a time you influenced others without having authority.',
  'Tell me about a time you juggled competing priorities.',
  'Tell me about a time you went beyond your job description.',
  'Tell me about a time you had to explain something technical to a non-technical audience.',
  'Tell me about a time you owned something end to end.',
  'Tell me about a time you had to give difficult feedback.',
  'Tell me about a time you worked with a difficult teammate.',
  'Tell me about a time you had to push back on a request.',
  'Walk me through a challenge you overcame.',
]

export const SEED_BEHAVIORAL_CATEGORY: PromptCategory = {
  id: BEHAVIORAL_CATEGORY_ID,
  title: 'Behavioral',
  description:
    'Classic “tell me about a time…” prompts. Edit, remove, or add your own.',
  builtin: true,
  createdAt: '2020-01-01T00:00:00.000Z',
  updatedAt: '2020-01-01T00:00:00.000Z',
}

export const SEED_QUESTIONS: Question[] = PROMPTS.map((prompt, i) => ({
  id: `q-beh-${i + 1}`,
  prompt,
  custom: false,
  categoryId: BEHAVIORAL_CATEGORY_ID,
}))
