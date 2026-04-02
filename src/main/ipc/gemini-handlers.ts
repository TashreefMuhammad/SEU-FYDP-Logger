import { ipcMain } from 'electron'
import { all } from '../db'

export function registerGeminiHandlers(): void {
  ipcMain.handle('gemini:generate', async (_e, type: string, payload: any) => {
    const settings = Object.fromEntries(
      all('SELECT key, value FROM settings').map((r: any) => [r.key, r.value])
    )
    const apiKey: string = settings['gemini_api_key'] ?? ''
    if (!apiKey) throw new Error('Gemini API key not configured. Go to Settings to add it.')

    // Lazy-load to keep it out of the main bundle until needed
    const { GoogleGenerativeAI } = await import('@google/generative-ai')
    const genAI = new GoogleGenerativeAI(apiKey)
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' })

    const prompt = buildPrompt(type, payload)
    const result = await model.generateContent(prompt)
    return result.response.text()
  })
}

function buildPrompt(type: string, p: any): string {
  const facultyBlock = p.faculty
    ? `Supervisor: ${p.faculty.name} (${p.faculty.initials}), ${p.faculty.designation}, ${p.faculty.department}, ${p.faculty.university}`
    : ''

  switch (type) {
    case 'attendance':
      return `You are a formal university report writer. Generate a professional FYDP (Final Year Design Project) Attendance Report in Markdown format.

${facultyBlock}
Group: ${p.group.group_name}
Project Title: ${p.group.project_title ?? 'N/A'}
Semester/Year: ${p.group.semester ?? ''} ${p.group.academic_year ?? ''}

Attendance Data (each session):
${JSON.stringify(p.sessions, null, 2)}

Instructions:
- Start with a formal header (Supervisor name, initials, Group, Project Title, Semester, Date Generated)
- Include a table: Session Date | Student ID | Student Name | Present/Absent
- Include an overall attendance percentage per student
- Write a brief attendance summary paragraph
- Keep the tone formal and academic
- Use Markdown formatting`

    case 'progress':
      return `You are a university project supervisor assistant. Generate a detailed FYDP Progress Report in Markdown format.

${facultyBlock}
Group: ${p.group.group_name}
Project Title: ${p.group.project_title ?? 'N/A'}
Semester/Year: ${p.group.semester ?? ''} ${p.group.academic_year ?? ''}

Log Entries (chronological):
${JSON.stringify(p.sessions, null, 2)}

Instructions:
- Write a formal progress report header
- For each student, summarize what they accomplished across all sessions
- Identify the overall project timeline and progress
- Highlight any notable achievements or concerns
- Write a brief overall assessment paragraph
- Keep the tone formal and constructive
- Use Markdown formatting`

    case 'contribution':
      return `You are a university project evaluation assistant. Analyze each student's contribution to the FYDP project and generate a Contribution Analysis Report in Markdown format.

${facultyBlock}
Group: ${p.group.group_name}
Project Title: ${p.group.project_title ?? 'N/A'}

Log Entries:
${JSON.stringify(p.sessions, null, 2)}

Instructions:
- Write a formal header
- For each student: summarize their contributions, estimate percentage contribution (total must add to ~100%), and note strengths
- Create a contribution summary table: Student ID | Name | Estimated Contribution % | Key Contributions
- Write a brief overall group assessment
- Keep tone formal and balanced
- Use Markdown formatting`

    case 'summary':
      return `You are a university supervisor assistant. Generate a concise FYDP Supervision Summary Report in Markdown format.

${facultyBlock}
Group: ${p.group.group_name}
Project Title: ${p.group.project_title ?? 'N/A'}

All Log Data:
${JSON.stringify(p.sessions, null, 2)}

Instructions:
- Formal header with all faculty/group details
- Executive summary paragraph (3-4 sentences)
- Key milestones achieved
- Current project status assessment
- Recommendations for next steps
- Use Markdown formatting`

    default:
      return `Summarize the following FYDP log data in a formal Markdown report:\n${JSON.stringify(p, null, 2)}`
  }
}
