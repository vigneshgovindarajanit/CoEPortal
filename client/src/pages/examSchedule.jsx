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
  deleteExamSchedule,
  fetchExamScheduleFilters,
  fetchExamSchedules,
  updateExamSchedule
} from '../services/examScheduleService'
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

function getErrorMessage(err, fallback) {
  return err?.response?.data?.error || err?.message || fallback
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
      const [scheduleData, filterData] = await Promise.all([
        fetchExamSchedules({
          examDate: examDateFilter || undefined,
          examType: examTypeFilter || undefined,
          department: departmentFilter || undefined,
          search: search || undefined
        }),
        fetchExamScheduleFilters()
      ])

      setSchedules(scheduleData || [])
      setFilters({
        examTypes: filterData?.examTypes?.length
          ? filterData.examTypes
          : ['SEMESTER', 'PERIODIC_TEST', 'PRACTICAL'],
        departments: filterData?.departments || [],
        sessions: filterData?.sessions?.length ? filterData.sessions : ['FN', 'AN']
      })
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
    setForm(EMPTY_FORM)
    setDialogOpen(true)
  }

  function openEditDialog(schedule) {
    setEditingSchedule(schedule)
    setForm({
      examDate: String(schedule.examDate || ''),
      sessionName: schedule.sessionName || 'FN',
      examType: schedule.examType || 'SEMESTER',
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

  function onFormChange(field) {
    return (event) => {
      const value = event.target.value
      setForm((prev) => ({
        ...prev,
        [field]: field === 'year' ? Number(value) : value
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

  return (
    <Box className="app-shell">
      <Box className="page-head">
        <Typography variant="h4" className="brand-title">
          Exam Schedule
        </Typography>
        <Button variant="contained" onClick={openCreateDialog}>
          Add Schedule
        </Button>
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

      <Card className="course-table-card">
        <CardContent className="course-table-content">
          <Table size="small" className="course-table">
            <TableHead>
              <TableRow>
                <TableCell className="course-head-cell">Date</TableCell>
                <TableCell className="course-head-cell">Session</TableCell>
                <TableCell className="course-head-cell">Type</TableCell>
                <TableCell className="course-head-cell">Course Code</TableCell>
                <TableCell className="course-head-cell">Course Name</TableCell>
                <TableCell className="course-head-cell">Dept</TableCell>
                <TableCell className="course-head-cell">Year</TableCell>
                <TableCell className="course-head-cell">Hall</TableCell>
                <TableCell align="center" className="course-head-cell">Action</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {schedules.map((item) => (
                <TableRow key={item.id} hover className="course-row">
                  <TableCell>{item.examDate}</TableCell>
                  <TableCell>{item.sessionName}</TableCell>
                  <TableCell>{item.examType}</TableCell>
                  <TableCell>{item.courseCode}</TableCell>
                  <TableCell>{item.courseName}</TableCell>
                  <TableCell>{item.department}</TableCell>
                  <TableCell>{item.year}</TableCell>
                  <TableCell>{item.hallCode}</TableCell>
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
            <Typography sx={{ mt: 2 }} className="course-empty-state">
              No exam schedules found for selected filters.
            </Typography>
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
              value={form.examDate}
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
                {filters.sessions.map((sessionName) => (
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
            <TextField
              label="Hall Code"
              value={form.hallCode}
              onChange={onFormChange('hallCode')}
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
    </Box>
  )
}
