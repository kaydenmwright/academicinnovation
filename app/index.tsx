/**
 * URL parameter documentation
 *
 * - `major`: The first two characters are used to look up major-specific DFW
 *   rates in `dfwRatesByMajor`.
 * - `defaults`: Either `ca` (for Curricular Analytics, which should match their
 *   original visualization) or `ucsd` (Carlos' preferred defaults).
 * - `hide-panel`: Whether to hide the side panel.
 * - `title`: A title to show at the top of the side panel.
 *
 * The URL fragment is used to store the degree plan to render.
 */

declare const VERSION: string

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App, CourseStats } from './App'
import { csvStringToDegreePlan } from './util/parse-degree-plan'

// these are probably not protected data
import waitlists from '../../curricular-analytics-exploration/files/protected/summarize_waitlist.json'
import frequencies from '../../curricular-analytics-exploration/files/protected/summarize_frequency.json'

type CourseDfwRates = {
  [majorSubject: string]: number | undefined
  allMajors: number
}

const protectedData = VERSION !== 'public'
let dfwRatesByMajor: Record<string, CourseDfwRates>
let equityGapsByMajor: Record<string, Record<string, string>> = {}
let transferEquityGap: Record<string, Record<string, boolean>> = {}
let majorToDept: Record<string, string> = {}
if (protectedData) {
  dfwRatesByMajor = (
    await import(
      '../../curricular-analytics-exploration/files/protected/summarize_dfw_by_major.json'
    )
  ).default
  equityGapsByMajor = (
    await import(
      '../../curricular-analytics-exploration/files/protected/summarize_equity_by_major.json'
    )
  ).default
  transferEquityGap = (
    await import(
      '../../curricular-analytics-exploration/files/protected/summarize_transfer_gap.json'
    )
  ).default
  majorToDept = (
    await import(
      '../../curricular-analytics-exploration/files/protected/summarize_major_to_dept.json'
    )
  ).default
  // TODO: removed allMajor from equity gaps
} else {
  dfwRatesByMajor = (
    await import(
      '../../curricular-analytics-exploration/files/summarize_dfw_public.json'
    )
  ).default
}

// https://curricularanalytics.org/degree_plans/11085
// import example from './data/example.json'
// https://curricularanalytics.org/degree_plans/25144
import example from './data/SY-Degree Plan-Eighth-EC27.csv'
// https://curricularanalytics.org/degree_plans/25403
// import example from './data/EC27.json'

const params = new URL(window.location.href).searchParams
const sourceUrl = params.get('from')
const { name, degreePlan, reqTypes, planType } = csvStringToDegreePlan(
  window.location.hash.length > 1
    ? decodeURIComponent(window.location.hash.slice(1))
    : sourceUrl
      ? await fetch(
        new URL(
          sourceUrl,
          'https://raw.githubusercontent.com/SheepTester-forks/ucsd-degree-plans/main/'
        )
      )
        .then(r =>
          r.ok
            ? r.text()
            : Promise.reject(new Error(`HTTP ${r.status} error: ${r.url}`))
        )
        .catch(error => {
          alert(
            `There was an issue loading the selected plan.\n\n${
              error.stack ?? error.message ?? error
            }`
          )
          console.error(error)
          return example
        })
      : example
)
const majorSubject = params.get('major')?.slice(0, 2) ?? ''
const department = majorToDept[majorSubject] ?? ''

function getStats (courseName: string): CourseStats {
  const nameToCode: Record<string, string> = {
    'Principles of Microeconomics': 'ECON2000',
    'English Composition I': 'ENGL1001',
    'College Algebra': 'MATH1021',
    'Introductory Financial Accounting': 'ACCT2001',
    'Introduction to Management Information Systems for Business Majors': 'ISDS1102',
    'Calculus with Business and Economic Applications': 'MATH1431',
    'Principles of Macroeconomics': 'ECON2010',
    'Business Statistics and Analytics I': 'ISDS2000',
    'Introductory Managerial Accounting': 'ACCT2101',
    'Money, Banking and Macroeconomic Activity': 'ECON2035',
    'English Composition II': 'ENGL2000',
    'Business Statistics and Analytics II': 'ISDS2001',
    'Intermediate Accounting Part I': 'ACCT3001',
    'Accounting Analytics': 'ACCT3025',
    'Principles of Finance': 'FIN3716',
    'Introduction to Operations Management': 'ISDS3115',
    'Intermediate Accounting Part II': 'ACCT3021',
    'Cost Analysis and Control': 'ACCT3121',
    'Business Law': 'BLAW3201',
    'Principles of Management': 'MGT3200',
    'Principles of Marketing': 'MKT3401',
    'Accounting Information Systems': 'ACCT3122',
    'Income Tax Accounting I': 'ACCT3221',
    'Advanced Accounting': 'ACCT4022',
    'Governmental and Not-for-Profit Accounting': 'ACCT4421',
    'Commercial Transactions for Accountants': 'BLAW4203',
    'Auditing': 'ACCT3222',
    'Audit Analytics': 'ACCT4244',
    'Strategic Management': 'MGT3830'
  }

  const match = courseName.toUpperCase().match(/([A-Z]+) *(\d+[A-Z]*)/)
  const courseCode = match ? match[1] + match[2] : nameToCode[courseName] ?? ''
  const dfwRates = dfwRatesByMajor[courseCode]
  const transferGaps = transferEquityGap[courseCode] ?? {}
  const equityGaps = equityGapsByMajor[courseCode] ?? {}
  return {
    dfw: dfwRates?.[department] ?? dfwRates?.allMajors ?? null,
    dfwForDepartment: dfwRates?.[department] !== undefined,
    equityGaps: [
      ...(equityGaps[department] !== undefined
        ? equityGaps[department]
          ? equityGaps[department].split(' ')
          : []
        : equityGaps.allMajors // TODO: I believe i got rid of this
          ? equityGaps.allMajors.split(' ')
          : []),
      ...((
        transferGaps[department] !== undefined
          ? transferGaps[department]
          : transferGaps.allMajors
      )
        ? ['transfer']
        : []) // TODO: indicate whether transfer gap comes from dept or not
    ],
    equityGapsForDepartment: equityGaps?.[department] !== undefined,
    frequency: (frequencies as Record<string, string[]>)[courseCode] ?? null,
    waitlist: (waitlists as Record<string, number>)[courseCode] ?? null
  }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App
      initDegreePlan={degreePlan}
      initReqTypes={reqTypes}
      getStats={getStats}
      defaults={params.get('defaults') ?? ''}
      panelMode={
        params.has('hide-panel')
          ? {}
          : {
            title: params.get('title') ?? name ?? undefined,
            key: true,
            options: true,
            majorDfwNote: majorSubject !== ''
          }
      }
      protectedData={protectedData}
      year={+(params.get('year') ?? new Date().getFullYear())}
      isCurriculum={planType === 'curriculum'}
    />
  </StrictMode>
)
