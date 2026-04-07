import { useCallback, useEffect, useMemo, useState } from 'react'
import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  InputLabel,
  LinearProgress,
  MenuItem,
  Select,
  Stack,
  TextField,
  Typography
} from '@mui/material'
import BadgeRoundedIcon from '@mui/icons-material/BadgeRounded'
import HowToRegRoundedIcon from '@mui/icons-material/HowToRegRounded'
import PersonOffRoundedIcon from '@mui/icons-material/PersonOffRounded'
import {
  autoAssignAllFaculty,
  autoAssignSupervisor,
  cancelAllAssignedFaculty,
  cancelFacultyAssignment,
  createFaculty,
  fetchFaculty,
  fetchLatestFacultyAssignments,
  fetchHistoricalFacultyAssignments,
  fetchHalls,
  fetchPracticalHalls,
  updateFaculty
} from '../services/facultyService'
import { fetchLatestAllocation } from '../services/allocationService'
import { fetchExamScheduleFilters } from '../services/examScheduleService'
import { confirmAction } from '../utils/confirmAction'

const ROLE_OPTIONS = [
  'Assistant Professor',
  'Assistant Professor Level II',
  'Assistant Professor Level III',
  'Associate Professor',
  'Professor',
  'Head'
]

const emptyForm = {
  fullName: '',
  department: '',
  role: 'Assistant Professor',
  currentWorkload: 0,
  isActive: true,
  manualHallCode: ''
}

function getErrorMessage(err, fallback) {
  return err?.response?.data?.error || err?.message || fallback
}

function formatAssignmentDate(value) {
  const raw = String(value || '').split('T')[0]
  if (!raw || !/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    return '-'
  }

  const [year, month, day] = raw.split('-')
  return `${Number(day)}/${Number(month)}/${year}`
}

function getSessionTimeLabel(sessionName) {
  const normalizedSession = String(sessionName || '').trim().toUpperCase()

  if (!normalizedSession) {
    return '-'
  }

  if (normalizedSession === 'AN') {
    return '01:30 PM - 03:00 PM'
  }

  if (normalizedSession === 'FN') {
    return '09:00 AM - 10:30 AM'
  }

  return normalizedSession
}

function getSessionSortWeight(sessionName) {
  const normalizedSession = String(sessionName || '').trim().toUpperCase()
  if (normalizedSession === 'FN') {
    return 0
  }
  if (normalizedSession === 'AN') {
    return 1
  }
  return 99
}

function compareSchedulesDesc(left, right) {
  const leftDate = String(left?.examDate || '')
  const rightDate = String(right?.examDate || '')
  if (leftDate !== rightDate) {
    return rightDate.localeCompare(leftDate)
  }

  const sessionDiff = getSessionSortWeight(left?.sessionName) - getSessionSortWeight(right?.sessionName)
  if (sessionDiff !== 0) {
    return sessionDiff
  }

  return String(left?.hallCode || '').localeCompare(String(right?.hallCode || ''))
}

function renderScheduleLabel(schedule) {
  if (!schedule) {
    return '-'
  }

  return `${formatAssignmentDate(schedule.examDate)} ${schedule.sessionName || '-'} ${getSessionTimeLabel(schedule.sessionName)}`.trim()
}

export default function FacultyPage() {
  const [faculty, setFaculty] = useState([])
  const [halls, setHalls] = useState([])
  const [sessions, setSessions] = useState(['FN', 'AN'])
  const [examTypes, setExamTypes] = useState(['SEMESTER', 'PRACTICAL', 'PERIODIC_TEST'])
  const [scheduleDates, setScheduleDates] = useState([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [assigning, setAssigning] = useState(false)
  const [assigningAll, setAssigningAll] = useState(false)
  const [cancellingAll, setCancellingAll] = useState(false)
  const [cancellingId, setCancellingId] = useState(null)
  const [latestAssignments, setLatestAssignments] = useState([])
  const [historicalAssignments, setHistoricalAssignments] = useState([])
  const [practicalVenues, setPracticalVenues] = useState([])
  const [allocationHallOptions, setAllocationHallOptions] = useState([])
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [assignDialogOpen, setAssignDialogOpen] = useState(false)
  const [assignAllDialogOpen, setAssignAllDialogOpen] = useState(false)
  const [editingFaculty, setEditingFaculty] = useState(null)
  const [selectedFacultyDetails, setSelectedFacultyDetails] = useState(null)
  const [form, setForm] = useState(emptyForm)
  const [assignForm, setAssignForm] = useState({
    hallCode: '',
    examDate: '',
    sessionName: 'FN'
  })
  const [assignAllForm, setAssignAllForm] = useState({
    startDate: '',
    endDate: '',
    sessionName: 'ALL',
    examType: 'SEMESTER'
  })

  const hallOptions = useMemo(
    () =>
      (halls || [])
        .map((hall) => String(hall.hallCode || '').trim())
        .filter(Boolean)
        .sort((a, b) => a.localeCompare(b)),
    [halls]
  )

  const manualHallOptions = useMemo(() => {
    if (allocationHallOptions.length > 0) {
      return allocationHallOptions
    }

    return hallOptions
  }, [allocationHallOptions, hallOptions])

  const scheduledAssignments = useMemo(
    () => latestAssignments.filter((item) => String(item.examDate || '').trim()),
    [latestAssignments]
  )

  const hallsByFacultyId = useMemo(() => {
    const map = new Map()
    for (const item of scheduledAssignments) {
      if (!item.hallCode) {
        continue
      }
      
      let targetId = item.facultyId
      if (!targetId && item.facultyName) {
        const found = faculty.find(f => String(f.fullName).trim() === String(item.facultyName).trim())
        if (found) {
          targetId = found.id
        }
      }

      if (targetId) {
        if (!map.has(targetId)) {
          map.set(targetId, new Set())
        }
        map.get(targetId).add(item.hallCode)
      }
    }

    const result = new Map()
    for (const [key, set] of map.entries()) {
      result.set(key, Array.from(set))
    }
    return result
  }, [scheduledAssignments, faculty])

  const latestScheduleByFacultyId = useMemo(() => {
    const map = new Map()

    for (const item of scheduledAssignments) {
      let targetId = item.facultyId

      if (!targetId && item.facultyName) {
        const found = faculty.find((member) => String(member.fullName).trim() === String(item.facultyName).trim())
        if (found) {
          targetId = found.id
        }
      }

      if (!targetId) {
        continue
      }

      const nextEntry = {
        hallCode: item.hallCode || '-',
        examDate: item.examDate || '',
        sessionName: item.sessionName || ''
      }

      if (!map.has(targetId)) {
        map.set(targetId, [])
      }

      map.get(targetId).push(nextEntry)
    }

    for (const entry of map.values()) {
      entry.sort(compareSchedulesDesc)
    }

    return map
  }, [scheduledAssignments, faculty])

  const historicalHallsByFacultyId = useMemo(() => {
    const map = new Map()
    for (const item of historicalAssignments) {
      if (!item.facultyId || !item.hallCode) {
        continue
      }
      if (!map.has(item.facultyId)) {
        map.set(item.facultyId, new Set())
      }
      map.get(item.facultyId).add(item.hallCode)
    }
    
    // convert Set back to Array to render easily
    const result = new Map()
    for (const [key, set] of map.entries()) {
      result.set(key, Array.from(set).slice(0, 3))
    }
    return result
  }, [historicalAssignments])

  const filteredFaculty = useMemo(() => {
    const normalizedSearch = String(search || '').trim().toLowerCase()
    if (!normalizedSearch) {
      return faculty
    }

    return faculty.filter((item) => {
      const assignedHalls = (hallsByFacultyId.get(item.id) || []).join(' ').toLowerCase()
      return [
        item.fullName,
        item.department,
        item.role,
        assignedHalls
      ].some((value) => String(value || '').toLowerCase().includes(normalizedSearch))
    })
  }, [faculty, hallsByFacultyId, search])

  const facultySummary = useMemo(() => {
    const activeCount = faculty.filter((item) => item.isActive).length
    const assignedCount = faculty.filter((item) => (hallsByFacultyId.get(item.id) || []).length > 0).length

    return {
      total: faculty.length,
      active: activeCount,
      assigned: assignedCount,
      unassigned: Math.max(faculty.length - assignedCount, 0)
    }
  }, [faculty, hallsByFacultyId])

  const exportRows = useMemo(() => {
    const rows = []

    for (const item of scheduledAssignments) {
      const normalizedHallCode = String(item.hallCode || '').trim()
      let facultyName = String(item.facultyName || '').trim()

      if (!facultyName && item.facultyId) {
        const matchedFaculty = faculty.find((member) => Number(member.id) === Number(item.facultyId))
        facultyName = String(matchedFaculty?.fullName || '').trim()
      }

      if (!facultyName || !normalizedHallCode) {
        continue
      }

      rows.push({
        facultyName,
        hallCode: normalizedHallCode,
        examDate: item.examDate || '',
        sessionName: item.sessionName || '-',
        time: getSessionTimeLabel(item.sessionName)
      })
    }

    return rows.sort((left, right) => {
      const leftDate = String(left.examDate || '')
      const rightDate = String(right.examDate || '')
      if (leftDate !== rightDate) {
        return leftDate.localeCompare(rightDate)
      }

      const leftSession = String(left.sessionName || '')
      const rightSession = String(right.sessionName || '')
      if (leftSession !== rightSession) {
        return leftSession.localeCompare(rightSession)
      }

      const hallCompare = String(left.hallCode || '').localeCompare(String(right.hallCode || ''))
      if (hallCompare !== 0) {
        return hallCompare
      }

      return String(left.facultyName || '').localeCompare(String(right.facultyName || ''))
    })
  }, [faculty, scheduledAssignments])

  const loadData = useCallback(async () => {
    setLoading(true)
    setError('')

    try {
      const results = await Promise.allSettled([
        fetchFaculty(),
        fetchLatestFacultyAssignments(),
        fetchHistoricalFacultyAssignments(),
        fetchPracticalHalls(),
        fetchHalls(),
        fetchExamScheduleFilters(),
        fetchLatestAllocation()
      ])

      const getValue = (index, fallback) =>
        results[index].status === 'fulfilled' ? results[index].value || fallback : fallback

      const facultyData = getValue(0, [])
      const assignmentsData = getValue(1, [])
      const historicalData = getValue(2, [])
      const practicalHallsData = getValue(3, [])
      const hallsData = getValue(4, [])
      const scheduleFilters = getValue(5, null)
      const latestAllocation = getValue(6, null)

      setFaculty(facultyData)
      setLatestAssignments(assignmentsData)
      setHistoricalAssignments(historicalData)
      setHalls(hallsData)
      setAllocationHallOptions(
        (latestAllocation?.hallLayouts || [])
          .map((hall) => String(hall.hallCode || '').trim())
          .filter(Boolean)
          .sort((a, b) => a.localeCompare(b))
      )
      setSessions(scheduleFilters?.sessions?.length ? scheduleFilters.sessions : ['FN', 'AN'])
      setExamTypes(scheduleFilters?.examTypes?.length ? scheduleFilters.examTypes : ['SEMESTER', 'PRACTICAL', 'PERIODIC_TEST'])
      setScheduleDates(scheduleFilters?.dates?.length ? scheduleFilters.dates : [])
      setPracticalVenues(
        (practicalHallsData || [])
          .sort((a, b) => String(a.hallCode || '').localeCompare(String(b.hallCode || '')))
      )

      const failed = results.find((result) => result.status === 'rejected')
      if (failed) {
        setError(getErrorMessage(failed.reason, 'Some data could not be loaded. Showing available information.'))
      }
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to load faculty data'))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadData()
  }, [loadData])

  function openCreateDialog() {
    setEditingFaculty(null)
    setForm(emptyForm)
    setDialogOpen(true)
  }

  function openEditDialog(item) {
    setEditingFaculty(item)
    setForm({
      fullName: item.fullName,
      department: item.department,
      role: item.role,
      currentWorkload: item.currentWorkload,
      isActive: item.isActive,
      manualHallCode: ''
    })
    setDialogOpen(true)
  }

  function closeDialog() {
    setDialogOpen(false)
    setEditingFaculty(null)
    setForm(emptyForm)
  }

  function openAssignDialog() {
    setAssignForm({
      hallCode: '',
      examDate: '',
      sessionName: sessions[0] || 'FN'
    })
    setAssignDialogOpen(true)
  }

  function closeAssignDialog() {
    setAssignDialogOpen(false)
    setAssignForm({
      hallCode: '',
      examDate: '',
      sessionName: sessions[0] || 'FN'
    })
  }

  function openAssignAllDialog() {
    const sortedDates = [...scheduleDates].sort((left, right) => String(left).localeCompare(String(right)))
    setAssignAllForm({
      startDate: sortedDates[0] || '',
      endDate: sortedDates[sortedDates.length - 1] || sortedDates[0] || '',
      sessionName: 'ALL',
      examType: examTypes[0] || 'SEMESTER'
    })
    setAssignAllDialogOpen(true)
  }

  function closeAssignAllDialog() {
    setAssignAllDialogOpen(false)
    setAssignAllForm({
      startDate: '',
      endDate: '',
      sessionName: 'ALL',
      examType: 'SEMESTER'
    })
  }

  function openFacultyDetails(item, schedules) {
    setSelectedFacultyDetails({
      faculty: item,
      schedules: schedules || []
    })
  }

  function closeFacultyDetails() {
    setSelectedFacultyDetails(null)
  }

  function onFormChange(field) {
    return (event) => {
      const value = event.target.value
      setForm((prev) => ({
        ...prev,
        [field]: field === 'currentWorkload' ? Number(value) : value
      }))
    }
  }

  async function saveFaculty() {
    setSaving(true)
    setError('')
    setSuccess('')
    try {
      if (editingFaculty) {
        await updateFaculty(editingFaculty.id, form)
      } else {
        await createFaculty(form)
      }
      const selectedManualHall = String(form.manualHallCode || '').trim()
      closeDialog()
      await loadData()
      setSuccess(
        selectedManualHall
          ? `Faculty saved successfully. Assigned to hall ${selectedManualHall} and workload updated.`
          : 'Faculty saved successfully'
      )
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to save faculty'))
    } finally {
      setSaving(false)
    }
  }

  function onAssignChange(field) {
    return (event) => {
      setAssignForm((prev) => ({ ...prev, [field]: event.target.value }))
    }
  }

  function onAssignAllChange(field) {
    return (event) => {
      setAssignAllForm((prev) => ({ ...prev, [field]: event.target.value }))
    }
  }

  async function runAutoAssign() {
    setAssigning(true)
    setError('')
    setSuccess('')
    try {
      const assigned = await autoAssignSupervisor({
        hallCode: assignForm.hallCode || undefined,
        examDate: assignForm.examDate || undefined,
        sessionName: assignForm.sessionName || undefined
      })
      closeAssignDialog()
      setSuccess(
        `Assigned ${assigned.fullName} to ${assigned.hallCode} on ${assigned.examDate} ${assigned.sessionName} - workload ${assigned.workloadText}`
      )
      await loadData()
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to auto assign faculty'))
    } finally {
      setAssigning(false)
    }
  }

  async function runAutoAssignAll() {
    setAssigningAll(true)
    setError('')
    setSuccess('')
    try {
      const result = await autoAssignAllFaculty({
        startDate: assignAllForm.startDate || undefined,
        endDate: assignAllForm.endDate || undefined,
        sessionName: assignAllForm.sessionName || undefined,
        examType: assignAllForm.examType || undefined
      })
      closeAssignAllDialog()
      setSuccess(
        `Auto assign all completed for ${assignAllForm.examType} ${formatAssignmentDate(result.startDate)} to ${formatAssignmentDate(result.endDate)} ${result.sessionName}. Assigned: ${result.assignedCount}, Skipped: ${result.skippedCount}.`
      )
      await loadData()
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to auto assign all halls'))
    } finally {
      setAssigningAll(false)
    }
  }

  async function runCancelAssignment(facultyId) {
    if (!confirmAction('Are you sure you want to cancel this faculty assignment?')) {
      return
    }
    setCancellingId(facultyId)
    setError('')
    setSuccess('')
    try {
      const updated = await cancelFacultyAssignment(facultyId)
      setSuccess(`Cancelled assignment for ${updated.fullName}. Workload reset to ${updated.workloadText}`)
      await loadData()
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to cancel faculty assignment'))
    } finally {
      setCancellingId(null)
    }
  }

  async function runCancelAllAssigned() {
    if (!confirmAction('Are you sure you want to cancel all assigned faculty workloads?')) {
      return
    }
    setCancellingAll(true)
    setError('')
    setSuccess('')
    try {
      const result = await cancelAllAssignedFaculty()
      setSuccess(
        `Cancelled all assigned workload. Faculty reset: ${result.facultyReset}, Hall assignments cleared: ${result.hallsCleared}, Schedule assignments cleared: ${result.schedulesCleared}.`
      )
      await loadData()
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to cancel all assigned workload'))
    } finally {
      setCancellingAll(false)
    }
  }

  function exportAssignedFacultyPdf() {
    if (exportRows.length === 0) {
      setError('No assigned faculty records available to export.')
      return
    }

    setError('')

    const doc = new jsPDF({
      orientation: 'landscape',
      unit: 'mm',
      format: 'a4'
    })

    doc.setFontSize(16)
    doc.text('Assigned Faculty Details', 14, 16)
    doc.setFontSize(10)
    doc.text(`Generated on: ${new Date().toLocaleString('en-IN')}`, 14, 23)

    autoTable(doc, {
      startY: 28,
      head: [['Faculty Name', 'Exam Hall', 'Date', 'Session', 'Time']],
      body: exportRows.map((row) => [
        row.facultyName,
        row.hallCode,
        formatAssignmentDate(row.examDate),
        row.sessionName || '-',
        row.time
      ]),
      styles: {
        fontSize: 10,
        cellPadding: 3
      },
      headStyles: {
        fillColor: [25, 118, 210]
      }
    })

    const today = new Date().toISOString().split('T')[0]
    doc.save(`assigned-faculty-${today}.pdf`)
  }

  return (
    <Box className="app-shell">
      <Box className="page-head">
        <Typography variant="h4" className="brand-title">
          Faculty Workload & Supervisor Assignment
        </Typography>
        <Stack direction="row" spacing={1.5}>
          <Button
            variant="outlined"
            onClick={exportAssignedFacultyPdf}
            disabled={exportRows.length === 0}
          >
            Export PDF
          </Button>
          <Button variant="contained" onClick={openCreateDialog}>
            Add Faculty
          </Button>
        </Stack>
      </Box>

      <Box className="stats-row hall-stats-row">
        <Card className="stats-card hall-stats-card hall-stats-card-active">
          <CardContent className="stats-card-content hall-stats-card-content">
            <Box className="dashboard-summary-title-row">
              <Box className="dashboard-summary-icon-badge dashboard-summary-icon-badge-active">
                <BadgeRoundedIcon fontSize="small" />
              </Box>
              <Typography className="stats-card-label hall-stats-card-label">Faculty Summary</Typography>
            </Box>
            <Typography className="stats-card-value hall-stats-card-value">{facultySummary.total}</Typography>
            <Typography className="stats-card-note hall-stats-card-note">
              Active faculty members
            </Typography>
          </CardContent>
        </Card>
        <Card className="stats-card hall-stats-card hall-stats-card-capacity">
          <CardContent className="stats-card-content hall-stats-card-content">
            <Box className="dashboard-summary-title-row">
              <Box className="dashboard-summary-icon-badge dashboard-summary-icon-badge-capacity">
                <HowToRegRoundedIcon fontSize="small" />
              </Box>
              <Typography className="stats-card-label hall-stats-card-label">Allotted Faculty</Typography>
            </Box>
            <Typography className="stats-card-value hall-stats-card-value">{facultySummary.assigned}</Typography>
            <Typography className="stats-card-note hall-stats-card-note">
              Faculty assigned to halls
            </Typography>
          </CardContent>
        </Card>
        <Card className="stats-card hall-stats-card hall-stats-card-inactive">
          <CardContent className="stats-card-content hall-stats-card-content">
            <Box className="dashboard-summary-title-row">
              <Box className="dashboard-summary-icon-badge dashboard-summary-icon-badge-inactive">
                <PersonOffRoundedIcon fontSize="small" />
              </Box>
              <Typography className="stats-card-label hall-stats-card-label">Unallotted Faculty</Typography>
            </Box>
            <Typography className="stats-card-value hall-stats-card-value">{facultySummary.unassigned}</Typography>
            <Typography className="stats-card-note hall-stats-card-note">
              Faculty not yet assigned
            </Typography>
          </CardContent>
        </Card>
      </Box>

      <Card sx={{ mb: 2, borderRadius: 0 }}>
        <CardContent>
          <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.5}>
            <TextField
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search faculty / department / hall"
              size="small"
              className="faculty-search-compact"
              sx={{ width: { xs: '100%', md: 320 } }}
            />
            <Button
              variant="contained"
              onClick={openAssignDialog}
              size="small"
              className="faculty-compact-action"
              sx={{ minWidth: { xs: '100%', md: 150 }, fontSize: '0.9rem', px: 2, height: 40 }}
            >
              Assign Supervisor
            </Button>
            <Button
              variant="contained"
              color="secondary"
              onClick={openAssignAllDialog}
              disabled={assigningAll}
              size="small"
              className="faculty-compact-action"
              sx={{ minWidth: { xs: '100%', md: 150 }, fontSize: '0.9rem', px: 2, height: 40 }}
            >
              {assigningAll ? 'Assigning All...' : 'Assign All Halls'}
            </Button>
            <Button
              variant="contained"
              color="error"
              onClick={runCancelAllAssigned}
              disabled={cancellingAll}
              size="small"
              sx={{
                fontSize: '0.96rem',
                px: 1.8,
                py: 0.7,
                minWidth: 140,
                ml: { xs: 0, md: 0.5 },
                color: '#fff',
                '&.Mui-disabled': {
                  color: '#fff'
                }
              }}
            >
              {cancellingAll ? 'Cancelling All...' : 'Cancel All Assigned'}
            </Button>
          </Stack>
        </CardContent>
      </Card>

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

      <Box className="faculty-grid">
        {filteredFaculty.map((item) => {
          const progress = item.maxWorkload
            ? Math.min((item.currentWorkload / item.maxWorkload) * 100, 100)
            : 0
          const assignedSchedules = latestScheduleByFacultyId.get(item.id) || []
          const latestSchedule = assignedSchedules[0] || null
          return (
            <Card
              className="hall-card faculty-card"
              key={item.id}
              sx={{
                cursor: assignedSchedules.length > 0 ? 'pointer' : 'default'
              }}
              onClick={() => {
                if (assignedSchedules.length > 0) {
                  openFacultyDetails(item, assignedSchedules)
                }
              }}
            >
              <CardContent className="faculty-card-content">
                <Stack direction="row" justifyContent="space-between" alignItems="center">
                  <Typography variant="h6">{item.fullName}</Typography>
                  <Chip
                    label={item.isActive ? 'Active' : 'Inactive'}
                    color={item.isActive ? 'success' : 'error'}
                    className={`status-chip ${item.isActive ? 'status-chip-active' : 'status-chip-inactive'}`}
                  />
                </Stack>
                <Typography variant="body2" className="faculty-meta faculty-assigned-halls">
                  <span className="faculty-meta-label">Recent assigned hall:</span>{' '}
                  <span className="faculty-meta-value">
                    {latestSchedule?.hallCode || '-'}
                  </span>
                </Typography>
                <Typography variant="body2" className="faculty-meta">
                  <span className="faculty-meta-label">Recent schedule:</span>{' '}
                  <span className="faculty-meta-value">
                    {latestSchedule ? renderScheduleLabel(latestSchedule) : '-'}
                  </span>
                </Typography>

                <Typography variant="body2" className="faculty-meta">
                  <span className="faculty-meta-label">Department:</span>{' '}
                  <span className="faculty-meta-value">{item.department}</span>
                </Typography>
                <Typography variant="body2" className="faculty-meta">
                  <span className="faculty-meta-label">Role:</span>{' '}
                  <span className="faculty-meta-value">{item.role}</span>
                </Typography>
                <Typography variant="body2" className="faculty-meta">
                  <span className="faculty-meta-label">Workload:</span>{' '}
                  <span className="faculty-meta-value">
                    {item.currentWorkload}/{item.maxWorkload}
                  </span>
                </Typography>
                <LinearProgress
                  variant="determinate"
                  value={progress}
                  sx={{ mt: 1.2, mb: 1.2, height: 8, borderRadius: 4 }}
                />
                <Stack direction="row" spacing={0} className="faculty-actions">
                  <Button
                    size="small"
                    variant="outlined"
                    onClick={(event) => {
                      event.stopPropagation()
                      openEditDialog(item)
                    }}
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
                    size="small"
                    variant="outlined"
                    onClick={(event) => {
                      event.stopPropagation()
                      runCancelAssignment(item.id)
                    }}
                    disabled={Number(item.currentWorkload || 0) === 0 || cancellingId === item.id}
                    sx={{
                      color: '#d32f2f',
                      borderColor: '#d32f2f',
                      '&:hover': {
                        borderColor: '#b71c1c',
                        backgroundColor: 'rgba(211, 47, 47, 0.04)'
                      }
                    }}
                  >
                    {cancellingId === item.id ? 'Cancelling...' : 'Cancel Assignment'}
                  </Button>
                </Stack>
              </CardContent>
            </Card>
          )
        })}
      </Box>

      {!loading && filteredFaculty.length === 0 && (
        <Typography sx={{ mt: 2 }}>No faculty found for selected filters.</Typography>
      )}



      <Dialog open={dialogOpen} onClose={closeDialog} fullWidth maxWidth="sm">
        <DialogTitle>{editingFaculty ? 'Edit Faculty' : 'Add Faculty'}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              label="Full Name"
              value={form.fullName}
              onChange={onFormChange('fullName')}
              fullWidth
            />
            <TextField
              label="Department"
              value={form.department}
              onChange={onFormChange('department')}
              fullWidth
            />
            <FormControl fullWidth>
              <InputLabel id="role-field">Role</InputLabel>
              <Select
                labelId="role-field"
                value={form.role}
                label="Role"
                onChange={onFormChange('role')}
              >
                {ROLE_OPTIONS.map((role) => (
                  <MenuItem key={role} value={role}>
                    {role}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <TextField
              label="Current Workload"
              type="number"
              value={form.currentWorkload}
              onChange={onFormChange('currentWorkload')}
              inputProps={{ min: 0 }}
              fullWidth
            />
            {editingFaculty ? (
              <Autocomplete
                options={manualHallOptions}
                value={form.manualHallCode || null}
                onChange={(_, value) => {
                  setForm((prev) => ({
                    ...prev,
                    manualHallCode: String(value || '')
                  }))
                }}
                clearOnEscape
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label="Manual Assign Hall"
                    placeholder="Search exam hall"
                    helperText="Search and select an exam hall"
                    fullWidth
                  />
                )}
              />
            ) : null}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={closeDialog} variant="contained" color="error">
            Cancel
          </Button>
          <Button onClick={saveFaculty} variant="contained" disabled={saving}>
            Save
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={assignDialogOpen} onClose={closeAssignDialog} fullWidth maxWidth="sm">
        <DialogTitle>Auto Assign Supervisor</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <FormControl fullWidth>
              <InputLabel id="assign-hall-label">Hall Code</InputLabel>
              <Select
                labelId="assign-hall-label"
                value={assignForm.hallCode}
                label="Hall Code"
                onChange={onAssignChange('hallCode')}
              >
                {hallOptions.map((hallCode) => (
                  <MenuItem key={hallCode} value={hallCode}>
                    {hallCode}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <TextField
              type="date"
              label="Exam Date"
              value={assignForm.examDate}
              onChange={onAssignChange('examDate')}
              InputLabelProps={{ shrink: true }}
              helperText="mm/dd/yyyy"
              fullWidth
            />
            <FormControl fullWidth>
              <InputLabel id="assign-session-label">Session</InputLabel>
              <Select
                labelId="assign-session-label"
                value={assignForm.sessionName}
                label="Session"
                onChange={onAssignChange('sessionName')}
              >
                {sessions.map((session) => (
                  <MenuItem key={session} value={session}>
                    {session}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={closeAssignDialog} variant="contained" color="error">
            Cancel
          </Button>
          <Button
            onClick={runAutoAssign}
            variant="contained"
            disabled={assigning || !assignForm.hallCode || !assignForm.examDate || !assignForm.sessionName}
          >
            {assigning ? 'Assigning...' : 'Assign'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={assignAllDialogOpen} onClose={closeAssignAllDialog} fullWidth maxWidth="sm">
        <DialogTitle>Assign All Halls</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <FormControl fullWidth>
              <InputLabel id="assign-all-exam-type-label">Exam Type</InputLabel>
              <Select
                labelId="assign-all-exam-type-label"
                value={assignAllForm.examType}
                label="Exam Type"
                onChange={onAssignAllChange('examType')}
              >
                {examTypes.map((examType) => (
                  <MenuItem key={examType} value={examType}>
                    {examType === 'PERIODIC_TEST' ? 'PT' : examType === 'SEMESTER' ? 'SEM' : 'PRACTICAL'}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <TextField
              type="date"
              label="Start Date"
              value={assignAllForm.startDate}
              onChange={onAssignAllChange('startDate')}
              InputLabelProps={{ shrink: true }}
              fullWidth
            />
            <TextField
              type="date"
              label="End Date"
              value={assignAllForm.endDate}
              onChange={onAssignAllChange('endDate')}
              InputLabelProps={{ shrink: true }}
              fullWidth
            />
            <FormControl fullWidth>
              <InputLabel id="assign-all-session-label">Session</InputLabel>
              <Select
                labelId="assign-all-session-label"
                value={assignAllForm.sessionName}
                label="Session"
                onChange={onAssignAllChange('sessionName')}
              >
                <MenuItem value="ALL">All Sessions</MenuItem>
                {sessions.map((session) => (
                  <MenuItem key={session} value={session}>
                    {session}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={closeAssignAllDialog} variant="contained" color="error">
            Cancel
          </Button>
            <Button
              onClick={runAutoAssignAll}
              variant="contained"
              disabled={assigningAll || !assignAllForm.startDate || !assignAllForm.endDate || !assignAllForm.sessionName || !assignAllForm.examType}
            >
              {assigningAll ? 'Assigning All...' : 'Assign All'}
            </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={Boolean(selectedFacultyDetails)} onClose={closeFacultyDetails} fullWidth maxWidth="md">
        <DialogTitle>
          {selectedFacultyDetails?.faculty?.fullName || 'Faculty Assignment Details'}
        </DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <Card variant="outlined">
              <CardContent>
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                  <Typography variant="body2" className="faculty-meta">
                    <span className="faculty-meta-label">Department:</span>{' '}
                    <span className="faculty-meta-value">{selectedFacultyDetails?.faculty?.department || '-'}</span>
                  </Typography>
                  <Typography variant="body2" className="faculty-meta">
                    <span className="faculty-meta-label">Role:</span>{' '}
                    <span className="faculty-meta-value">{selectedFacultyDetails?.faculty?.role || '-'}</span>
                  </Typography>
                  <Typography variant="body2" className="faculty-meta">
                    <span className="faculty-meta-label">Workload:</span>{' '}
                    <span className="faculty-meta-value">
                      {selectedFacultyDetails?.faculty
                        ? `${selectedFacultyDetails.faculty.currentWorkload}/${selectedFacultyDetails.faculty.maxWorkload}`
                        : '-'}
                    </span>
                  </Typography>
                </Stack>
              </CardContent>
            </Card>

            <Box
              sx={{
                border: '1px solid #d7deea',
                borderRadius: 2,
                overflow: 'hidden'
              }}
            >
              <Box
                sx={{
                  display: 'grid',
                  gridTemplateColumns: { xs: '1.1fr 1fr', sm: '1.2fr 1fr 0.8fr 1.2fr' },
                  gap: 0,
                  backgroundColor: '#eef4ff',
                  borderBottom: '1px solid #d7deea',
                  fontWeight: 700
                }}
              >
                <Box sx={{ px: 2, py: 1.5 }}>Exam Hall</Box>
                <Box sx={{ px: 2, py: 1.5 }}>Date</Box>
                <Box sx={{ px: 2, py: 1.5, display: { xs: 'none', sm: 'block' } }}>Session</Box>
                <Box sx={{ px: 2, py: 1.5, display: { xs: 'none', sm: 'block' } }}>Time</Box>
              </Box>

              {(selectedFacultyDetails?.schedules || []).length > 0 ? (
                selectedFacultyDetails.schedules.map((schedule, index) => (
                  <Box
                    key={`${schedule.hallCode}-${schedule.examDate}-${schedule.sessionName}-${index}`}
                    sx={{
                      display: 'grid',
                      gridTemplateColumns: { xs: '1.1fr 1fr', sm: '1.2fr 1fr 0.8fr 1.2fr' },
                      borderBottom:
                        index === selectedFacultyDetails.schedules.length - 1 ? 'none' : '1px solid #edf1f7',
                      backgroundColor: index % 2 === 0 ? '#ffffff' : '#fafcff'
                    }}
                  >
                    <Box sx={{ px: 2, py: 1.5 }}>
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>
                        {schedule.hallCode || '-'}
                      </Typography>
                      <Typography variant="caption" sx={{ display: { xs: 'block', sm: 'none' }, color: '#4b5563' }}>
                        {schedule.sessionName || '-'} | {getSessionTimeLabel(schedule.sessionName)}
                      </Typography>
                    </Box>
                    <Box sx={{ px: 2, py: 1.5 }}>
                      <Typography variant="body2">{formatAssignmentDate(schedule.examDate)}</Typography>
                    </Box>
                    <Box sx={{ px: 2, py: 1.5, display: { xs: 'none', sm: 'block' } }}>
                      <Typography variant="body2">{schedule.sessionName || '-'}</Typography>
                    </Box>
                    <Box sx={{ px: 2, py: 1.5, display: { xs: 'none', sm: 'block' } }}>
                      <Typography variant="body2">{getSessionTimeLabel(schedule.sessionName)}</Typography>
                    </Box>
                  </Box>
                ))
              ) : (
                <Box sx={{ px: 2, py: 2 }}>
                  <Typography variant="body2">No assigned schedules available.</Typography>
                </Box>
              )}
            </Box>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={closeFacultyDetails} variant="contained">
            Close
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}
