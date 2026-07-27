/**
 * Generates a realistic, fully anonymised sample portfolio in the app's own
 * JSON export format, ready to load through Import / Export → Import.
 *
 *   node tools/generate-sample-data.mjs [outputPath]
 *
 * Output is deterministic: the same command always produces the same file, so
 * screenshots, demos and documentation stay consistent. No real student names,
 * codes, emails or phone numbers appear anywhere in this file.
 */
import fs from 'fs'
import path from 'path'

// ── Deterministic PRNG (mulberry32) ────────────────────────────────────────
let _seed = 20260727
const rnd = () => {
  _seed |= 0
  _seed = (_seed + 0x6d2b79f5) | 0
  let t = Math.imul(_seed ^ (_seed >>> 15), 1 | _seed)
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296
}
const pick = (arr) => arr[Math.floor(rnd() * arr.length)]

// ── Faculty ────────────────────────────────────────────────────────────────

const faculty = {
  name: 'Md. Anwarul Haque',
  initials: 'MAH',
  designation: 'Assistant Professor',
  department: 'Department of CSE',
  university: 'Southeast University',
  email: 'anwarul.haque@seu.edu.bd'
}

// ── Roles drive what each student writes about, and how much ───────────────

const ROLES = {
  data: {
    label: 'data & corpus',
    done: [
      'Cleaned and de-duplicated the collected corpus, dropping malformed records and normalising encoding',
      'Extended the annotation guideline and re-annotated a disputed subset with a second annotator',
      'Built the train/validation/test split with stratification and documented the split policy',
      'Wrote the ingestion script that pulls raw records into a versioned local store',
      'Measured inter-annotator agreement on the pilot batch and summarised the disagreements',
      'Prepared the augmentation pipeline and checked that it does not leak across splits'
    ],
    planned: [
      'Finish annotating the remaining batch and freeze version 2 of the dataset',
      'Add a validation pass that rejects records failing the schema check',
      'Document the dataset card, including collection method and known gaps',
      'Rerun the split with the new records and confirm class balance holds'
    ]
  },
  model: {
    label: 'modelling',
    done: [
      'Trained the baseline model and logged the run configuration for reproducibility',
      'Implemented the proposed architecture and confirmed it trains to convergence on the pilot subset',
      'Ran an ablation over the two feature groups and tabulated the difference',
      'Tuned the learning-rate schedule and reduced the validation loss plateau',
      'Debugged the class-imbalance issue that was suppressing recall on the minority class',
      'Ported the training loop to mixed precision to fit the model in available GPU memory'
    ],
    planned: [
      'Run the full hyper-parameter sweep and pick the configuration for the report',
      'Add early stopping and checkpoint recovery to the training script',
      'Compare against the second baseline mentioned in the literature review',
      'Profile the training step to find where the bottleneck sits'
    ]
  },
  eval: {
    label: 'evaluation & analysis',
    done: [
      'Set up the evaluation harness with fixed seeds so numbers are reproducible',
      'Produced the confusion matrix and identified the two dominant error modes',
      'Ran the statistical significance test across the five seeds and recorded confidence intervals',
      'Built the error-analysis notebook and sampled failure cases for manual inspection',
      'Compared results against the two published baselines and reconciled the metric definitions',
      'Drafted the results tables and figures in the report format'
    ],
    planned: [
      'Extend the evaluation to the held-out out-of-distribution subset',
      'Write up the error analysis section with the sampled examples',
      'Add per-class breakdown to the results table',
      'Cross-check the reported metrics against a second implementation'
    ]
  },
  system: {
    label: 'system & interface',
    done: [
      'Built the API layer and wired it to the inference service',
      'Implemented the front-end screens for upload, result display and history',
      'Containerised the service and verified it starts cleanly from a fresh checkout',
      'Added request validation and error handling to the inference endpoint',
      'Set up the deployment configuration and ran a smoke test on the staging host',
      'Implemented caching so repeated queries do not re-run inference'
    ],
    planned: [
      'Add authentication and rate limiting before the demo',
      'Write the integration tests covering the three main user flows',
      'Measure end-to-end latency under a simulated ten-user load',
      'Prepare the deployment runbook for the final defence demo'
    ]
  },
  lit: {
    label: 'literature & writing',
    done: [
      'Completed the systematic literature scan and tabulated twenty-two candidate works',
      'Drafted the related-work section and mapped each cited method to our problem framing',
      'Reworked the problem statement after the feedback on scope',
      'Prepared the methodology chapter draft with the revised pipeline diagram',
      'Standardised the citation style and fixed the broken references',
      'Drafted the abstract and introduction for internal review'
    ],
    planned: [
      'Revise the related-work table to include the two recent papers found this week',
      'Complete the discussion section once the final results are in',
      'Prepare the slide deck outline for the presentation',
      'Proofread the full draft and run the similarity check'
    ]
  }
}

const NOTES = [
  'Progress on track; asked for the raw numbers to be committed alongside the notebook.',
  'Advised to narrow scope — the current plan is too broad for the remaining weeks.',
  'Good improvement since the last session. Reminded to keep the log updated.',
  'Discussed the risk of relying on a single data source; agreed on a fallback.',
  'Asked to bring reproducible results next session, not screenshots.',
  'Raised concern about uneven task distribution within the group.',
  'Suggested reading two additional papers before finalising the approach.',
  ''
]

// ── Anonymised roster pool ─────────────────────────────────────────────────
// Invented names; no correspondence to any real student.

const NAME_POOL = [
  'Arifur Rahman Shuvo', 'Tanjila Akter Mim', 'Sadman Sakib Niloy', 'Nusrat Jahan Oishi',
  'Rakibul Hasan Emon', 'Farhana Yeasmin Ripa', 'Mahmudul Karim Adnan', 'Sumaiya Islam Prova',
  'Shahriar Alam Tanim', 'Jarin Tasnim Nowrin', 'Ashraful Islam Rifat', 'Maliha Rahman Tisha',
  'Naimur Rahman Joy', 'Sabrina Sultana Meem', 'Tahmid Hossain Antor', 'Rifah Tasnia Anika',
  'Imran Kabir Shanto', 'Nafisa Anjum Ridi', 'Zubayer Ahmed Fahim', 'Mounota Binte Karim',
  'Sakib Al Hasan Turjo', 'Anika Tabassum Nishi', 'Redwan Ahmed Siam', 'Sanjida Akter Bristy',
  'Mehedi Hasan Rabbi', 'Tasnim Jahan Meghla', 'Fahim Faisal Ovi', 'Israt Jahan Mou'
]

let nameCursor = 0
let codeCursor = 0
/** SEU student codes are exactly 13 digits: a 10-digit batch prefix + a 3-digit serial */
const nextStudent = (batchPrefix) => {
  const name = NAME_POOL[nameCursor++ % NAME_POOL.length]
  const serial = String(103 + codeCursor * 17).slice(-3).padStart(3, '0')
  const code = `${batchPrefix}${serial}`
  codeCursor++
  return {
    student_id: code,
    name,
    program: 'B.Sc. in CSE',
    email: `${code}@seu.edu.bd`,
    mobile: `+8801${String(700000000 + codeCursor * 1234567).slice(0, 9)}`
  }
}

// ── Group definitions ──────────────────────────────────────────────────────

const addDays = (iso, n) => {
  const d = new Date(iso)
  d.setDate(d.getDate() + n)
  return d.toISOString().split('T')[0]
}

/**
 * attendance: per-student array of 0/1 aligned to the session list, or a
 * probability if left undefined.
 */
const GROUPS = [
  {
    group_name: 'Group A1',
    project_title: 'VERITAS-LENS: AI-Generated Text Detection and Authorship Verification',
    course_code: 'CSE460',
    semester: 'Spring 2026',
    academic_year: '2025-26',
    batchPrefix: '2023100000',
    status: 'active',
    min_required_sessions: 8,
    roles: ['data', 'model', 'eval', 'lit'],
    start: '2026-04-21',
    // Mirrors the meeting rhythm on the departmental sheet this sample is modelled on
    offsets: [0, 14, 21, 28, 47, 61, 83, 85],
    topics: [
      'Discussion on research topic',
      'Finalizing the research idea',
      'Idea finalization with methodology confirmation',
      'Summary on literature review and experiment feasibility analysis',
      'Preparation of plan on progress deadlines',
      'Update on preparation for experimental setup',
      'Summarizing topics to prepare for presentation and report',
      'Report and presentation preparation'
    ],
    attendance: [
      [1, 1, 1, 1, 1, 1, 1, 1],
      [1, 1, 1, 1, 0, 1, 1, 1],
      [1, 1, 1, 1, 1, 1, 1, 1],
      [1, 0, 1, 1, 1, 1, 0, 1]
    ]
  },
  {
    group_name: 'Group A2',
    project_title: 'Bangla Regional Dialect Recognition for Public Service Kiosks',
    course_code: 'CSE460',
    semester: 'Spring 2026',
    academic_year: '2025-26',
    batchPrefix: '2023100000',
    status: 'active',
    min_required_sessions: 8,
    roles: ['data', 'model', 'system'],
    start: '2026-04-22',
    offsets: [0, 13, 27, 41, 56, 70, 84],
    topics: [
      'Scoping the dialect set and defining the recognition task',
      'Review of speech corpora available for Bangla dialects',
      'Recording protocol and consent procedure for field collection',
      'Feature extraction pipeline and baseline acoustic model',
      'Mid-semester progress review against the submitted plan',
      'Kiosk interface requirements and offline inference constraints',
      'Consolidation of results and report structure'
    ],
    attendance: [
      [1, 1, 1, 1, 1, 1, 1],
      [1, 1, 0, 0, 1, 1, 1],
      [1, 0, 0, 0, 1, 0, 1]
    ]
  },
  {
    group_name: 'Group A3',
    project_title: 'Rooftop Hydroponics Monitoring with Low-Cost IoT Sensors',
    course_code: 'CSE460',
    semester: 'Spring 2026',
    academic_year: '2025-26',
    batchPrefix: '2023100000',
    status: 'active',
    min_required_sessions: 8,
    roles: ['system', 'data', 'eval', 'lit', 'model'],
    start: '2026-03-10',
    offsets: [0, 12, 26, 40, 61, 84],
    topics: [
      'Problem framing and survey of existing hydroponics monitoring kits',
      'Sensor selection, calibration plan and bill of materials',
      'Enclosure design and power budget for the rooftop deployment',
      'Firmware milestone review and data-logging format',
      'Field deployment issues: connectivity drops and sensor drift',
      'Replanning after hardware delay; revised milestone dates'
    ],
    attendance: [
      [1, 1, 1, 1, 1, 1],
      [1, 1, 1, 0, 1, 1],
      [1, 1, 0, 0, 0, 1],
      [1, 0, 1, 1, 1, 0],
      [1, 1, 1, 1, 1, 1]
    ]
  },
  {
    group_name: 'Group B1',
    project_title: 'Vision-Based Queue Analytics for Hospital Outpatient Departments',
    course_code: 'CSE461',
    semester: 'Spring 2026',
    academic_year: '2025-26',
    batchPrefix: '2022100000',
    status: 'active',
    min_required_sessions: 8,
    co_supervisor_name: 'Nusrat Hoque',
    co_supervisor_designation: 'Lecturer',
    roles: ['model', 'system', 'eval', 'data', 'lit'],
    start: '2026-03-03',
    offsets: [0, 10, 21, 31, 45, 59, 73, 87, 101],
    topics: [
      'Carry-over review of FYDP I outcomes and design objectives',
      'Detection and tracking architecture selection',
      'Privacy handling: on-device blurring and retention policy',
      'Design freeze and interface contract between modules',
      'Integration checkpoint and first end-to-end run',
      'Validation protocol against manually counted ground truth',
      'Performance tuning for the target edge device',
      'Design validation report and defect log review',
      'Report consolidation and demonstration rehearsal'
    ],
    attendance: [
      [1, 1, 1, 1, 1, 1, 1, 1, 1],
      [1, 1, 1, 1, 1, 0, 1, 1, 1],
      [1, 1, 1, 1, 1, 1, 1, 1, 1],
      [1, 1, 0, 1, 1, 1, 1, 0, 1],
      [1, 1, 1, 1, 0, 1, 1, 1, 1]
    ]
  },
  {
    group_name: 'Group B2',
    project_title: 'Federated Learning for Bengali Handwriting Recognition on Edge Devices',
    course_code: 'CSE461',
    semester: 'Spring 2026',
    academic_year: '2025-26',
    batchPrefix: '2022100000',
    status: 'active',
    min_required_sessions: 8,
    roles: ['model', 'system', 'lit'],
    start: '2026-03-18',
    offsets: [0, 14, 28, 42, 56, 70, 84, 98],
    topics: [
      'Recap of FYDP I baseline and federated design objectives',
      'Client simulation harness and aggregation strategy',
      'Non-IID partitioning scheme and its effect on convergence',
      'Communication cost measurement and compression options',
      'Design review: security assumptions and threat model',
      'Integration of the on-device inference path',
      'Validation runs across simulated client counts',
      'Report drafting and figure preparation'
    ],
    // Deliberately uneven documentation to demonstrate the imbalance flag
    verbosity: [1.6, 1.0, 0.35],
    attendance: [
      [1, 1, 1, 1, 1, 1, 1, 1],
      [1, 1, 1, 1, 1, 1, 1, 1],
      [1, 1, 1, 0, 1, 1, 1, 1]
    ]
  },
  {
    group_name: 'Group C1',
    project_title: 'Deployment of a Bangla Legal-Document Summarizer for District Court Registries',
    course_code: 'CSE462',
    semester: 'Spring 2026',
    academic_year: '2025-26',
    batchPrefix: '2022100000',
    status: 'active',
    min_required_sessions: 8,
    co_supervisor_name: 'Nusrat Hoque',
    co_supervisor_designation: 'Lecturer',
    roles: ['system', 'eval', 'model', 'lit'],
    start: '2026-02-24',
    offsets: [0, 12, 24, 38, 52, 66, 80, 94, 108, 122],
    topics: [
      'Deployment scope, stakeholder list and success criteria',
      'Pilot site requirements and data-handling agreement',
      'Production hardening checklist and monitoring plan',
      'User acceptance testing protocol with registry staff',
      'First pilot week: observations and defect triage',
      'Cost model and sustainability plan for continued operation',
      'Professional practice: licensing, attribution and ethics review',
      'Industry-alignment review ahead of the external examiner',
      'Market-readiness assessment and handover documentation',
      'Final defence rehearsal and deliverable checklist'
    ],
    attendance: [
      [1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
      [1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
      [1, 1, 1, 1, 0, 1, 1, 1, 1, 1],
      [1, 1, 1, 1, 1, 1, 0, 1, 1, 1]
    ]
  },
  {
    group_name: 'Group P1',
    project_title: 'Crowd-Sourced Road Damage Reporting with Geospatial Clustering',
    course_code: 'CSE460',
    semester: 'Fall 2025',
    academic_year: '2025-26',
    batchPrefix: '2022100000',
    status: 'completed',
    min_required_sessions: 8,
    roles: ['data', 'system', 'eval', 'lit'],
    start: '2025-09-15',
    offsets: [0, 14, 28, 42, 56, 70, 84, 91],
    topics: [
      'Topic selection and scoping of the reporting problem',
      'Review of existing citizen-reporting platforms',
      'Data model for reports, photographs and geotags',
      'Clustering approach for duplicate report detection',
      'Progress review against the submitted milestone plan',
      'Pilot data collection on two municipal wards',
      'Result consolidation and limitation analysis',
      'Report submission and presentation rehearsal'
    ],
    attendance: [
      [1, 1, 1, 1, 1, 1, 1, 1],
      [1, 1, 1, 1, 1, 1, 1, 1],
      [1, 1, 0, 1, 1, 1, 1, 1],
      [1, 1, 1, 1, 1, 0, 1, 1]
    ]
  }
]

const VENUES = ['Room 401', 'Room 512', 'CSE Lab 2', 'Faculty Room B', 'Research Lab (6th floor)']

// ── Build ──────────────────────────────────────────────────────────────────

const buildGroup = (def) => {
  const students = def.roles.map(() => nextStudent(def.batchPrefix))
  const sessions = def.offsets.map((offset, i) => {
    const logDate = addDays(def.start, offset)
    const nextDate = i + 1 < def.offsets.length ? addDays(def.start, def.offsets[i + 1]) : ''
    const startHour = 10 + (i % 3)
    const start_time = `${String(startHour).padStart(2, '0')}:00`
    const end_time = `${String(startHour + 1).padStart(2, '0')}:00`

    const studentLogs = students.map((st, si) => {
      const present = def.attendance[si][i]
      if (!present)
        return {
          student_code: st.student_id,
          student_name: st.name,
          present: 0,
          work_done: '',
          work_planned: '',
          faculty_notes: ''
        }

      const role = ROLES[def.roles[si]]
      const verbosity = def.verbosity?.[si] ?? 1
      const doneParts = [pick(role.done)]
      if (verbosity > 1.3) doneParts.push(pick(role.done))
      const done = verbosity < 0.5 ? pick(role.done).split(',')[0] : doneParts.join('. ')

      // Real logbooks are not perfectly filled in — leave some entries blank so
      // the documentation-completeness metric has something to measure.
      const skipWork = rnd() < (verbosity < 0.5 ? 0.42 : 0.1)

      return {
        student_code: st.student_id,
        student_name: st.name,
        present: 1,
        work_done: skipWork ? '' : done + '.',
        work_planned: skipWork || (verbosity < 0.5 && rnd() < 0.6) ? '' : pick(role.planned) + '.',
        faculty_notes: rnd() < 0.28 ? pick(NOTES) : ''
      }
    })

    return {
      log_date: logDate,
      next_log_date: nextDate,
      venue: pick(VENUES),
      start_time,
      end_time,
      duration_minutes: 60,
      topic: def.topics[i],
      session_kind: i === def.offsets.length - 1 ? 'presentation' : i === 4 ? 'milestone' : 'regular',
      studentLogs
    }
  })

  return {
    group_name: def.group_name,
    project_title: def.project_title,
    course_code: def.course_code,
    semester: def.semester,
    academic_year: def.academic_year,
    co_supervisor_name: def.co_supervisor_name ?? null,
    co_supervisor_designation: def.co_supervisor_designation ?? null,
    min_required_sessions: def.min_required_sessions,
    status: def.status,
    students,
    sessions,
    reports: []
  }
}

const payload = {
  _meta: {
    exportedAt: new Date('2026-07-27T09:00:00Z').toISOString(),
    version: '2.0',
    app: 'SEU FYDP Logger',
    note: 'Synthetic sample portfolio. All names, student codes, emails and phone numbers are invented.'
  },
  faculty,
  groups: GROUPS.map(buildGroup),
  settings: {}
}

const out = process.argv[2] ?? path.join('sample-data', 'fydp-sample-portfolio.json')
fs.mkdirSync(path.dirname(out), { recursive: true })
fs.writeFileSync(out, JSON.stringify(payload, null, 2), 'utf-8')

const students = payload.groups.reduce((a, g) => a + g.students.length, 0)
const sessions = payload.groups.reduce((a, g) => a + g.sessions.length, 0)
console.log(`Wrote ${out}`)
console.log(`  ${payload.groups.length} groups · ${students} students · ${sessions} sessions`)
