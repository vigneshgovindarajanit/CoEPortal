import { useCallback, useEffect, useMemo, useState } from 'react'
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

export default function FacultyPage() {
  const [faculty, setFaculty] = useState([])
  const [halls, setHalls] = useState([])
  const [sessions, setSessions] = useState(['FN', 'AN'])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [assigning, setAssigning] = useState(false)
  const [assigningAll, setAssigningAll] = useState(false)
  const [cancellingAll, setCancellingAll] = useState(false)
  const [cancellingId, setCancellingId] = useState(null)
  const [latestAssignments, setLatestAssignments] = useState([])
  const [practicalVenues, setPracticalVenues] = useState([])
  const [allocationHallOptions, setAllocationHallOptions] = useState([])
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [assignDialogOpen, setAssignDialogOpen] = useState(false)
  const [editingFaculty, setEditingFaculty] = useState(null)
  const [form, setForm] = useState(emptyForm)
  const [assignForm, setAssignForm] = useState({
    hallCode: '',
    examDate: '',
    sessionName: 'FN'
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

  const hallsByFacultyId = useMemo(() => {
    const map = new Map()
    for (const item of latestAssignments) {
      if (!item.facultyId || !item.hallCode) {
        continue
      }
      if (!map.has(item.facultyId)) {
        map.set(item.facultyId, [])
      }
      map.get(item.facultyId).push(item.hallCode)
    }
    return map
  }, [latestAssignments])

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

  const loadData = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const [facultyData, assignmentsData, practicalHallsData, hallsData, scheduleFilters, latestAllocation] = await Promise.all([
        fetchFaculty(),
        fetchLatestFacultyAssignments(),
        fetchPracticalHalls(),
        fetchHalls(),
        fetchExamScheduleFilters(),
        fetchLatestAllocation()
      ])
      setFaculty(facultyData || [])
      setLatestAssignments(assignmentsData || [])
      setHalls(hallsData || [])
      setAllocationHallOptions(
        (latestAllocation?.hallLayouts || [])
          .map((hall) => String(hall.hallCode || '').trim())
          .filter(Boolean)
          .sort((a, b) => a.localeCompare(b))
      )
      setSessions(scheduleFilters?.sessions?.length ? scheduleFilters.sessions : ['FN', 'AN'])
      setPracticalVenues(
        (practicalHallsData || [])
          .sort((a, b) => String(a.hallCode || '').localeCompare(String(b.hallCode || '')))
      )
    } catch {
      try {
        const [facultyData, practicalHallsData, hallsData] = await Promise.all([
          fetchFaculty(),
          fetchPracticalHalls(),
          fetchHalls()
        ])
        setFaculty(facultyData || [])
        setLatestAssignments([])
        setHalls(hallsData || [])
        setAllocationHallOptions([])
        setSessions(['FN', 'AN'])
        setPracticalVenues(
          (practicalHallsData || [])
            .sort((a, b) => String(a.hallCode || '').localeCompare(String(b.hallCode || '')))
        )
      } catch (innerErr) {
        setError(getErrorMessage(innerErr, 'Failed to load faculty data'))
      }
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
      const result = await autoAssignAllFaculty()
      setSuccess(
        `Auto assign all completed. Assigned: ${result.assignedCount}, Skipped: ${result.skippedCount}.`
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

  return (
    <Box className="app-shell">
      <Box className="page-head">
        <Typography variant="h4" className="brand-title">
          Faculty Workload & Supervisor Assignment
        </Typography>
        <Button variant="contained" onClick={openCreateDialog}>
          Add Faculty
        </Button>
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
              onClick={runAutoAssignAll}
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
          const assignedHalls = hallsByFacultyId.get(item.id) || []
          return (
            <Card className="hall-card faculty-card" key={item.id}>
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
                  <span className="faculty-meta-label">Assigned Hall(s):</span>{' '}
                  <span className="faculty-meta-value">
                    {assignedHalls.length > 0 ? assignedHalls.join(', ') : 'Not assigned'}
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
                    size="small"
                    variant="outlined"
                    onClick={() => runCancelAssignment(item.id)}
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

      <Card sx={{ mt: 2 }}>
        <CardContent>
          <Box className="faculty-grid">
            {practicalVenues.map((venue) => (
              <Card className="hall-card faculty-card" key={venue.id || venue.hallCode}>
                <CardContent className="faculty-card-content">
                  <Stack direction="row" justifyContent="space-between" alignItems="center">
                    <Typography variant="h6">{venue.hallCode}</Typography>
                    <Chip
                      label={venue.isActive ? 'Active' : 'Inactive'}
                      color={venue.isActive ? 'success' : 'error'}
                      className={`status-chip ${venue.isActive ? 'status-chip-active' : 'status-chip-inactive'}`}
                    />
                  </Stack>
                  <Typography variant="body2" className="faculty-meta">
                    <span className="faculty-meta-label">Rows:</span>{' '}
                    <span className="faculty-meta-value">{venue.rows}</span>
                  </Typography>
                  <Typography variant="body2" className="faculty-meta">
                    <span className="faculty-meta-label">Cols:</span>{' '}
                    <span className="faculty-meta-value">{venue.cols}</span>
                  </Typography>
                  <Typography variant="body2" className="faculty-meta">
                    <span className="faculty-meta-label">Students/Bench:</span>{' '}
                    <span className="faculty-meta-value">{venue.studentsPerBench}</span>
                  </Typography>
                  <Typography variant="body2" className="faculty-meta">
                    <span className="faculty-meta-label">Exam Type:</span>{' '}
                    <span className="faculty-meta-value">{String(venue.examType || 'SEMESTER')}</span>
                  </Typography>
                  <Typography variant="body2" className="faculty-meta">
                    <span className="faculty-meta-label">Capacity:</span>{' '}
                    <span className="faculty-meta-value">{venue.capacity}</span>
                  </Typography>
                  <Typography variant="body2" className="faculty-meta">
                    <span className="faculty-meta-label">Supervisors:</span>{' '}
                    <span className="faculty-meta-value">{venue.supervisors}</span>
                  </Typography>
                  <Typography variant="body2" className="faculty-meta">
                    <span className="faculty-meta-label">Supervisor Allocation:</span>{' '}
                    <span className="faculty-meta-value">Auto</span>
                  </Typography>
                  <Typography variant="body2" className="faculty-meta">
                    <span className="faculty-meta-label">Student Occupancy Strength:</span>{' '}
                    <span className="faculty-meta-value">{venue.capacity} / {venue.capacity}</span>
                  </Typography>
                </CardContent>
              </Card>
            ))}
          </Box>
        </CardContent>
      </Card>

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
    </Box>
  )
}
