// ── Template service — persists paper structure configs to localStorage ──

export interface TemplateSection {
  name:       string;
  type:       string;
  count:      number;
  marks:      number;
  difficulty: string;
}

export interface PaperTemplate {
  id:        string;
  name:      string;
  duration:  string;
  sections:  TemplateSection[];
  createdAt: string;
  institutionStyle?: 'cbse' | 'tn_matric' | 'standard';
  customInstructions?: string;
  schoolName?: string;
}

const KEY = 'qpg_templates';

export function getTemplates(): PaperTemplate[] {
  try { return JSON.parse(localStorage.getItem(KEY) || '[]'); } catch { return []; }
}

export function saveTemplate(tpl: PaperTemplate): void {
  const all = getTemplates().filter(t => t.id !== tpl.id);
  localStorage.setItem(KEY, JSON.stringify([...all, tpl]));
}

export function deleteTemplate(id: string): void {
  localStorage.setItem(KEY, JSON.stringify(getTemplates().filter(t => t.id !== id)));
}

export function createTemplate(
  name: string,
  duration: string,
  sections: TemplateSection[],
  institutionStyle?: 'cbse' | 'tn_matric' | 'standard',
  customInstructions?: string,
  schoolName?: string
): PaperTemplate {
  return {
    id:        `tpl-${Date.now()}`,
    name,
    duration,
    sections:  sections.map(({ name, type, count, marks, difficulty }) =>
                 ({ name, type, count, marks, difficulty })),
    createdAt: new Date().toISOString(),
    institutionStyle,
    customInstructions,
    schoolName,
  };
}

// ── Built-in starter templates ──
export const BUILTIN_TEMPLATES: Omit<PaperTemplate, 'id' | 'createdAt'>[] = [
  {
    name:     'Standard MCQ Exam',
    duration: '60',
    sections: [
      { name: 'Section A', type: 'Multiple Choice', count: 20, marks: 1, difficulty: 'Mixed' },
    ],
  },
  {
    name:     'Mixed Format (School)',
    duration: '120',
    sections: [
      { name: 'Section A', type: 'Multiple Choice',    count: 10, marks: 1, difficulty: 'Easy'   },
      { name: 'Section B', type: 'Short Answer',        count: 8,  marks: 3, difficulty: 'Medium' },
      { name: 'Section C', type: 'Long Answer / Essay', count: 2,  marks: 10, difficulty: 'Hard'  },
    ],
  },
  {
    name:     'Quick Quiz',
    duration: '30',
    sections: [
      { name: 'Section A', type: 'True / False',  count: 5, marks: 1, difficulty: 'Easy'   },
      { name: 'Section B', type: 'Short Answer',  count: 5, marks: 2, difficulty: 'Medium' },
    ],
  },
  {
    name:     'Comprehensive Final',
    duration: '180',
    sections: [
      { name: 'Section A', type: 'Multiple Choice',    count: 20, marks: 1,  difficulty: 'Mixed'  },
      { name: 'Section B', type: 'Fill in the Blanks', count: 10, marks: 2,  difficulty: 'Medium' },
      { name: 'Section C', type: 'Short Answer',        count: 8,  marks: 5,  difficulty: 'Medium' },
      { name: 'Section D', type: 'Long Answer / Essay', count: 3,  marks: 15, difficulty: 'Hard'  },
    ],
  },
  {
    name:     'CBSE Board Blueprint (80 Marks)',
    duration: '180',
    sections: [
      { name: 'Section A (MCQs & AR)', type: 'Multiple Choice',    count: 20, marks: 1, difficulty: 'Mixed' },
      { name: 'Section B (Very Short)', type: 'Short Answer',       count: 5,  marks: 2, difficulty: 'Easy' },
      { name: 'Section C (Short)',      type: 'Short Answer',       count: 6,  marks: 3, difficulty: 'Medium' },
      { name: 'Section D (Case-Based)', type: 'Long Answer / Essay', count: 3,  marks: 4, difficulty: 'Medium' },
      { name: 'Section E (Long)',       type: 'Long Answer / Essay', count: 4,  marks: 5, difficulty: 'Hard' },
    ],
  },
  {
    name:     'Tamil Nadu Matriculation (70 Marks)',
    duration: '150',
    sections: [
      { name: 'PART - I (MCQs)',        type: 'Multiple Choice',    count: 15, marks: 1, difficulty: 'Mixed' },
      { name: 'PART - II (2 Marks)',     type: 'Short Answer',       count: 6,  marks: 2, difficulty: 'Easy' },
      { name: 'PART - III (3 Marks)',    type: 'Short Answer',       count: 6,  marks: 3, difficulty: 'Medium' },
      { name: 'PART - IV (5 Marks)',     type: 'Long Answer / Essay', count: 5,  marks: 5, difficulty: 'Hard' },
    ],
  },
];
