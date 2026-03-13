import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Checkbox,
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
import api from '../lib/axios'
import {
  fetchLatestAllocation,
  generateAllocation
} from '../services/allocationService'
import { fetchExamSchedules } from '../services/examScheduleService'
import { fetchStudentsSummary } from '../services/studentService'

const YEAR_OPTIONS = ['ALL', '1', '2', '3', '4']
const EXAM_TYPE_OPTIONS = [
  { label: 'Semester', value: 'SEMESTER' },
  { label: 'Periodic Test', value: 'PERIODIC_TEST' },
  { label: 'Practical', value: 'PRACTICAL' }
]

const PRINT_LOGO_URL = 'https://www.facultyplus.com/wp-content/uploads/2025/06/bannari-logo.png'

function formatPrintDate(value) {
  if (!value) {
    return '-'
  }

  const date = new Date(`${value}T00:00:00`)
  return Number.isNaN(date.getTime())
    ? String(value)
    : date.toLocaleDateString('en-GB').replace(/\//g, '.')
}

function formatPrintMonthYear(value) {
  if (!value) {
    return ''
  }

  const date = new Date(`${value}T00:00:00`)
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

function getLayoutDepartments(layout) {
  const rows = Array.isArray(layout?.rows) ? layout.rows : []
  return rows
    .map((row) => String(row?.dept || '').trim().toUpperCase())
    .filter((dept, index, list) => dept && list.indexOf(dept) === index)
}

export default function SeatingPage() {
  const [halls, setHalls] = useState([])
  const [studentSummary, setStudentSummary] = useState({ total: 0, byYear: {} })
  const [allocation, setAllocation] = useState(null)
  const [examSchedules, setExamSchedules] = useState([])
  const [selectedYears, setSelectedYears] = useState(['3'])
  const [selectedExamType, setSelectedExamType] = useState('SEMESTER')
  const [loading, setLoading] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [layoutSearch, setLayoutSearch] = useState('')

  const loadData = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const [hallsRes, studentsSummaryRes, latestAllocationRes, examSchedulesRes] = await Promise.allSettled([
        api.get('/halls'),
        fetchStudentsSummary(),
        fetchLatestAllocation(),
        fetchExamSchedules({ examType: selectedExamType })
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
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to load seating data'))
    } finally {
      setLoading(false)
    }
  }, [selectedExamType])

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

  const filteredLayouts = useMemo(() => {
    const layouts = allocation?.hallLayouts || []
    const query = layoutSearch.trim().toLowerCase()

    if (!query) {
      return layouts
    }

    return layouts.filter((layout) => {
      const hallCode = String(layout?.hall?.hallCode || '').toLowerCase()
      const facultyName = getFacultyName(layout?.facultyAssignee).toLowerCase()
      return hallCode.includes(query) || facultyName.includes(query)
    })
  }, [allocation, layoutSearch])

  const filteredHallsByExamType = useMemo(() => {
    return halls.filter((hall) => hall.examType === selectedExamType)
  }, [halls, selectedExamType])

  const printContext = useMemo(() => {
    const visibleHallCodes = new Set(
      filteredLayouts.map((layout) => String(layout?.hall?.hallCode || '').trim()).filter(Boolean)
    )
    const matchedSchedules = (examSchedules || []).filter((item) => {
      const hallCode = String(item?.hallCode || '').trim()
      const matchesYear =
        selectedYears.includes('ALL') || selectedYears.includes(String(item?.year || ''))

      return visibleHallCodes.has(hallCode) && matchesYear
    })

    const referenceSchedule = matchedSchedules[0] || examSchedules[0] || null
    const examDate = referenceSchedule?.examDate || null
    const sessionName = String(referenceSchedule?.sessionName || '').trim().toUpperCase() || '-'
    const titleSuffix = formatPrintMonthYear(examDate)

    return {
      title: `Overall Seating Arrangements for ${getPrintExamTypeLabel(selectedExamType)}${titleSuffix ? ` - ${titleSuffix}` : ''}`,
      degreeSemester: getDegreeSemesterLabel(selectedYears),
      examDate: formatPrintDate(examDate),
      sessionName,
      timeLabel: getSessionTimeLabel(sessionName),
      hasReferenceSchedule: Boolean(referenceSchedule)
    }
  }, [examSchedules, filteredLayouts, selectedExamType, selectedYears])

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

  async function generateSeatingLayout() {
    setGenerating(true)
    setError('')
    setSuccess('')

    try {
      const data = await generateAllocation({
        years: selectedYears.includes('ALL') ? ['ALL'] : selectedYears.map((value) => Number(value)),
        examType: selectedExamType
      })
      setAllocation(data)
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
    window.print()
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
          <Button variant="contained" onClick={generateSeatingLayout} disabled={generating || loading}>
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
              const isPeriodicTestLayout = selectedExamType === 'PERIODIC_TEST'
              return (
                <Box key={`${layout.hall.id}-${layout.hallAllocationId || 'new'}`} className="seating-layout-card">
                  <Box className="seating-layout-head">
                    <Box>
                      <Typography variant="h5" className="seating-layout-hall">
                        {layout.hall.hallCode}
                      </Typography>
                      <Box className="seating-layout-depts">
                        {getLayoutDepartments(layout).map((dept) => (
                          <Box key={`${layout.hall.id}-${dept}`} className="seating-layout-dept-chip">
                            {dept}
                          </Box>
                        ))}
                      </Box>
                    </Box>
                    <Box className="seating-layout-total">
                      <Typography className="seating-layout-total-label">TOTAL STUDENTS</Typography>
                      <Typography className="seating-layout-total-value">{assignedCount}</Typography>
                    </Box>
                  </Box>

                  <Box className="seating-layout-body">
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
                          className={`seating-layout-row${isPeriodicTestLayout ? ' seating-layout-row-periodic' : ''}`}
                        >
                          <Box className="seating-layout-row-label">{row.rowLabel}</Box>
                          <Box
                            className={`seating-layout-row-grid${isPeriodicTestLayout ? ' seating-layout-row-grid-periodic' : ''}`}
                          >
                            {cols.map((seat) => (
                              <Box
                                key={`${layout.hall.id}-${row.rowLabel}-${seat.seatCode}`}
                                className={`seating-layout-seat${isPeriodicTestLayout ? ' seating-layout-seat-periodic' : ''}`}
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
    </Box>
  )
}
