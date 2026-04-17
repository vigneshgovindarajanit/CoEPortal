import { useCallback, useEffect, useMemo, useState } from 'react'
import { jsPDF } from 'jspdf'
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Checkbox,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  InputLabel,
  ListItemText,
  MenuItem,
  Select,
  Stack,
  TextField,
  Typography
} from '@mui/material'
import ApartmentRoundedIcon from '@mui/icons-material/ApartmentRounded'
import GroupsRoundedIcon from '@mui/icons-material/GroupsRounded'
import ViewModuleRoundedIcon from '@mui/icons-material/ViewModuleRounded'
import api from '../lib/api'
import {
  fetchLatestAllocation,
  generateAllocation
} from '../services/allocationService'
import { fetchExamScheduleFilters, fetchExamSchedules } from '../services/examScheduleService'
import { fetchStudentsSummary } from '../services/studentService'

const PRACTICAL_VENUE_RULES = [
  { prefix: 'IT LAB', min: 1, max: 5 },
  { prefix: 'CSE LAB', min: 1, max: 5 },
  { prefix: 'ME LAB', min: 1, max: 6 },
  { prefix: 'CT LAB', min: 1, max: 2 },
  { prefix: 'AIML LAB', min: 1, max: 6 },
  { exact: 'WORKSHOP LAB' }
]

function normalizeHallName(value) {
  return String(value || '')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, ' ')
    .trim()
}

function isAllowedPracticalVenue(hallCode) {
  const normalized = normalizeHallName(hallCode)
  const compact = normalized.replace(/\s+/g, '')
  return PRACTICAL_VENUE_RULES.some((rule) => {
    if (rule.exact) {
      return normalized === normalizeHallName(rule.exact)
    }

    const compactPrefix = rule.prefix.replace(/\s+/g, '')
    const regex = new RegExp(`^${compactPrefix}([0-9]+)$`)
    const match = compact.match(regex)
    if (!match) {
      return false
    }
    const number = Number(match[1])
    return Number.isFinite(number) && number >= rule.min && number <= rule.max
  })
}

function isPracticalOnlyHall(hall) {
  return (
    isAllowedPracticalVenue(hall?.hallCode)
  )
}

const YEAR_OPTIONS = ['ALL', '1', '2', '3', '4']
const EXAM_TYPE_OPTIONS = [
  { label: 'Semester', value: 'SEMESTER' },
  { label: 'Periodic Test', value: 'PERIODIC_TEST' },
  { label: 'Practical', value: 'PRACTICAL' }
]

const PRINT_LOGO_URL = 'https://www.facultyplus.com/wp-content/uploads/2025/06/bannari-logo.png'

function normalizeDateValue(value) {
  return String(value || '').split('T')[0].trim()
}

function formatPrintDate(value) {
  const normalizedValue = normalizeDateValue(value)

  if (!normalizedValue) {
    return '-'
  }

  const date = new Date(`${normalizedValue}T00:00:00`)
  return Number.isNaN(date.getTime())
    ? normalizedValue
    : date.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' })
}

function formatPrintMonthYear(value) {
  const normalizedValue = normalizeDateValue(value)

  if (!normalizedValue) {
    return ''
  }

  const date = new Date(`${normalizedValue}T00:00:00`)
  return Number.isNaN(date.getTime())
    ? ''
    : date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }).toUpperCase()
}

function getSessionTimeLabel(sessionName) {
  if (!sessionName || sessionName === '-') {
    return '-'
  }

  return sessionName === 'AN' ? 'AN - 01:30 PM to 03:00 PM' : 'FN - 09:00 AM to 10:30 AM'
}

function getDegreeSemesterLabel(selectedYears) {
  if (!Array.isArray(selectedYears) || selectedYears.length !== 1 || selectedYears.includes('ALL')) {
    return 'B.E. / B.Tech. - All Selected Years'
  }

  const yearValue = Number(selectedYears[0])
  const semesterMap = {
    1: 'I',
    2: 'III',
    3: 'V',
    4: 'VII'
  }

  return `B.E. / B.Tech. - ${semesterMap[yearValue] || '-'}`
}

function getPrintExamTypeLabel(examType) {
  const normalized = String(examType || '').trim().toUpperCase()
  if (normalized === 'PERIODIC_TEST') {
    return 'PERIODICAL TEST'
  }
  return normalized.replace(/_/g, ' ')
}

function getCurrentFirstYearBatch() {
  return (new Date().getFullYear() - 1) % 100
}

function getBatchForYear(yearValue) {
  const yearLevel = Number(yearValue)
  const firstYearBatch = getCurrentFirstYearBatch()
  return ((firstYearBatch - (yearLevel - 1)) % 100 + 100) % 100
}

function getAcademicYearLabel(yearValue) {
  const yearLevel = Number(yearValue)
  const ordinalMap = {
    1: '1st',
    2: '2nd',
    3: '3rd',
    4: '4th'
  }
  const ordinal = ordinalMap[yearLevel] || `${yearLevel}th`
  const batch = String(getBatchForYear(yearValue)).padStart(2, '0')
  return `${ordinal} Year (Batch ${batch})`
}

function normalizeHall(hall) {
  return {
    ...hall,
    rows: Number(hall.rows ?? hall.seat_rows ?? 0),
    cols: Number(hall.cols ?? hall.seat_cols ?? 0),
    hallCode: hall.hallCode ?? hall.hall_code,
    studentsPerBench: Number(hall.studentsPerBench ?? hall.students_per_bench ?? 1),
    examType: hall.examType ?? hall.exam_type ?? 'SEMESTER',
    isActive: hall.isActive ?? Boolean(hall.is_active)
  }
}

function getErrorMessage(err, fallback) {
  return err?.response?.data?.error || err?.message || fallback
}

function getFacultyName(faculty) {
  return faculty?.fullName || faculty?.name || 'Not assigned'
}

function getSupervisorName(schedule) {
  return String(schedule?.supervisorName || '').trim() || 'Not assigned'
}

function getScheduleMetaLabel(schedule) {
  if (!schedule) {
    return null
  }

  const dateLabel = formatPrintDate(schedule.examDate)
  const sessionLabel = String(schedule.sessionName || '').trim().toUpperCase() || '-'

  return `Date: ${dateLabel} | Session: ${sessionLabel}`
}

function getLayoutDepartments(layout) {
  const deptCounts = {}
  
  const rows = Array.isArray(layout?.rows) ? layout.rows : []
  for (const row of rows) {
    const rollNumbers = Array.isArray(row.rollNumbers) ? row.rollNumbers : []
    for (const rollNo of rollNumbers) {
      if (rollNo && rollNo !== '-') {
        // Strip everything except letters to get the pure department acronym
        const dept = String(rollNo).replace(/[^A-Za-z]/g, '').trim().toUpperCase()
        if (dept) {
          deptCounts[dept] = (deptCounts[dept] || 0) + 1
        }
      }
    }
  }

  const result = []
  for (const dept of Object.keys(deptCounts).sort()) {
    result.push({ dept, count: deptCounts[dept] })
  }
  return result
}

function formatPdfFriendlyDate(value) {
  const normalizedValue = normalizeDateValue(value)

  if (!normalizedValue) {
    return '-'
  }

  const date = new Date(`${normalizedValue}T00:00:00`)
  return Number.isNaN(date.getTime())
    ? normalizedValue
    : date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}

export default function SeatingPage() {
  const [halls, setHalls] = useState([])
  const [studentSummary, setStudentSummary] = useState({ total: 0, byYear: {} })
  const [allocation, setAllocation] = useState(null)
  const [examSchedules, setExamSchedules] = useState([])
  const [scheduleFilters, setScheduleFilters] = useState({ dates: [], sessions: [] })
  const [selectedYears, setSelectedYears] = useState(['3'])
  const [selectedExamType, setSelectedExamType] = useState('SEMESTER')
  const [selectedDateFilter, setSelectedDateFilter] = useState('')
  const [selectedSessionFilter, setSelectedSessionFilter] = useState('')
  const [generateDialogOpen, setGenerateDialogOpen] = useState(false)
  const [generateForm, setGenerateForm] = useState({
    years: ['3'],
    department: '',
    examDate: '',
    sessionName: ''
  })
  const [loading, setLoading] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [layoutSearch, setLayoutSearch] = useState('')

  const loadData = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const [hallsRes, studentsSummaryRes, latestAllocationRes, examSchedulesRes, examScheduleFiltersRes] = await Promise.allSettled([
        api.get('/api/halls'),
        fetchStudentsSummary(),
        fetchLatestAllocation({ examType: selectedExamType }),
        fetchExamSchedules({ examType: selectedExamType }),
        fetchExamScheduleFilters({ examType: selectedExamType })
      ])

      if (hallsRes.status !== 'fulfilled') {
        throw hallsRes.reason
      }

      const activeHalls = (hallsRes.value?.data || [])
        .map(normalizeHall)
        .filter((hall) => hall.isActive)
      setHalls(activeHalls)

      if (studentsSummaryRes.status === 'fulfilled' && studentsSummaryRes.value) {
        setStudentSummary({
          total: Number(studentsSummaryRes.value.total || 0),
          byYear: studentsSummaryRes.value.byYear || {}
        })
      } else {
        setStudentSummary({ total: 0, byYear: {} })
      }

      if (latestAllocationRes.status === 'fulfilled') {
        setAllocation(latestAllocationRes.value)
      } else {
        setAllocation(null)
      }

      if (examSchedulesRes.status === 'fulfilled') {
        setExamSchedules(examSchedulesRes.value || [])
      } else {
        setExamSchedules([])
      }

      if (examScheduleFiltersRes.status === 'fulfilled') {
        setScheduleFilters({
          dates: (examScheduleFiltersRes.value?.dates || []).map(normalizeDateValue),
          sessions: examScheduleFiltersRes.value?.sessions || [],
          departments: examScheduleFiltersRes.value?.departments || []
        })
      } else {
        setScheduleFilters({ dates: [], sessions: [], departments: [] })
      }
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to load seating data'))
    } finally {
      setLoading(false)
    }
  }, [selectedExamType])

  useEffect(() => {
    if (selectedDateFilter && !scheduleFilters.dates.includes(selectedDateFilter)) {
      setSelectedDateFilter('')
    }
  }, [scheduleFilters.dates, selectedDateFilter])

  useEffect(() => {
    if (selectedSessionFilter && !scheduleFilters.sessions.includes(selectedSessionFilter)) {
      setSelectedSessionFilter('')
    }
  }, [scheduleFilters.sessions, selectedSessionFilter])

  useEffect(() => {
    loadData()
  }, [loadData])

  const filteredStudents = useMemo(() => {
    if (selectedYears.includes('ALL')) {
      return Number(studentSummary.total || 0)
    }
    return selectedYears.reduce((sum, value) => {
      const yearTotal = Number(studentSummary.byYear?.[String(value)] || 0)
      return sum + yearTotal
    }, 0)
  }, [studentSummary, selectedYears])

  const supervisorsByHall = useMemo(() => {
    const map = new Map()

    const matchedSchedules = (examSchedules || [])
      .filter((item) => {
        const matchesDate = !selectedDateFilter || normalizeDateValue(item.examDate) === selectedDateFilter
        const matchesSession = !selectedSessionFilter || item.sessionName === selectedSessionFilter
        return matchesDate && matchesSession
      })
      .sort((left, right) => {
        const leftDate = normalizeDateValue(left.examDate)
        const rightDate = normalizeDateValue(right.examDate)
        if (leftDate !== rightDate) {
          return rightDate.localeCompare(leftDate)
        }
        return String(left.sessionName || '').localeCompare(String(right.sessionName || ''))
      })

    for (const item of matchedSchedules) {
      const hallCode = String(item?.hallCode || '').trim()
      if (!hallCode || map.has(hallCode)) {
        continue
      }

      map.set(hallCode, {
        supervisorName: getSupervisorName(item),
        examDate: item.examDate || '',
        sessionName: item.sessionName || ''
      })
    }

    return map
  }, [examSchedules, selectedDateFilter, selectedSessionFilter])

  const filteredLayouts = useMemo(() => {
    const layouts = allocation?.hallLayouts || []
    const query = layoutSearch.trim().toLowerCase()

    if (!query) {
      return layouts
    }

    return layouts.filter((layout) => {
      const hallCode = String(layout?.hall?.hallCode || '').toLowerCase()
      const supervisorName = String(
        supervisorsByHall.get(String(layout?.hall?.hallCode || '').trim())?.supervisorName || getFacultyName(layout?.facultyAssignee)
      ).toLowerCase()
      return hallCode.includes(query) || supervisorName.includes(query)
    })
  }, [allocation, layoutSearch, supervisorsByHall])

  const filteredHallsByExamType = useMemo(() => {
    if (selectedExamType === 'PRACTICAL') {
      return halls.filter((hall) => isPracticalOnlyHall(hall))
    }
    return halls.filter((hall) => !isPracticalOnlyHall(hall))
  }, [halls, selectedExamType])



  const availableDates = useMemo(() => scheduleFilters.dates || [], [scheduleFilters.dates])

  const availableSessions = useMemo(() => scheduleFilters.sessions || [], [scheduleFilters.sessions])
  const availableDepartments = useMemo(() => scheduleFilters.departments || [], [scheduleFilters.departments])

  const printContext = useMemo(() => {
    const visibleHallCodes = new Set(
      filteredLayouts.map((layout) => String(layout?.hall?.hallCode || '').trim()).filter(Boolean)
    )
    const matchedSchedules = (examSchedules || []).filter((item) => {
      const hallCode = String(item?.hallCode || '').trim()
      const matchesYear =
        selectedYears.includes('ALL') || selectedYears.includes(String(item?.year || ''))
      
      const matchesDate = !selectedDateFilter || normalizeDateValue(item.examDate) === selectedDateFilter
      const matchesSession = !selectedSessionFilter || item.sessionName === selectedSessionFilter

      return visibleHallCodes.has(hallCode) && matchesYear && matchesDate && matchesSession
    })

    const referenceSchedule = matchedSchedules[0] || examSchedules[0] || null
    const examDate = selectedDateFilter || normalizeDateValue(referenceSchedule?.examDate) || null
    const sessionName = selectedSessionFilter || String(referenceSchedule?.sessionName || '').trim().toUpperCase() || '-'
    const titleSuffix = formatPrintMonthYear(examDate)

    return {
      title: `Overall Seating Arrangements for ${getPrintExamTypeLabel(selectedExamType)}${titleSuffix ? ` - ${titleSuffix}` : ''}`,
      degreeSemester: getDegreeSemesterLabel(selectedYears),
      examDate: formatPrintDate(examDate),
      sessionName,
      timeLabel: getSessionTimeLabel(sessionName),
      hasReferenceSchedule: Boolean(referenceSchedule)
    }
  }, [examSchedules, filteredLayouts, selectedExamType, selectedYears, selectedDateFilter, selectedSessionFilter])

  const seatingStats = useMemo(
    () => [
      {
        key: 'available',
        label: 'Active Halls',
        value: filteredHallsByExamType.length,
        note: 'For selected exam type',
        tone: 'available',
        icon: <ApartmentRoundedIcon fontSize="small" />
      },
      {
        key: 'registrations',
        label: 'Students In Scope',
        value: Number(filteredStudents || 0).toLocaleString('en-IN'),
        note: 'Based on academic year filter',
        tone: 'registrations',
        icon: <GroupsRoundedIcon fontSize="small" />
      },
      {
        key: 'semester',
        label: 'Layout Results',
        value: filteredLayouts.length,
        note: selectedExamType.replace(/_/g, ' '),
        tone: 'semester',
        icon: <ViewModuleRoundedIcon fontSize="small" />
      }
    ],
    [filteredHallsByExamType.length, filteredStudents, filteredLayouts.length, selectedExamType]
  )

  const hasFilteredLayouts = filteredLayouts.length > 0

  async function openGenerateDialog() {
    setError('')

    try {
      const latestFilters = await fetchExamScheduleFilters({ examType: selectedExamType })
      setScheduleFilters({
        dates: (latestFilters?.dates || []).map(normalizeDateValue),
        sessions: latestFilters?.sessions || [],
        departments: latestFilters?.departments || []
      })
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to load department, date, and session filters'))
    }

    setGenerateForm({
      years: selectedYears,
      department: '',
      examDate: selectedDateFilter || '',
      sessionName: selectedSessionFilter || ''
    })
    setGenerateDialogOpen(true)
  }

  function closeGenerateDialog() {
    setGenerateDialogOpen(false)
  }

  async function generateSeatingLayout() {
    setGenerating(true)
    setError('')
    setSuccess('')

    try {
      setSelectedYears(generateForm.years)
      setSelectedDateFilter(generateForm.examDate)
      setSelectedSessionFilter(generateForm.sessionName)

      const data = await generateAllocation({
        years: generateForm.years.includes('ALL') ? ['ALL'] : generateForm.years.map((value) => Number(value)),
        primaryDept: generateForm.department || undefined,
        examType: selectedExamType
      })
      setAllocation(data)

      // Save filter context to DB
      const examDateValue = generateForm.examDate || null
      const sessionValue = generateForm.sessionName || null
      await api.post('/api/seating-filters', {
        yearFilter: generateForm.years.includes('ALL') ? 'ALL' : generateForm.years.join(','),
        examType: selectedExamType,
        examDate: examDateValue,
        sessionName: sessionValue
      })

      setGenerateDialogOpen(false)
      setSuccess('Seating generated and saved to database.')
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to generate seating'))
    } finally {
      setGenerating(false)
    }
  }

  function exportSeatingLayoutPdf() {
    if (!hasFilteredLayouts) {
      setError('No seating layout available to export.')
      return
    }

    setError('')
    setSuccess('')

    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    })

    const title = 'SEATING ARRANGEMENT'
    const subtitle = [
      `Exam Type: ${selectedExamType.replace(/_/g, ' ')}`,
      `Date: ${formatPdfFriendlyDate(selectedDateFilter || normalizeDateValue(printContext.examDate))}`,
      `Session: ${printContext.sessionName || '-'}`,
      `Layouts: ${filteredLayouts.length}`
    ].join('   |   ')

    doc.setFillColor(111, 66, 193)
    doc.rect(12, 10, 186, 18, 'F')
    doc.setTextColor(255, 255, 255)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(16)
    doc.text(title, 105, 18, { align: 'center' })
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)
    doc.text(subtitle, 105, 24, { align: 'center' })

    let cursorY = 34
    const pageWidth = 210
    const pageMargin = 12
    const contentWidth = pageWidth - pageMargin * 2

    function drawCenteredText(text, x, y, width, fontSize, color = [31, 45, 61], fontStyle = 'normal') {
      doc.setFont('helvetica', fontStyle)
      doc.setFontSize(fontSize)
      doc.setTextColor(...color)
      doc.text(String(text || '-'), x + width / 2, y, { align: 'center' })
    }

    filteredLayouts.forEach((layout, layoutIndex) => {
      const hallCode = String(layout?.hall?.hallCode || '-').trim()
      const assignedCount = Number(layout?.assignedCount || 0)
      const departmentLabel = getLayoutDepartments(layout)
        .map((item) => `${item.dept} (${item.count})`)
        .join(', ') || '-'
      const supervisorLine = [
        layout?.facultyAssignee?.fullName ? `Supervisor: ${layout.facultyAssignee.fullName}` : null,
        layout?.facultyAssigneeTwo?.fullName ? `Supervisor 2: ${layout.facultyAssigneeTwo.fullName}` : null
      ]
        .filter(Boolean)
        .join('   |   ') || 'Supervisor: Not assigned'

      if (cursorY > 235 || layoutIndex > 0) {
        doc.addPage()
        cursorY = 18
      }

      doc.setFillColor(238, 231, 251)
      doc.roundedRect(12, cursorY, 186, 12, 2, 2, 'F')
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(12)
      doc.setTextColor(76, 29, 149)
      doc.text(`Hall: ${hallCode}`, 16, cursorY + 7)

      cursorY += 17
      doc.setTextColor(33, 37, 41)
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(10)
      doc.text(printContext.title, 12, cursorY)
      cursorY += 5
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(9)
      doc.text(`Degree / Semester: ${printContext.degreeSemester}`, 12, cursorY)
      cursorY += 4.5
      doc.text(`Date / Session: ${printContext.examDate} ${printContext.sessionName}`, 12, cursorY)
      cursorY += 4.5
      doc.text(`Time: ${printContext.timeLabel}`, 12, cursorY)
      cursorY += 4.5
      doc.text(`Departments: ${departmentLabel}`, 12, cursorY)
      cursorY += 4.5
      doc.text(`Total Students: ${assignedCount}`, 12, cursorY)
      cursorY += 4.5
      doc.text(supervisorLine, 12, cursorY)
      cursorY += 7

      const layoutRows = Array.isArray(layout?.rows) ? layout.rows : []
      const labelWidth = 18
      const gap = 3
      const hallCols = Math.max(Number(layout?.hall?.cols || 0), 1)
      const seatWidth = (contentWidth - labelWidth - gap * hallCols) / hallCols
      const rowHeight = 24

      if (!layoutRows.length) {
        doc.setFont('helvetica', 'italic')
        doc.setFontSize(10)
        doc.setTextColor(95, 108, 133)
        doc.text('No students assigned for this hall.', 12, cursorY + 6)
        cursorY += 14
        return
      }

      for (const row of layoutRows) {
        if (cursorY + rowHeight > 285) {
          doc.addPage()
          cursorY = 18
        }

        const rowLabel = String(row?.rowLabel || '-')
        const rowSeats = Array.isArray(row?.rollNumbers) ? row.rollNumbers : []
        const seatItems = Array.from({ length: hallCols }, (_, index) => ({
          seatCode: `${rowLabel}${index + 1}`,
          rollNo: rowSeats[index] || '-'
        }))

        doc.setFillColor(34, 42, 60)
        doc.roundedRect(pageMargin, cursorY, labelWidth, rowHeight, 4, 4, 'F')
        drawCenteredText(rowLabel, pageMargin, cursorY + 10, labelWidth, 18, [255, 255, 255], 'bold')

        for (const [seatIndex, seat] of seatItems.entries()) {
          const seatX = pageMargin + labelWidth + gap + seatIndex * (seatWidth + gap)
          doc.setFillColor(255, 255, 255)
          doc.setDrawColor(214, 221, 235)
          doc.setLineWidth(0.3)
          doc.roundedRect(seatX, cursorY, seatWidth, rowHeight, 3, 3, 'FD')

          drawCenteredText(seat.seatCode, seatX, cursorY + 8, seatWidth, 8.5, [111, 128, 160], 'normal')

          doc.setFont('helvetica', 'normal')
          doc.setFontSize(7.6)
          doc.setTextColor(20, 29, 45)
          const rollText = String(seat.rollNo || '-')
          const wrappedRoll = doc.splitTextToSize(rollText, Math.max(seatWidth - 3, 8))
          const visibleLines = wrappedRoll.slice(0, 2)
          const startTextY = cursorY + 15
          visibleLines.forEach((line, lineIndex) => {
            doc.text(String(line), seatX + seatWidth / 2, startTextY + lineIndex * 3.8, { align: 'center' })
          })
        }

        cursorY += rowHeight + 4
      }

      cursorY += 4
    })

    const fileName = `seating-layout-${normalizeDateValue(selectedDateFilter || '') || 'all-dates'}-${String(printContext.sessionName || 'all').toLowerCase()}.pdf`
    doc.save(fileName)
    setSuccess('Seating layout PDF downloaded successfully.')
  }

  return (
    <Box className="app-shell course-shell">
      <Box className="page-head">
        <Typography variant="h4" className="brand-title">
          Seating
        </Typography>
        <Stack direction="row" spacing={1}>
          <Button variant="outlined" onClick={exportSeatingLayoutPdf} disabled={!hasFilteredLayouts}>
            Export PDF
          </Button>
          <Button variant="contained" onClick={openGenerateDialog} disabled={generating || loading}>
            {generating ? 'Generating...' : 'Generate Layout'}
          </Button>
        </Stack>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}
      {success && (
        <Alert severity="success" sx={{ mb: 2 }}>
          {success}
        </Alert>
      )}

      <Box className="stats-row hall-stats-row">
        {seatingStats.map((item) => (
          <Card key={item.key} className={`stats-card hall-stats-card hall-stats-card-${item.tone}`}>
            <CardContent className="stats-card-content hall-stats-card-content">
              <Box className="dashboard-summary-title-row">
                <Box className={`dashboard-summary-icon-badge dashboard-summary-icon-badge-${item.tone}`}>
                  {item.icon}
                </Box>
                <Typography className="stats-card-label hall-stats-card-label" variant="subtitle2">
                  {item.label}
                </Typography>
              </Box>
              <Typography className="stats-card-value hall-stats-card-value" variant="h5">
                {item.value}
              </Typography>
              <Typography className="stats-card-note hall-stats-card-note" variant="caption">
                {item.note}
              </Typography>
            </CardContent>
          </Card>
        ))}
      </Box>

      <Card className="course-filter-card">
        <CardContent className="course-filter-content">
          <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.5}>
            <Box className="course-search-row">
              <TextField
                fullWidth
                size="small"
                label="Search exam hall / faculty"
                value={layoutSearch}
                onChange={(event) => setLayoutSearch(event.target.value)}
                placeholder="e.g. EW101 or Dr. Kumar"
              />
            </Box>

            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.2}>
              <FormControl size="small" sx={{ minWidth: { xs: '100%', sm: 220 } }}>
                <InputLabel id="exam-type-filter-label">Exam Type</InputLabel>
                <Select
                  labelId="exam-type-filter-label"
                  value={selectedExamType}
                  label="Exam Type"
                  onChange={(event) => setSelectedExamType(String(event.target.value || 'SEMESTER'))}
                >
                  {EXAM_TYPE_OPTIONS.map((item) => (
                    <MenuItem key={item.value} value={item.value}>
                      {item.label}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              <FormControl size="small" sx={{ minWidth: { xs: '100%', sm: 220 } }}>
                <InputLabel id="years-filter-label">Academic Year</InputLabel>
                <Select
                  labelId="years-filter-label"
                  multiple
                  value={selectedYears}
                  label="Academic Year"
                  onChange={(event) => {
                    const raw = event.target.value
                    const values = (Array.isArray(raw) ? raw : [raw]).map((value) => String(value))

                    setSelectedYears((prev) => {
                      const prevHasAll = prev.includes('ALL')
                      const nextHasAll = values.includes('ALL')

                      if (nextHasAll && !prevHasAll) {
                        return ['ALL']
                      }

                      if (nextHasAll && prevHasAll) {
                        const withoutAll = values.filter((value) => value !== 'ALL')
                        return withoutAll.length > 0 ? withoutAll : ['ALL']
                      }

                      const normalized = values
                        .filter((value, index, arr) => arr.indexOf(value) === index)
                        .filter((value) => YEAR_OPTIONS.includes(value) && value !== 'ALL')

                      return normalized.length > 0 ? normalized : ['ALL']
                    })
                  }}
                  renderValue={(selected) => {
                    const selectedValues = Array.isArray(selected) ? selected : [selected]
                    if (selectedValues.includes('ALL')) {
                      return 'All Years'
                    }
                    return selectedValues.map((value) => getAcademicYearLabel(value)).join(', ')
                  }}
                >
                  <MenuItem value="ALL">
                    <Checkbox checked={selectedYears.includes('ALL')} />
                    <ListItemText primary="All Years" />
                  </MenuItem>
                  <MenuItem value="1">
                    <Checkbox checked={selectedYears.includes('1')} />
                    <ListItemText primary={getAcademicYearLabel('1')} />
                  </MenuItem>
                  <MenuItem value="2">
                    <Checkbox checked={selectedYears.includes('2')} />
                    <ListItemText primary={getAcademicYearLabel('2')} />
                  </MenuItem>
                  <MenuItem value="3">
                    <Checkbox checked={selectedYears.includes('3')} />
                    <ListItemText primary={getAcademicYearLabel('3')} />
                  </MenuItem>
                  <MenuItem value="4">
                    <Checkbox checked={selectedYears.includes('4')} />
                    <ListItemText primary={getAcademicYearLabel('4')} />
                  </MenuItem>
                </Select>
              </FormControl>

              <FormControl size="small" sx={{ minWidth: { xs: '100%', sm: 170 } }}>
                <InputLabel id="date-filter-label">Exam Date</InputLabel>
                <Select
                  labelId="date-filter-label"
                  value={selectedDateFilter}
                  label="Exam Date"
                  onChange={(event) => setSelectedDateFilter(String(event.target.value || ''))}
                >
                  <MenuItem value=""><em>Any Date</em></MenuItem>
                  {availableDates.map((date) => (
                    <MenuItem key={date} value={date}>
                      {formatPrintDate(date)}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              
              <FormControl size="small" sx={{ minWidth: { xs: '100%', sm: 140 } }}>
                <InputLabel id="session-filter-label">Session</InputLabel>
                <Select
                  labelId="session-filter-label"
                  value={selectedSessionFilter}
                  label="Session"
                  onChange={(event) => setSelectedSessionFilter(event.target.value)}
                >
                  <MenuItem value=""><em>Any Session</em></MenuItem>
                  {availableSessions.map((session) => (
                    <MenuItem key={session} value={session}>{session}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Stack>
          </Stack>
        </CardContent>
      </Card>

      <Card className="course-table-card">
        <CardContent className="course-filter-content">
          <Stack spacing={2} className="seating-print-layout">
            <Box className="seating-print-header">
              <Box className="seating-print-brand">
                <img src={PRINT_LOGO_URL} alt="Bannari Amman Institute of Technology logo" className="seating-print-logo" />
              </Box>
              <Typography className="seating-print-main-title">{printContext.title}</Typography>
              <Typography className="seating-print-meta">
                Degree - Semester : {printContext.degreeSemester}
              </Typography>
              <Typography className="seating-print-meta">
                Date - Session: {printContext.examDate} {printContext.sessionName}
              </Typography>
              <Typography className="seating-print-meta">
                Time: {printContext.timeLabel}
              </Typography>
            </Box>

            {filteredLayouts.map((layout) => {
              const assignedCount = Number(layout.assignedCount || 0)
              const hallCodePrefix = String(layout.hall?.hallCode || '').toUpperCase().substring(0, 2)
              const isScrollableLayout = selectedExamType === 'PERIODIC_TEST' || hallCodePrefix === 'ME' || hallCodePrefix === 'SF'
              const matchedSupervisor = supervisorsByHall.get(String(layout.hall?.hallCode || '').trim())
              const matchedSchedule = (examSchedules || []).find((item) => {
                const matchesHall = String(item?.hallCode || '').trim() === String(layout.hall?.hallCode || '').trim()
                const matchesDate = !selectedDateFilter || normalizeDateValue(item.examDate) === selectedDateFilter
                const matchesSession = !selectedSessionFilter || item.sessionName === selectedSessionFilter
                return matchesHall && matchesDate && matchesSession
              })
              
              return (
                <Box key={`${layout.hall.id}-${layout.hallAllocationId || 'new'}`} className="seating-layout-card">
                  <Box className="seating-layout-head">
                    <Box>
                      <Typography variant="h5" className="seating-layout-hall">
                        {layout.hall.hallCode}
                      </Typography>
                      <Box className="seating-layout-depts">
                        {getLayoutDepartments(layout).map((item) => (
                          <Box key={`${layout.hall.id}-${item.dept}`} className="seating-layout-dept-chip">
                            {item.dept} {item.count}
                          </Box>
                        ))}
                      </Box>
                      {matchedSchedule && (
                        <Box sx={{ mt: 1, display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                          <Box
                            className="seating-layout-dept-chip"
                            sx={{
                              background: 'rgba(16, 185, 129, 0.12)',
                              color: '#047857',
                              border: '1px solid rgba(4, 120, 87, 0.25)'
                            }}
                          >
                            {getScheduleMetaLabel(matchedSchedule)}
                          </Box>
                        </Box>
                      )}
                      {(matchedSupervisor || layout.facultyAssignee || layout.facultyAssigneeTwo) && (
                        <Box sx={{ mt: 1, display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                          {matchedSupervisor && (
                            <Box className="seating-layout-dept-chip" sx={{ background: 'rgba(33, 150, 243, 0.1)', color: '#1976d2', border: '1px solid rgba(25, 118, 210, 0.3)' }}>
                              Supervisor: {matchedSupervisor.supervisorName}
                            </Box>
                          )}
                          {!matchedSupervisor && layout.facultyAssignee && (
                            <Box className="seating-layout-dept-chip" sx={{ background: 'rgba(33, 150, 243, 0.1)', color: '#1976d2', border: '1px solid rgba(25, 118, 210, 0.3)' }}>
                              Supervisor: {layout.facultyAssignee.fullName}
                            </Box>
                          )}
                          {!matchedSupervisor && layout.facultyAssigneeTwo && (
                            <Box className="seating-layout-dept-chip" sx={{ background: 'rgba(33, 150, 243, 0.1)', color: '#1976d2', border: '1px solid rgba(25, 118, 210, 0.3)' }}>
                              Supervisor 2: {layout.facultyAssigneeTwo.fullName}
                            </Box>
                          )}
                        </Box>
                      )}
                    </Box>
                    <Box className="seating-layout-total">
                      <Typography className="seating-layout-total-label">TOTAL STUDENTS</Typography>
                      <Typography className="seating-layout-total-value">{assignedCount}</Typography>
                    </Box>
                  </Box>

                  <Box className={`seating-layout-body${isScrollableLayout ? ' seating-layout-body-scrollable' : ''}`}>
                    {(layout.rows || []).map((row) => {
                      const rowSeats = Array.isArray(row.rollNumbers) ? row.rollNumbers : []
                      const columnCount = Math.max(Number(layout.hall?.cols || 0), rowSeats.length)
                      const cols = Array.from({ length: columnCount }, (_, index) => ({
                        seatCode: `${row.rowLabel}${index + 1}`,
                        rollNo: rowSeats[index] || '-'
                      }))

                      return (
                        <Box
                          key={`${layout.hall.id}-${row.rowLabel}`}
                          className={`seating-layout-row${isScrollableLayout ? ' seating-layout-row-periodic' : ''}`}
                        >
                          <Box className="seating-layout-row-label">
                            <Box>{row.rowLabel}</Box>
                            <Box sx={{ fontSize: '0.65rem', lineHeight: 1, mt: 0.5, opacity: 0.8, fontWeight: 'bold' }}>
                              {row.dept}
                            </Box>
                          </Box>
                          <Box
                            className={`seating-layout-row-grid${isScrollableLayout ? ' seating-layout-row-grid-periodic' : ''}`}
                          >
                            {cols.map((seat) => (
                              <Box
                                key={`${layout.hall.id}-${row.rowLabel}-${seat.seatCode}`}
                                className={`seating-layout-seat${isScrollableLayout ? ' seating-layout-seat-periodic' : ''}`}
                              >
                                <Typography className="seating-layout-seat-code">{seat.seatCode}</Typography>
                                <Typography className="seating-layout-seat-roll">{seat.rollNo}</Typography>
                              </Box>
                            ))}
                          </Box>
                        </Box>
                      )
                    })}
                  </Box>
                </Box>
              )
            })}
          </Stack>

          {!loading && Boolean(allocation?.hallLayouts?.length) && filteredLayouts.length === 0 && (
            <Typography sx={{ mt: 2 }} className="course-empty-state">
              No hall layout matches this search.
            </Typography>
          )}

          {!loading && !allocation?.hallLayouts?.length && (
            <Typography sx={{ mt: 2 }} className="course-empty-state">
              No allocation saved yet. Select exam type and academic year, then click Generate Layout.
            </Typography>
          )}
        </CardContent>
      </Card>

      <Dialog open={generateDialogOpen} onClose={closeGenerateDialog} fullWidth maxWidth="sm">
        <DialogTitle>Generate Layout</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <FormControl fullWidth size="small">
              <InputLabel id="generate-years-label">Year</InputLabel>
              <Select
                labelId="generate-years-label"
                multiple
                value={generateForm.years}
                label="Year"
                onChange={(event) => {
                  const raw = event.target.value
                  const values = (Array.isArray(raw) ? raw : [raw]).map((value) => String(value))

                  const normalized = values.includes('ALL')
                    ? ['ALL']
                    : values
                        .filter((value, index, arr) => arr.indexOf(value) === index)
                        .filter((value) => YEAR_OPTIONS.includes(value) && value !== 'ALL')

                  setGenerateForm((prev) => ({
                    ...prev,
                    years: normalized.length > 0 ? normalized : ['ALL']
                  }))
                }}
                renderValue={(selected) => {
                  const selectedValues = Array.isArray(selected) ? selected : [selected]
                  if (selectedValues.includes('ALL')) {
                    return 'All Years'
                  }
                  return selectedValues.map((value) => getAcademicYearLabel(value)).join(', ')
                }}
              >
                <MenuItem value="ALL">
                  <Checkbox checked={generateForm.years.includes('ALL')} />
                  <ListItemText primary="All Years" />
                </MenuItem>
                <MenuItem value="1">
                  <Checkbox checked={generateForm.years.includes('1')} />
                  <ListItemText primary={getAcademicYearLabel('1')} />
                </MenuItem>
                <MenuItem value="2">
                  <Checkbox checked={generateForm.years.includes('2')} />
                  <ListItemText primary={getAcademicYearLabel('2')} />
                </MenuItem>
                <MenuItem value="3">
                  <Checkbox checked={generateForm.years.includes('3')} />
                  <ListItemText primary={getAcademicYearLabel('3')} />
                </MenuItem>
                <MenuItem value="4">
                  <Checkbox checked={generateForm.years.includes('4')} />
                  <ListItemText primary={getAcademicYearLabel('4')} />
                </MenuItem>
              </Select>
            </FormControl>

            <FormControl fullWidth size="small">
              <InputLabel id="generate-dept-label">Department</InputLabel>
              <Select
                labelId="generate-dept-label"
                value={generateForm.department}
                label="Department"
                onChange={(event) =>
                  setGenerateForm((prev) => ({
                    ...prev,
                    department: String(event.target.value || '')
                  }))
                }
              >
                <MenuItem value=""><em>All Departments</em></MenuItem>
                {availableDepartments.map((department) => (
                  <MenuItem key={department} value={department}>
                    {department}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <FormControl fullWidth size="small">
              <InputLabel id="generate-date-label">Exam Date</InputLabel>
              <Select
                labelId="generate-date-label"
                value={generateForm.examDate}
                label="Exam Date"
                onChange={(event) =>
                  setGenerateForm((prev) => ({
                    ...prev,
                    examDate: String(event.target.value || '')
                  }))
                }
              >
                <MenuItem value=""><em>All Dates</em></MenuItem>
                {availableDates.map((date) => (
                  <MenuItem key={date} value={date}>
                    {formatPrintDate(date)}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <FormControl fullWidth size="small">
              <InputLabel id="generate-session-label">Session</InputLabel>
              <Select
                labelId="generate-session-label"
                value={generateForm.sessionName}
                label="Session"
                onChange={(event) =>
                  setGenerateForm((prev) => ({
                    ...prev,
                    sessionName: String(event.target.value || '')
                  }))
                }
              >
                <MenuItem value=""><em>All Sessions</em></MenuItem>
                {availableSessions.map((session) => (
                  <MenuItem key={session} value={session}>
                    {session}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={closeGenerateDialog} variant="contained" color="error">
            Cancel
          </Button>
          <Button onClick={generateSeatingLayout} variant="contained" disabled={generating}>
            {generating ? 'Generating...' : 'Generate'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}
