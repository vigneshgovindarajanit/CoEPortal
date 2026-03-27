import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  Grid,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography
} from '@mui/material'
import EventNoteRoundedIcon from '@mui/icons-material/EventNoteRounded'
import AssignmentTurnedInRoundedIcon from '@mui/icons-material/AssignmentTurnedInRounded'
import ApartmentRoundedIcon from '@mui/icons-material/ApartmentRounded'
import {
  createExamSchedule,
  deleteAllExamSchedules,
  deleteExamSchedule,
  fetchExamScheduleFilters,
  fetchExamSchedules,
  generateExamSchedules,
  previewGeneratedExamSchedules,
  updateExamSchedule
} from '../services/examScheduleService'
import { fetchCourseFilters } from '../services/courseService'
import { confirmAction } from '../utils/confirmAction'

const EMPTY_FORM = {
  examDate: '',
  sessionName: 'FN',
  examType: 'SEMESTER',
  courseCode: '',
  courseName: '',
  department: '',
  year: 1,
  hallCode: ''
}

function getAllowedSessions(examType, sessions = ['FN', 'AN']) {
  const normalizedExamType = String(examType || '').toUpperCase()

  if (normalizedExamType === 'SEMESTER') {
    return sessions.filter((session) => session === 'FN')
  }

  return sessions
}

const EMPTY_GENERATOR_FORM = {
  startDate: '',
  endDate: '',
  year: 1,
  department: '',
  sessionName: 'FN',
  examType: 'SEMESTER',
  hallCode: ''
}

function getErrorMessage(err, fallback) {
  const message = err?.response?.data?.error || err?.message || fallback

  if (String(message).includes("Unknown column 'exam_date' in 'field list'")) {
    return 'Exam schedule could not be generated right now. Please try again after refreshing the page.'
  }

  return message
}

function getExamTypeClass(type) {
  const normalized = String(type || '').toUpperCase()
  if (normalized === 'SEMESTER') return 'exam-pill-semester'
  if (normalized === 'PERIODIC_TEST') return 'exam-pill-periodic'
  if (normalized === 'PRACTICAL') return 'exam-pill-practical'
  return 'exam-pill-default'
}

function formatExamTypeLabel(type) {
  const normalized = String(type || '').toUpperCase()
  if (normalized === 'PERIODIC_TEST') return 'Periodic Test'
  if (normalized === 'SEMESTER') return 'Semester'
  if (normalized === 'PRACTICAL') return 'Practical'
  return String(type || 'Unknown').replace(/_/g, ' ')
}

function compareSchedulesByDateAsc(left, right) {
  const leftDate = String(left?.examDate || '').split('T')[0]
  const rightDate = String(right?.examDate || '').split('T')[0]

  if (leftDate !== rightDate) {
    return leftDate.localeCompare(rightDate)
  }

  const leftSession = String(left?.sessionName || '')
  const rightSession = String(right?.sessionName || '')
  if (leftSession !== rightSession) {
    return leftSession.localeCompare(rightSession)
  }

  return String(left?.courseCode || '').localeCompare(String(right?.courseCode || ''))
}

function normalizeExamDateValue(value) {
  return String(value || '').split('T')[0]
}

function getScheduleDateRange(scheduleItems = []) {
  const orderedDates = scheduleItems
    .map((item) => normalizeExamDateValue(item?.examDate))
    .filter(Boolean)
    .sort((left, right) => left.localeCompare(right))

  return {
    startDate: orderedDates[0] || '',
    endDate: orderedDates[orderedDates.length - 1] || ''
  }
}

function groupSchedulesByDate(scheduleItems = []) {
  const grouped = new Map()

  for (const item of scheduleItems) {
    const examDate = normalizeExamDateValue(item?.examDate)
    if (!examDate) {
      continue
    }

    if (!grouped.has(examDate)) {
      grouped.set(examDate, [])
    }

    grouped.get(examDate).push(item)
  }

  return Array.from(grouped.entries())
    .sort(([leftDate], [rightDate]) => leftDate.localeCompare(rightDate))
    .map(([examDate, items]) => ({
      examDate,
      items: [...items].sort(compareSchedulesByDateAsc)
    }))
}

function mergeExamTypes(examTypes = []) {
  const preferredOrder = ['SEMESTER', 'PERIODIC_TEST', 'PRACTICAL']
  const merged = [...preferredOrder]

  for (const examType of examTypes) {
    const normalized = String(examType || '').trim().toUpperCase()
    if (normalized && !merged.includes(normalized)) {
      merged.push(normalized)
    }
  }

  return merged
}

export default function ExamSchedulePage() {
  const [schedules, setSchedules] = useState([])
  const [filters, setFilters] = useState({
    examTypes: ['SEMESTER', 'PERIODIC_TEST', 'PRACTICAL'],
    departments: [],
    sessions: ['FN', 'AN']
  })
  const [search, setSearch] = useState('')
  const [examDateFilter, setExamDateFilter] = useState('')
  const [examTypeFilter, setExamTypeFilter] = useState('')
  const [departmentFilter, setDepartmentFilter] = useState('')
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingSchedule, setEditingSchedule] = useState(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [generatorDialogOpen, setGeneratorDialogOpen] = useState(false)
  const [generatorLoading, setGeneratorLoading] = useState(false)
  const [generatorSaving, setGeneratorSaving] = useState(false)
  const [generatorForm, setGeneratorForm] = useState(EMPTY_GENERATOR_FORM)
  const [generatorPreview, setGeneratorPreview] = useState(null)
  const [courseDepartments, setCourseDepartments] = useState([])
  const [recentGeneratedSchedules, setRecentGeneratedSchedules] = useState([])

  const manualSessionOptions = useMemo(
    () => getAllowedSessions(form.examType, filters.sessions),
    [form.examType, filters.sessions]
  )
  const generatorSessionOptions = useMemo(
    () => getAllowedSessions(generatorForm.examType, filters.sessions),
    [generatorForm.examType, filters.sessions]
  )
  const sortedRecentGeneratedSchedules = useMemo(
    () => [...recentGeneratedSchedules].sort(compareSchedulesByDateAsc),
    [recentGeneratedSchedules]
  )
  const recentGeneratedDateGroups = useMemo(
    () => groupSchedulesByDate(sortedRecentGeneratedSchedules),
    [sortedRecentGeneratedSchedules]
  )
  const recentGeneratedDateRange = useMemo(
    () => getScheduleDateRange(sortedRecentGeneratedSchedules),
    [sortedRecentGeneratedSchedules]
  )

  const totalScheduled = useMemo(() => schedules.length, [schedules])
  const scheduleStats = useMemo(
    () => [
      {
        key: 'scheduled',
        label: 'Scheduled Exams',
        value: Number(totalScheduled || 0).toLocaleString('en-IN'),
        note: 'Current filtered list',
        tone: 'available',
        icon: <EventNoteRoundedIcon fontSize="small" />
      },
      {
        key: 'type',
        label: 'Selected Exam Type',
        value: examTypeFilter || 'All',
        note: 'Exam type filter',
        tone: 'semester',
        icon: <AssignmentTurnedInRoundedIcon fontSize="small" />
      },
      {
        key: 'department',
        label: 'Selected Department',
        value: departmentFilter || 'All',
        note: 'Department filter',
        tone: 'registrations',
        icon: <ApartmentRoundedIcon fontSize="small" />
      }
    ],
    [totalScheduled, examTypeFilter, departmentFilter]
  )

  const loadData = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const [scheduleData, filterData, courseFilterData] = await Promise.all([
        fetchExamSchedules({
          examDate: examDateFilter || undefined,
          examType: examTypeFilter || undefined,
          department: departmentFilter || undefined,
          search: search || undefined
        }),
        fetchExamScheduleFilters(),
        fetchCourseFilters()
      ])

      setSchedules(scheduleData || [])
      setFilters({
        examTypes: mergeExamTypes(filterData?.examTypes || []),
        departments: filterData?.departments || [],
        sessions: filterData?.sessions?.length ? filterData.sessions : ['FN', 'AN']
      })
      setCourseDepartments(courseFilterData?.departments || [])
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to load exam schedules'))
    } finally {
      setLoading(false)
    }
  }, [examDateFilter, examTypeFilter, departmentFilter, search])

  useEffect(() => {
    loadData()
  }, [loadData])

  function openCreateDialog() {
    setEditingSchedule(null)
    setForm({
      ...EMPTY_FORM,
      sessionName: getAllowedSessions(EMPTY_FORM.examType, filters.sessions)[0] || 'FN'
    })
    setDialogOpen(true)
  }

  function openGeneratorDialog() {
    setGeneratorPreview(null)
    setGeneratorForm((prev) => ({
      ...EMPTY_GENERATOR_FORM,
      department: prev.department || courseDepartments[0] || ''
    }))
    setGeneratorDialogOpen(true)
  }

  function openEditDialog(schedule) {
    setEditingSchedule(schedule)
    const examType = schedule.examType || 'SEMESTER'
    const sessionOptions = getAllowedSessions(examType, filters.sessions)
    setForm({
      examDate: String(schedule.examDate || ''),
      sessionName: sessionOptions.includes(schedule.sessionName) ? schedule.sessionName : sessionOptions[0] || 'FN',
      examType,
      courseCode: schedule.courseCode || '',
      courseName: schedule.courseName || '',
      department: schedule.department || '',
      year: Number(schedule.year || 1),
      hallCode: schedule.hallCode || ''
    })
    setDialogOpen(true)
  }

  function closeDialog() {
    setDialogOpen(false)
    setEditingSchedule(null)
    setForm(EMPTY_FORM)
  }

  function closeGeneratorDialog() {
    setGeneratorDialogOpen(false)
    setGeneratorPreview(null)
    setGeneratorForm(EMPTY_GENERATOR_FORM)
  }

  function onFormChange(field) {
    return (event) => {
      const value = event.target.value
      setForm((prev) => ({
        ...prev,
        [field]: field === 'year' ? Number(value) : value,
        ...(field === 'examType'
          ? { sessionName: getAllowedSessions(value, filters.sessions)[0] || 'FN' }
          : {})
      }))
    }
  }

  function onGeneratorFormChange(field) {
    return (event) => {
      const value = event.target.value
      setGeneratorForm((prev) => ({
        ...prev,
        [field]: field === 'year' ? Number(value) : value,
        ...(field === 'examType'
          ? {
              hallCode: '',
              sessionName: getAllowedSessions(value, filters.sessions)[0] || 'FN'
            }
          : {})
      }))
    }
  }

  async function saveSchedule() {
    setSaving(true)
    setError('')
    setSuccess('')
    try {
      if (editingSchedule) {
        await updateExamSchedule(editingSchedule.id, form)
      } else {
        await createExamSchedule(form)
      }

      closeDialog()
      await loadData()
      setSuccess('Exam schedule saved successfully')
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to save exam schedule'))
    } finally {
      setSaving(false)
    }
  }

  async function removeSchedule(id) {
    if (!confirmAction('Are you sure you want to delete this exam schedule?')) {
      return
    }
    setError('')
    setSuccess('')
    try {
      await deleteExamSchedule(id)
      await loadData()
      setSuccess('Exam schedule deleted successfully')
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to delete exam schedule'))
    }
  }

  async function removeAllSchedules() {
    if (!confirmAction('Are you sure you want to delete all exam schedules?')) {
      return
    }

    setError('')
    setSuccess('')

    try {
      const result = await deleteAllExamSchedules()
      setRecentGeneratedSchedules([])
      await loadData()
      setSuccess(`Deleted ${result?.deletedCount || 0} exam schedules successfully`)
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to delete all exam schedules'))
    }
  }

  async function previewGeneratedSchedule() {
    setGeneratorLoading(true)
    setError('')
    setSuccess('')
    try {
      const data = await previewGeneratedExamSchedules(generatorForm)
      setGeneratorPreview(data)
    } catch (err) {
      setGeneratorPreview(null)
      setError(getErrorMessage(err, 'Failed to generate exam schedule preview'))
    } finally {
      setGeneratorLoading(false)
    }
  }

  async function saveGeneratedSchedule() {
    setGeneratorSaving(true)
    setError('')
    setSuccess('')
    try {
      const data = await generateExamSchedules(generatorForm)
      setExamDateFilter('')
      setExamTypeFilter('')
      setDepartmentFilter('')
      setSearch('')
      setRecentGeneratedSchedules(data?.created || [])
      await loadData()
      setGeneratorPreview(data)
      setSuccess(`Generated ${data?.created?.length || 0} exam schedules successfully`)
      setGeneratorDialogOpen(false)
      setGeneratorForm(EMPTY_GENERATOR_FORM)
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to save generated exam schedules'))
    } finally {
      setGeneratorSaving(false)
    }
  }

  return (
    <Box className="app-shell">
      <Box className="page-head">
        <Typography variant="h4" className="brand-title">
          Exam Schedule
        </Typography>
        <Stack direction="row" spacing={1}>
          <Button variant="contained" color="error" onClick={removeAllSchedules}>
            Cancel All
          </Button>
          <Button variant="outlined" onClick={openGeneratorDialog}>
            Generate Exam Schedule
          </Button>
          <Button variant="contained" onClick={openCreateDialog}>
            Add Schedule
          </Button>
        </Stack>
      </Box>

      <Box className="stats-row hall-stats-row">
        {scheduleStats.map((item) => (
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

      <Box className="exam-schedule-filter-box">
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.5}>
          <TextField
            fullWidth
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search by course code, course name, or hall"
            size="small"
          />
          <TextField
            value={examDateFilter}
            onChange={(event) => setExamDateFilter(event.target.value)}
            type="date"
            label="Exam Date"
            size="small"
            InputLabelProps={{ shrink: true }}
            sx={{ minWidth: 170 }}
          />
          <FormControl size="small" sx={{ minWidth: 170 }}>
            <InputLabel id="exam-type-filter-label">Exam Type</InputLabel>
            <Select
              labelId="exam-type-filter-label"
              value={examTypeFilter}
              label="Exam Type"
              onChange={(event) => setExamTypeFilter(event.target.value)}
            >
              <MenuItem value="">All</MenuItem>
              {filters.examTypes.map((examType) => (
                <MenuItem key={examType} value={examType}>
                  {examType}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <FormControl size="small" sx={{ minWidth: 170 }}>
            <InputLabel id="department-filter-label">Department</InputLabel>
            <Select
              labelId="department-filter-label"
              value={departmentFilter}
              label="Department"
              onChange={(event) => setDepartmentFilter(event.target.value)}
            >
              <MenuItem value="">All</MenuItem>
              {filters.departments.map((department) => (
                <MenuItem key={department} value={department}>
                  {department}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Stack>
      </Box>

      {success && (
        <Alert severity="success" sx={{ mb: 2 }}>
          {success}
        </Alert>
      )}
      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {recentGeneratedSchedules.length > 0 && (
        <Card className="course-table-card" sx={{ mb: 2 }}>
          <CardContent className="course-table-content">
            <Stack spacing={2}>
              <Alert severity="info">
                Start Exam Date: {recentGeneratedDateRange.startDate || '-'} | End Exam Date: {recentGeneratedDateRange.endDate || '-'}
              </Alert>

              {recentGeneratedDateGroups.map((dateGroup) => (
                <Box key={`generated-date-${dateGroup.examDate}`}>
                  <Typography variant="subtitle1" sx={{ mb: 1, fontWeight: 700 }}>
                    Exam Date: {dateGroup.examDate}
                  </Typography>
                  <Table size="small" className="course-table">
                    <TableHead>
                      <TableRow>
                        <TableCell className="course-head-cell">Session</TableCell>
                        <TableCell className="course-head-cell course-col-type">Type</TableCell>
                        <TableCell className="course-head-cell">Course Code</TableCell>
                        <TableCell className="course-head-cell">Course Name</TableCell>
                        <TableCell className="course-head-cell">Dept</TableCell>
                        <TableCell className="course-head-cell">Year</TableCell>
                        <TableCell align="center" className="course-head-cell">Action</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {dateGroup.items.map((item) => (
                        <TableRow key={`generated-${item.id}`} hover className="course-row">
                          <TableCell>{item.sessionName}</TableCell>
                          <TableCell className="course-col-type">
                            <Box component="span" className={`exam-pill ${getExamTypeClass(item.examType)}`}>
                              {formatExamTypeLabel(item.examType)}
                            </Box>
                          </TableCell>
                          <TableCell>{item.courseCode}</TableCell>
                          <TableCell>{item.courseName}</TableCell>
                          <TableCell>{item.department}</TableCell>
                          <TableCell>{item.year}</TableCell>
                          <TableCell align="center">
                            <Stack direction="row" spacing={1} justifyContent="center">
                              <Button
                                variant="outlined"
                                size="small"
                                onClick={() => openEditDialog(item)}
                                sx={{
                                  color: '#7b1fa2',
                                  borderColor: '#7b1fa2',
                                  '&:hover': {
                                    borderColor: '#6a1b9a',
                                    backgroundColor: 'rgba(123, 31, 162, 0.04)'
                                  }
                                }}
                              >
                                Edit
                              </Button>
                              <Button
                                variant="outlined"
                                size="small"
                                onClick={() => removeSchedule(item.id)}
                                sx={{
                                  color: '#d32f2f',
                                  borderColor: '#d32f2f',
                                  '&:hover': {
                                    borderColor: '#b71c1c',
                                    backgroundColor: 'rgba(211, 47, 47, 0.04)'
                                  }
                                }}
                              >
                                Delete
                              </Button>
                            </Stack>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </Box>
              ))}
            </Stack>
          </CardContent>
        </Card>
      )}

      <Card className="course-table-card">
        <CardContent className="course-table-content">
          <Table size="small" className="course-table">
            <TableHead>
              <TableRow>
                <TableCell className="course-head-cell">Date</TableCell>
                <TableCell className="course-head-cell">Session</TableCell>
                <TableCell className="course-head-cell course-col-type">Type</TableCell>
                <TableCell className="course-head-cell">Course Code</TableCell>
                <TableCell className="course-head-cell">Course Name</TableCell>
                <TableCell className="course-head-cell">Dept</TableCell>
                <TableCell className="course-head-cell">Year</TableCell>
                <TableCell align="center" className="course-head-cell">Action</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {schedules.map((item) => (
                <TableRow key={item.id} hover className="course-row">
                  <TableCell>{String(item.examDate || '').split('T')[0]}</TableCell>
                  <TableCell>{item.sessionName}</TableCell>
                  <TableCell className="course-col-type">
                    <Box component="span" className={`exam-pill ${getExamTypeClass(item.examType)}`}>
                      {formatExamTypeLabel(item.examType)}
                    </Box>
                  </TableCell>
                  <TableCell>{item.courseCode}</TableCell>
                  <TableCell>{item.courseName}</TableCell>
                  <TableCell>{item.department}</TableCell>
                  <TableCell>{item.year}</TableCell>
                  <TableCell align="center">
                    <Stack direction="row" spacing={1} justifyContent="center">
                      <Button
                        variant="outlined"
                        size="small"
                        onClick={() => openEditDialog(item)}
                        sx={{
                          color: '#7b1fa2',
                          borderColor: '#7b1fa2',
                          '&:hover': {
                            borderColor: '#6a1b9a',
                            backgroundColor: 'rgba(123, 31, 162, 0.04)'
                          }
                        }}
                      >
                        Edit
                      </Button>
                      <Button
                        variant="outlined"
                        size="small"
                        onClick={() => removeSchedule(item.id)}
                        sx={{
                          color: '#d32f2f',
                          borderColor: '#d32f2f',
                          '&:hover': {
                            borderColor: '#b71c1c',
                            backgroundColor: 'rgba(211, 47, 47, 0.04)'
                          }
                        }}
                      >
                        Delete
                      </Button>
                    </Stack>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {!loading && schedules.length === 0 && (
            <Card
              variant="outlined"
              sx={{
                mt: 2,
                borderStyle: 'dashed',
                borderColor: 'rgba(25, 118, 210, 0.28)',
                background:
                  'linear-gradient(135deg, rgba(227,242,253,0.65) 0%, rgba(248,250,252,0.96) 100%)',
                borderRadius: 3
              }}
            >
              <CardContent sx={{ py: 4, textAlign: 'center' }}>
                <Typography
                  variant="h6"
                  sx={{ fontWeight: 700, color: '#0f172a', mb: 1 }}
                >
                  No Exam Schedules Found
                </Typography>
                <Typography
                  variant="body2"
                  sx={{ color: '#475569', maxWidth: 520, mx: 'auto', mb: 2 }}
                >
                  No schedules match the current filters. Clear the filters, adjust the date or
                  department, or generate a new exam schedule.
                </Typography>
                <Stack
                  direction={{ xs: 'column', sm: 'row' }}
                  spacing={1.5}
                  justifyContent="center"
                >
                  <Button
                    variant="outlined"
                    onClick={() => {
                      setExamDateFilter('')
                      setExamTypeFilter('')
                      setDepartmentFilter('')
                      setSearch('')
                    }}
                  >
                    Clear Filters
                  </Button>
                  <Button variant="contained" onClick={openGeneratorDialog}>
                    Generate Exam Schedule
                  </Button>
                </Stack>
              </CardContent>
            </Card>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onClose={closeDialog} fullWidth maxWidth="sm">
        <DialogTitle>{editingSchedule ? 'Edit Schedule' : 'Add Schedule'}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              type="date"
              label="Exam Date"
              value={String(form.examDate || '').split('T')[0]}
              onChange={onFormChange('examDate')}
              InputLabelProps={{ shrink: true }}
              fullWidth
            />
            <FormControl fullWidth>
              <InputLabel id="session-name-label">Session</InputLabel>
              <Select
                labelId="session-name-label"
                value={form.sessionName}
                label="Session"
                onChange={onFormChange('sessionName')}
              >
                {manualSessionOptions.map((sessionName) => (
                  <MenuItem key={sessionName} value={sessionName}>
                    {sessionName}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <FormControl fullWidth>
              <InputLabel id="exam-type-label">Exam Type</InputLabel>
              <Select
                labelId="exam-type-label"
                value={form.examType}
                label="Exam Type"
                onChange={onFormChange('examType')}
              >
                {filters.examTypes.map((examType) => (
                  <MenuItem key={examType} value={examType}>
                    {examType}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <TextField
              label="Course Code"
              value={form.courseCode}
              onChange={onFormChange('courseCode')}
              fullWidth
            />
            <TextField
              label="Course Name"
              value={form.courseName}
              onChange={onFormChange('courseName')}
              fullWidth
            />
            <TextField
              label="Department"
              value={form.department}
              onChange={onFormChange('department')}
              fullWidth
            />
            <TextField
              label="Year"
              type="number"
              value={form.year}
              onChange={onFormChange('year')}
              inputProps={{ min: 1, max: 4 }}
              fullWidth
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={closeDialog} variant="contained" color="error">
            Cancel
          </Button>
          <Button onClick={saveSchedule} variant="contained" disabled={saving}>
            Save
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={generatorDialogOpen} onClose={closeGeneratorDialog} fullWidth maxWidth="md">
        <DialogTitle>Generate Exam Schedule</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
              <TextField
                type="date"
                label="Start Date"
                value={generatorForm.startDate}
                onChange={onGeneratorFormChange('startDate')}
                InputLabelProps={{ shrink: true }}
                fullWidth
              />
              <TextField
                type="date"
                label="End Date"
                value={generatorForm.endDate}
                onChange={onGeneratorFormChange('endDate')}
                InputLabelProps={{ shrink: true }}
                fullWidth
              />
              <TextField
                label="Year"
                type="number"
                value={generatorForm.year}
                onChange={onGeneratorFormChange('year')}
                inputProps={{ min: 1, max: 4 }}
                fullWidth
              />
            </Stack>

            <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
              <FormControl fullWidth>
                <InputLabel id="generator-department-label">Department</InputLabel>
                <Select
                  labelId="generator-department-label"
                  value={generatorForm.department}
                  label="Department"
                  onChange={onGeneratorFormChange('department')}
                >
                  <MenuItem value="ALL">All</MenuItem>
                  {courseDepartments.map((department) => (
                    <MenuItem key={department} value={department}>
                      {department}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>

              <FormControl fullWidth>
                <InputLabel id="generator-session-label">Session</InputLabel>
                <Select
                  labelId="generator-session-label"
                  value={generatorForm.sessionName}
                  label="Session"
                  onChange={onGeneratorFormChange('sessionName')}
                >
                  {generatorSessionOptions.length > 1 && <MenuItem value="BOTH">Both</MenuItem>}
                  {generatorSessionOptions.map((sessionName) => (
                    <MenuItem key={sessionName} value={sessionName}>
                      {sessionName}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>

              <FormControl fullWidth>
                <InputLabel id="generator-exam-type-label">Exam Type</InputLabel>
                <Select
                  labelId="generator-exam-type-label"
                  value={generatorForm.examType}
                  label="Exam Type"
                  onChange={onGeneratorFormChange('examType')}
                >
                  {filters.examTypes.map((examType) => (
                    <MenuItem key={examType} value={examType}>
                      {formatExamTypeLabel(examType)}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Stack>

            {generatorPreview && (
              <Card variant="outlined">
                <CardContent>
                  <Stack spacing={1}>
                    <Typography variant="subtitle2">
                      Generated {generatorPreview.totalCourses} schedule entries using {generatorPreview.totalHalls} active halls
                    </Typography>
                    <TextField
                      label="SQL Values Preview"
                      value={generatorPreview.valuesSql || ''}
                      multiline
                      minRows={10}
                      fullWidth
                      InputProps={{ readOnly: true }}
                    />
                  </Stack>
                </CardContent>
              </Card>
            )}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={closeGeneratorDialog} variant="contained" color="error">
            Cancel
          </Button>
          <Button onClick={previewGeneratedSchedule} variant="outlined" disabled={generatorLoading}>
            Preview
          </Button>
          <Button
            onClick={saveGeneratedSchedule}
            variant="contained"
            disabled={generatorSaving}
          >
            Save Generated Schedule
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}
