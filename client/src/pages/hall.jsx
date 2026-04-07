import { useEffect, useMemo, useState } from 'react'
import {
  Alert,
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
  Switch,
  TextField,
  Typography
} from '@mui/material'
import ApartmentRoundedIcon from '@mui/icons-material/ApartmentRounded'
import BlockRoundedIcon from '@mui/icons-material/BlockRounded'
import ChairRoundedIcon from '@mui/icons-material/ChairRounded'
import ScienceRoundedIcon from '@mui/icons-material/ScienceRounded'
import FactCheckRoundedIcon from '@mui/icons-material/FactCheckRounded'
import api from '../lib/api'
import { confirmAction } from '../utils/confirmAction'

const BLOCK_OPTIONS = ['EW', 'WW', 'ME', 'SF', 'AE', 'MH']
const REGULAR_HALL_BLOCK_ORDER = ['EW', 'WW', 'ME', 'SF', 'AE', 'MH']
const STUDENTS_PER_BENCH_OPTIONS = [1, 2]
const EXAM_TYPE_OPTIONS = [
  { label: 'Periodic Test', value: 'PERIODIC_TEST' },
  { label: 'Semester', value: 'SEMESTER' },
  { label: 'Practical', value: 'PRACTICAL' }
]
const HALL_EXAM_TYPE_OPTIONS = EXAM_TYPE_OPTIONS
const PRACTICAL_VENUE_RULES = [
  { prefix: 'IT LAB', min: 1, max: 5 },
  { prefix: 'CSE LAB', min: 1, max: 5 },
  { prefix: 'ME LAB', min: 1, max: 6 },
  { prefix: 'CT LAB', min: 1, max: 2 },
  { prefix: 'AIML LAB', min: 1, max: 6 },
  { exact: 'WORKSHOP LAB' }
]
const PRACTICAL_LAB_GROUPS = [
  { title: 'IT Labs', halls: ['IT LAB 1', 'IT LAB 2', 'IT LAB 3', 'IT LAB 4', 'IT LAB 5'] },
  { title: 'CSE Labs', halls: ['CSE LAB 1', 'CSE LAB 2', 'CSE LAB 3', 'CSE LAB 4', 'CSE LAB 5'] },
  { title: 'ME Labs', halls: ['ME LAB 1', 'ME LAB 2', 'ME LAB 3', 'ME LAB 4', 'ME LAB 5', 'ME LAB 6'] },
  { title: 'CT Labs', halls: ['CT LAB 1', 'CT LAB 2'] },
  { title: 'AIML Labs', halls: ['AIML LAB 1', 'AIML LAB 2', 'AIML LAB 3', 'AIML LAB 4', 'AIML LAB 5', 'AIML LAB 6'] },
  { title: 'Workshop Labs', halls: ['WORKSHOP LAB'] }
]
const PRACTICAL_DEFAULT_ROWS = 6
const PRACTICAL_DEFAULT_COLS = 10
const PRACTICAL_DEFAULT_STUDENTS_PER_BENCH = 1
const PRACTICAL_DEFAULT_CAPACITY = 60

function getDefaultHallForm(examType = 'SEMESTER') {
  const normalizedExamType = String(examType || 'SEMESTER').toUpperCase()

  if (normalizedExamType === 'PRACTICAL') {
    return {
      block: 'EW',
      number: '',
      rows: PRACTICAL_DEFAULT_ROWS,
      cols: PRACTICAL_DEFAULT_COLS,
      studentsPerBench: PRACTICAL_DEFAULT_STUDENTS_PER_BENCH,
      examType: normalizedExamType
    }
  }

  return {
    block: 'EW',
    number: '',
    rows: 5,
    cols: 5,
    studentsPerBench: getDefaultStudentsPerBenchByExamType(normalizedExamType),
    examType: normalizedExamType
  }
}

function calculateCapacity(rows, cols, studentsPerBench, examType = 'SEMESTER') {
  if (String(examType || 'SEMESTER').toUpperCase() === 'PRACTICAL') {
    return PRACTICAL_DEFAULT_CAPACITY
  }
  return Number(rows || 0) * Number(cols || 0) * Number(studentsPerBench || 0)
}

function getDefaultStudentsPerBenchByExamType(examType) {
  if (examType === 'PRACTICAL') {
    return PRACTICAL_DEFAULT_STUDENTS_PER_BENCH
  }
  return examType === 'PERIODIC_TEST' ? 2 : 1
}

function getExamTypeLabel(examType) {
  return EXAM_TYPE_OPTIONS.find((item) => item.value === examType)?.label || examType
}

function getHallExamType(examType) {
  const normalizedExamType = String(examType || 'SEMESTER').toUpperCase()
  return normalizedExamType === 'PRACTICAL' ? 'PRACTICAL' : 'SEMESTER'
}

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
    String(hall?.examType || '').trim().toUpperCase() === 'PRACTICAL' ||
    isAllowedPracticalVenue(hall?.hallCode)
  )
}

function normalizeHall(hall) {
  const hallCode = hall.hallCode ?? hall.hall_code
  const normalizedExamType = getHallExamType(hall.examType ?? hall.exam_type ?? 'SEMESTER')
  const derivedExamType = isAllowedPracticalVenue(hallCode) ? 'PRACTICAL' : normalizedExamType

  return {
    ...hall,
    block: hall.block ?? hall.block_name,
    number: hall.number ?? hall.hall_number,
    rows: hall.rows ?? hall.seat_rows,
    cols: hall.cols ?? hall.seat_cols,
    hallCode,
    studentsPerBench: hall.studentsPerBench ?? hall.students_per_bench,
    examType: derivedExamType,
    isActive: hall.isActive ?? Boolean(hall.is_active)
  }
}

export default function Hall() {
  const [halls, setHalls] = useState([])
  const [search, setSearch] = useState('')
  const [globalExamType, setGlobalExamType] = useState('SEMESTER')
  const [stats, setStats] = useState({
    activeHalls: 0,
    inactiveHalls: 0,
    totalCapacity: 0
  })
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingHall, setEditingHall] = useState(null)
  const [form, setForm] = useState(getDefaultHallForm())

  const previewCapacity = useMemo(
    () => calculateCapacity(form.rows, form.cols, form.studentsPerBench, form.examType),
    [form]
  )

  const visibleHalls = useMemo(() => {
    if (globalExamType === 'PRACTICAL') {
      return halls.filter((hall) => isPracticalOnlyHall(hall))
    }

    return halls.filter(
      (hall) =>
        !isPracticalOnlyHall(hall) &&
        getHallExamType(hall.examType || 'SEMESTER') === globalExamType
    )
  }, [globalExamType, halls])

  const isPracticalView = globalExamType === 'PRACTICAL'

  const displayedHalls = useMemo(() => {
    if (isPracticalView) {
      return visibleHalls
    }

    return visibleHalls.map((hall) => {
      const normalizedExamType = getHallExamType(hall.examType || 'SEMESTER')
      const studentsPerBench = getDefaultStudentsPerBenchByExamType(normalizedExamType)
      const capacity = calculateCapacity(hall.rows, hall.cols, studentsPerBench, normalizedExamType)
      const supervisors = (hall.block === 'SF' || hall.block === 'ME' || capacity >= 45) ? 2 : 1

      return {
        ...hall,
        examType: normalizedExamType,
        studentsPerBench,
        capacity,
        supervisors
      }
    })
  }, [isPracticalView, visibleHalls])

  const groupedDisplayedHalls = useMemo(
    () =>
      REGULAR_HALL_BLOCK_ORDER.map((block) => ({
        title: block,
        items: displayedHalls.filter((hall) => String(hall.block || '').toUpperCase() === block)
      })).filter((group) => group.items.length > 0),
    [displayedHalls]
  )

  const practicalHallLookup = useMemo(() => {
    const map = new Map()
    for (const hall of halls) {
      map.set(normalizeHallName(hall.hallCode), hall)
    }
    return map
  }, [halls])

  const practicalLabSections = useMemo(() => {
    const query = normalizeHallName(search)

    return PRACTICAL_LAB_GROUPS.map((group) => ({
      ...group,
      items: group.halls
        .map((hallCode) => {
          const existing = practicalHallLookup.get(normalizeHallName(hallCode))
          return existing || {
            id: null,
            hallCode,
            rows: PRACTICAL_DEFAULT_ROWS,
            cols: PRACTICAL_DEFAULT_COLS,
            studentsPerBench: PRACTICAL_DEFAULT_STUDENTS_PER_BENCH,
            examType: 'PRACTICAL',
            isActive: false,
            capacity: PRACTICAL_DEFAULT_CAPACITY,
            supervisors: 1,
            isPlaceholder: true
          }
        })
        .filter((hall) => !query || normalizeHallName(hall.hallCode).includes(query))
    })).filter((group) => group.items.length > 0)
  }, [practicalHallLookup, search])

  const practicalStats = useMemo(() => {
    const practicalItems = practicalLabSections.flatMap((group) => group.items)
    const totalPracticalHalls = practicalItems.length
    const totalPracticalCapacity = practicalItems.reduce(
      (sum, hall) => sum + Number(hall.capacity || 0),
      0
    )
    const activePracticalHalls = practicalItems.filter((hall) => hall.isActive).length

    return [
      {
        key: 'practical-halls',
        label: 'Practical Halls',
        value: totalPracticalHalls,
        tone: 'active',
        note: 'Allowed lab venues',
        icon: <ScienceRoundedIcon fontSize="small" />
      },
      {
        key: 'practical-active',
        label: 'Active Labs',
        value: activePracticalHalls,
        tone: 'available',
        note: 'Ready for practical exams',
        icon: <FactCheckRoundedIcon fontSize="small" />
      },
      {
        key: 'practical-capacity',
        label: 'Practical Capacity',
        value: Number(totalPracticalCapacity || 0).toLocaleString('en-IN'),
        tone: 'capacity',
        note: 'Total practical seating',
        icon: <ChairRoundedIcon fontSize="small" />
      }
    ]
  }, [practicalLabSections])

  const statCards = useMemo(
    () => [
      {
        key: 'active',
        label: 'Active Halls',
        value: displayedHalls.filter((hall) => hall.isActive).length,
        tone: 'active',
        note: 'Ready for scheduling',
        icon: <ApartmentRoundedIcon fontSize="small" />
      },
      {
        key: 'inactive',
        label: 'Inactive Halls',
        value: displayedHalls.filter((hall) => !hall.isActive).length,
        tone: 'inactive',
        note: 'Review',
        icon: <BlockRoundedIcon fontSize="small" />
      },
      {
        key: 'capacity',
        label: 'Total Capacity (Active)',
        value: displayedHalls
          .filter((hall) => hall.isActive)
          .reduce((sum, hall) => sum + Number(hall.capacity || 0), 0)
          .toLocaleString('en-IN'),
        tone: 'capacity',
        note: 'Seats from active halls',
        icon: <ChairRoundedIcon fontSize="small" />
      }
    ],
    [displayedHalls]
  )

  async function fetchHalls(currentSearch = '') {
    setLoading(true)
    setError('')
    try {
      const [hallsRes, statsRes] = await Promise.all([
        api.get('/halls', { params: { search: currentSearch } }),
        api.get('/halls/stats')
      ])
      setHalls((hallsRes.data || []).map(normalizeHall))
      setStats(statsRes.data)
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Failed to load halls')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchHalls(isPracticalView ? '' : search)
  }, [search, isPracticalView])

  function openCreateDialog() {
    setEditingHall(null)
    setForm(getDefaultHallForm(globalExamType))
    setDialogOpen(true)
  }

  function openEditDialog(hall) {
    setEditingHall(hall)
    setForm({
      block: hall.block,
      number: hall.number,
      rows: hall.rows,
      cols: hall.cols,
      studentsPerBench: hall.studentsPerBench,
      examType: getHallExamType(hall.examType || 'SEMESTER')
    })
    setDialogOpen(true)
  }

  function closeDialog() {
    setDialogOpen(false)
    setEditingHall(null)
    setForm(getDefaultHallForm(globalExamType))
  }

  function onFormFieldChange(field) {
    return (event) => {
      const value = event.target.value
      if (field === 'examType') {
        const normalizedExamType = String(value || 'SEMESTER').toUpperCase()
        setForm((prev) => ({
          ...prev,
          ...getDefaultHallForm(normalizedExamType),
          block: prev.block,
          number: prev.number
        }))
        return
      }

      setForm((prev) => ({
        ...prev,
        [field]:
          field === 'rows' || field === 'cols' || field === 'studentsPerBench'
            ? Number(value)
            : value
      }))
    }
  }

  async function saveHall() {
    setSaving(true)
    setError('')
    try {
      const payload = {
        ...form,
        number: String(form.number).trim()
      }
      if (editingHall) {
        await api.put(`/halls/${editingHall.id}`, payload)
      } else {
        await api.post('/halls', payload)
      }

      closeDialog()
      await fetchHalls(isPracticalView ? '' : search)
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Failed to save hall')
    } finally {
      setSaving(false)
    }
  }

  async function toggleHallStatus(hall) {
    setError('')
    try {
      await api.patch(`/halls/${hall.id}/status`, { isActive: !hall.isActive })
      await fetchHalls(isPracticalView ? '' : search)
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Failed to update hall status')
    }
  }

  async function deleteHall(id) {
    if (!confirmAction('Are you sure you want to delete this hall?')) {
      return
    }
    setError('')
    try {
      await api.delete(`/halls/${id}`)
      await fetchHalls(isPracticalView ? '' : search)
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Failed to delete hall')
    }
  }

  return (
    <Box className="app-shell">
      <Box className="page-head">
        <Typography variant="h4" className="brand-title">
          {isPracticalView ? 'Practical Hall Page' : 'Exam Hall Management'}
        </Typography>
      </Box>

      <Box className="stats-row hall-stats-row">
        {(isPracticalView ? practicalStats : statCards).map((item) => (
          <Card key={item.key} className={`stats-card stats-card-${item.tone} hall-stats-card hall-stats-card-${item.tone}`}>
            <CardContent className="stats-card-content hall-stats-card-content">
              <Box className="dashboard-summary-title-row">
                <Box className={`dashboard-summary-icon-badge dashboard-summary-icon-badge-${item.tone}`}>
                  {item.icon}
                </Box>
                <Typography variant="body2" className="stats-card-label hall-stats-card-label">
                  {item.label}
                </Typography>
              </Box>
              <Typography variant="h4" className="stats-card-value hall-stats-card-value">
                {item.value}
              </Typography>
              <Typography variant="caption" className="stats-card-note hall-stats-card-note">
                {item.note}
              </Typography>
            </CardContent>
          </Card>
        ))}
      </Box>

      <Box className="hall-toolbar-panel">
        <Stack
          direction={{ xs: 'column', md: 'row' }}
          spacing={1.5}
          sx={{ mb: 0 }}
          className="hall-toolbar"
        >
          <TextField
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search hall (e.g. ew102 or ew 102)"
            size="small"
            className="hall-search-compact"
            sx={{ width: { xs: '100%', md: 420 } }}
          />
          <FormControl size="small" sx={{ minWidth: { xs: '100%', md: 220 } }}>
            <Select
              value={globalExamType}
              inputProps={{ 'aria-label': 'Global Exam Type' }}
              onChange={(event) => setGlobalExamType(event.target.value)}
              disabled={loading}
            >
              {HALL_EXAM_TYPE_OPTIONS.map((item) => (
                <MenuItem key={item.value} value={item.value}>
                  {item.label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <Button
            variant="contained"
            onClick={openCreateDialog}
            size="small"
            sx={{ fontSize: '0.96rem', px: 1.8, py: 0.7, minWidth: 140 }}
          >
            {isPracticalView ? 'Add Practical Hall' : 'Add Hall'}
          </Button>
        </Stack>
      </Box>

      {isPracticalView && (
        <Card className="dashboard-panel" sx={{ mb: 2 }}>
          <CardContent className="dashboard-panel-content">
            <Typography className="dashboard-panel-title">Practical Laboratory Layout</Typography>
            <Typography className="dashboard-panel-subtitle">
              Practical labs are grouped by department and displayed with the same management card style used for semester exam halls.
            </Typography>
          </CardContent>
        </Card>
      )}

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

      {isPracticalView ? (
        <Box className="practical-lab-sections">
          {practicalLabSections.map((section) => (
            <Box key={section.title} className="practical-lab-section">
              <Typography className="practical-lab-section-title">{section.title}</Typography>
              <Box className="hall-grid">
                {section.items.map((hall) => {
                  const occupancyPercentage = hall.isActive ? 100 : 0
                  return (
                    <Card className="hall-card hall-ui-card" key={hall.id || hall.hallCode}>
                      <CardContent className="hall-card-content">
                        <Stack direction="row" justifyContent="space-between" alignItems="center">
                          <Typography variant="h6">{hall.hallCode}</Typography>
                          <Chip
                            label={hall.isPlaceholder ? 'Pending' : hall.isActive ? 'Active' : 'Inactive'}
                            color={hall.isPlaceholder ? 'warning' : hall.isActive ? 'success' : 'error'}
                            className={`status-chip ${
                              hall.isPlaceholder
                                ? ''
                                : hall.isActive
                                  ? 'status-chip-active'
                                  : 'status-chip-inactive'
                            }`}
                          />
                        </Stack>

                        <Box className="hall-meta-grid">
                          <Box className="hall-meta-row">
                            <span className="hall-meta-chip">
                              <span className="hall-meta-label">Rows</span>
                              <span className="hall-meta-value">{hall.rows || '-'}</span>
                            </span>
                            <span className="hall-meta-chip">
                              <span className="hall-meta-label">Cols</span>
                              <span className="hall-meta-value">{hall.cols || '-'}</span>
                            </span>
                            <span className="hall-meta-chip">
                              <span className="hall-meta-label">Students/Bench</span>
                              <span className="hall-meta-value">{hall.studentsPerBench}</span>
                            </span>
                          </Box>
                          <Box className="hall-meta-row">
                            <span className="hall-meta-chip hall-meta-chip-wide">
                              <span className="hall-meta-label">Exam Type</span>
                              <span className="hall-meta-value">Practical</span>
                            </span>
                          </Box>
                          <Box className="hall-meta-row">
                            <span className="hall-meta-chip">
                              <span className="hall-meta-label">Capacity</span>
                              <span className="hall-meta-value">{hall.capacity}</span>
                            </span>
                            <span className="hall-meta-chip">
                              <span className="hall-meta-label">Supervisors</span>
                              <span className="hall-meta-value">{hall.supervisors || '-'}</span>
                            </span>
                          </Box>
                        </Box>

                        <Box sx={{ mt: 1.2 }}>
                          <Typography variant="caption">Student Occupancy Strength</Typography>
                          <LinearProgress
                            variant="determinate"
                            color={hall.isActive ? 'primary' : 'inherit'}
                            value={occupancyPercentage}
                            sx={{ height: 8, borderRadius: 4 }}
                          />
                        </Box>

                        <Stack direction="row" spacing={1} className="hall-actions">
                          <Button
                            size="small"
                            variant="outlined"
                            onClick={() => (hall.isPlaceholder ? openCreateDialog() : openEditDialog(hall))}
                            sx={{
                              color: '#7b1fa2',
                              borderColor: '#7b1fa2',
                              '&:hover': {
                                borderColor: '#6a1b9a',
                                backgroundColor: 'rgba(123, 31, 162, 0.04)'
                              }
                            }}
                          >
                            {hall.isPlaceholder ? 'Add Details' : 'Edit'}
                          </Button>
                          {!hall.isPlaceholder && (
                            <Button
                              size="small"
                              variant="outlined"
                              onClick={() => deleteHall(hall.id)}
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
                          )}
                        </Stack>
                      </CardContent>
                    </Card>
                  )
                })}
              </Box>
            </Box>
          ))}
        </Box>
      ) : (
      <Box className="practical-lab-sections">
        {groupedDisplayedHalls.map((section) => (
          <Box key={section.title} className="practical-lab-section">
            <Typography className="practical-lab-section-title">{section.title}</Typography>
            <Box className="hall-grid">
              {section.items.map((hall) => {
                const occupancyPercentage = hall.isActive ? 100 : 0
                return (
                  <Card className="hall-card hall-ui-card" key={hall.id}>
                    <CardContent className="hall-card-content">
                      <Stack direction="row" justifyContent="space-between" alignItems="center">
                        <Typography variant="h6">{hall.hallCode}</Typography>
                        <Chip
                          label={hall.isActive ? 'Active' : 'Inactive'}
                          color={hall.isActive ? 'success' : 'error'}
                          className={`status-chip ${hall.isActive ? 'status-chip-active' : 'status-chip-inactive'}`}
                        />
                      </Stack>

                      <Box className="hall-meta-grid">
                        <Box className="hall-meta-row">
                          <span className="hall-meta-chip">
                            <span className="hall-meta-label">Rows</span>
                            <span className="hall-meta-value">{hall.rows}</span>
                          </span>
                          <span className="hall-meta-chip">
                            <span className="hall-meta-label">Cols</span>
                            <span className="hall-meta-value">{hall.cols}</span>
                          </span>
                          <span className="hall-meta-chip">
                            <span className="hall-meta-label">Students/Bench</span>
                            <span className="hall-meta-value">{hall.studentsPerBench}</span>
                          </span>
                        </Box>
                        <Box className="hall-meta-row">
                          <span className="hall-meta-chip hall-meta-chip-wide">
                            <span className="hall-meta-label">Exam Type</span>
                            <span className="hall-meta-value">{getExamTypeLabel(hall.examType)}</span>
                          </span>
                        </Box>
                        <Box className="hall-meta-row">
                          <span className="hall-meta-chip">
                            <span className="hall-meta-label">Capacity</span>
                            <span className="hall-meta-value">{hall.capacity}</span>
                          </span>
                          <span className="hall-meta-chip">
                            <span className="hall-meta-label">Supervisors</span>
                            <span className="hall-meta-value">{hall.supervisors}</span>
                          </span>
                        </Box>
                      </Box>

                      <Box sx={{ mt: 1.2 }}>
                        <Typography variant="caption">Student Occupancy Strength</Typography>
                        <LinearProgress
                          variant="determinate"
                          color={hall.isActive ? 'primary' : 'inherit'}
                          value={occupancyPercentage}
                          sx={{ height: 8, borderRadius: 4 }}
                        />
                      </Box>

                      <Stack direction="row" alignItems="center" spacing={1} sx={{ mt: 1.4 }}>
                        <Typography variant="body2" className="hall-meta-value status-text-inactive">
                          Inactive
                        </Typography>
                        <Switch checked={hall.isActive} onChange={() => toggleHallStatus(hall)} size="small" />
                        <Typography variant="body2" className="hall-meta-value status-text-active">
                          Active
                        </Typography>
                      </Stack>

                      <Stack direction="row" spacing={1} className="hall-actions">
                        <Button
                          size="small"
                          variant="outlined"
                          onClick={() => openEditDialog(hall)}
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
                          onClick={() => deleteHall(hall.id)}
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
                    </CardContent>
                  </Card>
                )
              })}
            </Box>
          </Box>
        ))}
      </Box>
      )}

      {!loading && ((isPracticalView && practicalLabSections.length === 0) || (!isPracticalView && visibleHalls.length === 0)) && (
        <Typography sx={{ mt: 2 }}>
          {isPracticalView ? 'No practical halls found for this search.' : 'No halls found for this search.'}
        </Typography>
      )}

      <Dialog open={dialogOpen} onClose={closeDialog} fullWidth maxWidth="sm">
        <DialogTitle className="hall-dialog-title">{editingHall ? 'Edit Hall' : 'Add Hall'}</DialogTitle>
        <DialogContent className="hall-dialog-content">
          <Typography className="hall-dialog-subtitle">
            Enter hall details and seating configuration.
          </Typography>

          <Stack spacing={2} className="hall-form-stack">
            <Typography variant="subtitle2" className="hall-form-section-title">
              Hall Identity
            </Typography>
            <Box className="hall-form-grid hall-form-grid-two">
              <FormControl fullWidth>
                <InputLabel id="block-label">Block</InputLabel>
                <Select
                  labelId="block-label"
                  value={form.block}
                  label="Block"
                  onChange={onFormFieldChange('block')}
                >
                  {BLOCK_OPTIONS.map((block) => (
                    <MenuItem key={block} value={block}>
                      {block}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>

              <TextField
                value={form.number}
                onChange={onFormFieldChange('number')}
                label="Hall Number"
                placeholder="e.g. 101"
                fullWidth
              />
            </Box>

            <Typography variant="subtitle2" className="hall-form-section-title">
              Seating Configuration
            </Typography>
            <FormControl fullWidth>
              <InputLabel id="exam-type-label">Exam Type</InputLabel>
              <Select
                labelId="exam-type-label"
                value={form.examType}
                label="Exam Type"
                onChange={onFormFieldChange('examType')}
              >
                {HALL_EXAM_TYPE_OPTIONS.map((item) => (
                  <MenuItem key={item.value} value={item.value}>
                    {item.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <Box className="hall-form-grid hall-form-grid-three">
              <TextField
                value={form.rows}
                onChange={onFormFieldChange('rows')}
                type="number"
                label="Rows"
                inputProps={{ min: 1 }}
                fullWidth
              />
              <TextField
                value={form.cols}
                onChange={onFormFieldChange('cols')}
                type="number"
                label="Columns"
                inputProps={{ min: 1 }}
                fullWidth
              />
              <FormControl fullWidth>
                <InputLabel id="students-per-bench-label">Students/Bench</InputLabel>
                <Select
                  labelId="students-per-bench-label"
                  value={form.studentsPerBench}
                  label="Students/Bench"
                  onChange={onFormFieldChange('studentsPerBench')}
                >
                  {STUDENTS_PER_BENCH_OPTIONS.map((count) => (
                    <MenuItem key={count} value={count}>
                      {count}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Box>

            <Box className="hall-capacity-preview">
              <Typography className="hall-capacity-label">Estimated Capacity</Typography>
              <Typography className="hall-capacity-value">{previewCapacity}</Typography>
              <Typography className="hall-capacity-note">
                Auto-calculated from rows, columns, students per bench and exam type.
              </Typography>
            </Box>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={closeDialog} variant="contained" color="error">
            Cancel
          </Button>
          <Button onClick={saveHall} variant="contained" disabled={saving}>
            Save
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}
