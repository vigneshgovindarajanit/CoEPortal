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
  Pagination,
  Select,
  Stack,
  TextField,
  Typography
} from '@mui/material'
import GroupsRoundedIcon from '@mui/icons-material/GroupsRounded'
import SchoolRoundedIcon from '@mui/icons-material/SchoolRounded'
import AccountTreeRoundedIcon from '@mui/icons-material/AccountTreeRounded'
import {
  createStudent,
  deleteStudent,
  fetchStudents,
  generateBulkStudents,
  updateStudent
} from '../services/studentService'
import { confirmAction } from '../utils/confirmAction'

const YEARS = [1, 2, 3, 4]
const DEPT_OPTIONS = [
  'BM',
  'CE',
  'CD',
  'CS',
  'EE',
  'EC',
  'EI',
  'SE',
  'ME',
  'MZ',
  'AG',
  'AD',
  'AL',
  'BT',
  'CB',
  'CT',
  'FD',
  'IT',
  'FT',
  'TT'
]

const PAGE_SIZE = 30

const emptyForm = {
  studentId: '',
  studentName: '',
  studentEmail: '',
  year: 1,
  dept: 'CS'
}

const emptyGenerationForm = {
  year: 'ALL',
  dept: 'ALL',
  degreeScope: 'ALL'
}

const BE_DEPARTMENTS = ['BM', 'CE', 'CD', 'CS', 'EE', 'EC', 'EI', 'SE', 'ME', 'MZ']
const BTECH_DEPARTMENTS = ['AG', 'AD', 'AL', 'BT', 'CB', 'CT', 'FD', 'IT', 'FT', 'TT']

function getDefaultFirstYearBatchYear() {
  const currentYear = new Date().getFullYear()
  return (currentYear - 1) % 100
}

function getErrorMessage(err, fallback) {
  return err?.response?.data?.error || err?.message || fallback
}

export default function StudentsPage() {
  const [students, setStudents] = useState([])
  const [search, setSearch] = useState('')
  const [yearFilter, setYearFilter] = useState('')
  const [deptFilter, setDeptFilter] = useState('')
  const [page, setPage] = useState(1)
  const [totalCount, setTotalCount] = useState(0)
  const [totalPages, setTotalPages] = useState(1)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [generationDialogOpen, setGenerationDialogOpen] = useState(false)
  const [editingStudent, setEditingStudent] = useState(null)
  const [form, setForm] = useState(emptyForm)
  const [generationForm, setGenerationForm] = useState(emptyGenerationForm)

  const loadStudents = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const data = await fetchStudents({
        search: search || undefined,
        year: yearFilter || undefined,
        dept: deptFilter || undefined,
        page,
        pageSize: PAGE_SIZE
      })

      setStudents(data?.items || [])
      setTotalCount(Number(data?.total || 0))
      setTotalPages(Number(data?.totalPages || 1))
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to load students'))
    } finally {
      setLoading(false)
    }
  }, [search, yearFilter, deptFilter, page])

  useEffect(() => {
    loadStudents()
  }, [loadStudents])

  useEffect(() => {
    setPage(1)
  }, [search, yearFilter, deptFilter])

  function openCreateDialog() {
    setEditingStudent(null)
    setForm(emptyForm)
    setDialogOpen(true)
  }

  function openEditDialog(student) {
    setEditingStudent(student)
    setForm({
      studentId: student.studentId,
      studentName: student.studentName,
      studentEmail: student.studentEmail,
      year: student.year,
      dept: student.dept
    })
    setDialogOpen(true)
  }

  function closeDialog() {
    setDialogOpen(false)
    setEditingStudent(null)
    setForm(emptyForm)
  }

  function openGenerationDialog() {
    setGenerationForm(emptyGenerationForm)
    setGenerationDialogOpen(true)
  }

  function closeGenerationDialog() {
    setGenerationDialogOpen(false)
    setGenerationForm(emptyGenerationForm)
  }

  function onFieldChange(field) {
    return (event) => {
      const value = event.target.value
      setForm((prev) => ({
        ...prev,
        [field]: field === 'year' ? Number(value) : value
      }))
    }
  }

  function onGenerationFieldChange(field) {
    return (event) => {
      const value = event.target.value
      setGenerationForm((prev) => ({
        ...prev,
        [field]: value,
        ...(field === 'degreeScope' ? { dept: 'ALL' } : {})
      }))
    }
  }

  async function saveStudent() {
    setSaving(true)
    setError('')
    setSuccess('')
    try {
      const payload = {
        studentId: form.studentId,
        studentName: form.studentName,
        studentEmail: form.studentEmail,
        year: form.year,
        dept: form.dept
      }

      if (editingStudent) {
        await updateStudent(editingStudent.id, payload)
      } else {
        await createStudent(payload)
      }

      closeDialog()
      await loadStudents()
      setSuccess('Student saved successfully')
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to save student'))
    } finally {
      setSaving(false)
    }
  }

  async function runBulkGeneration() {
    setGenerating(true)
    setError('')
    setSuccess('')

    try {
      const degrees =
        generationForm.degreeScope === 'ALL' ? ['BE', 'BTECH'] : [generationForm.degreeScope]
      const yearLevels =
        generationForm.year === 'ALL' ? [1, 2, 3, 4] : [Number(generationForm.year)]
      const departments = generationForm.dept === 'ALL' ? [] : [generationForm.dept]

      const summary = await generateBulkStudents({
        firstYearBatchYear: getDefaultFirstYearBatchYear(),
        degrees,
        departments,
        yearLevels,
        collegeCode: '7376'
      })

      closeGenerationDialog()
      setPage(1)
      await loadStudents()
      setSuccess(
        `Generation complete. Attempted ${summary.attempted}, inserted ${summary.inserted}, skipped ${summary.skipped}.`
      )
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to generate students'))
    } finally {
      setGenerating(false)
    }
  }

  const generationDepartmentOptions =
    generationForm.degreeScope === 'BE'
      ? BE_DEPARTMENTS
      : generationForm.degreeScope === 'BTECH'
        ? BTECH_DEPARTMENTS
        : DEPT_OPTIONS

  const studentStats = useMemo(
    () => [
      {
        key: 'total',
        label: 'Students Loaded',
        value: Number(totalCount || 0).toLocaleString('en-IN'),
        note: 'Current filtered results',
        tone: 'available',
        icon: <GroupsRoundedIcon fontSize="small" />
      },
      {
        key: 'year',
        label: 'Selected Year',
        value: yearFilter || 'All',
        note: 'Filter scope',
        tone: 'semester',
        icon: <SchoolRoundedIcon fontSize="small" />
      },
      {
        key: 'department',
        label: 'Selected Department',
        value: deptFilter || 'All',
        note: 'Department filter',
        tone: 'registrations',
        icon: <AccountTreeRoundedIcon fontSize="small" />
      }
    ],
    [totalCount, yearFilter, deptFilter]
  )

  async function removeStudentById(id) {
    if (!confirmAction('Are you sure you want to delete this student?')) {
      return
    }
    setError('')
    setSuccess('')
    try {
      await deleteStudent(id)
      await loadStudents()
      setSuccess('Student deleted successfully')
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to delete student'))
    }
  }

  return (
    <Box className="app-shell students-shell">
      <Box className="page-head">
        <Typography variant="h4" className="brand-title">
          Students
        </Typography>
        <Button variant="contained" onClick={openCreateDialog}>
          Add Student
        </Button>
      </Box>

      <Box className="stats-row hall-stats-row">
        {studentStats.map((item) => (
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

      <Card sx={{ mb: 2, borderRadius: 0 }}>
        <CardContent>
          <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.5}>
            <TextField
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search by student ID, name, or email"
              size="small"
              className="student-search-compact"
              sx={{ width: { xs: '100%', md: 320 } }}
            />
            <FormControl size="small" className="student-filter-compact" sx={{ minWidth: 110 }}>
              <InputLabel id="year-filter-label">Year</InputLabel>
              <Select
                labelId="year-filter-label"
                value={yearFilter}
                label="Year"
                onChange={(event) => setYearFilter(event.target.value)}
              >
                <MenuItem value="">All</MenuItem>
                {YEARS.map((year) => (
                  <MenuItem key={year} value={year}>
                    {year}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <FormControl size="small" className="student-filter-compact" sx={{ minWidth: 110 }}>
              <InputLabel id="dept-filter-label">Dept</InputLabel>
              <Select
                labelId="dept-filter-label"
                value={deptFilter}
                label="Dept"
                onChange={(event) => setDeptFilter(event.target.value)}
              >
                <MenuItem value="">All</MenuItem>
                {DEPT_OPTIONS.map((dept) => (
                  <MenuItem key={dept} value={dept}>
                    {dept}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <Button variant="contained" onClick={openGenerationDialog} disabled={generating}>
              {generating ? 'Generating...' : 'Generate Student'}
            </Button>
          </Stack>
        </CardContent>
      </Card>

      <Typography variant="body2" sx={{ mb: 2 }}>
        Showing {students.length} of {totalCount} students
      </Typography>

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

      <Box
        sx={{
          display: 'grid',
          gap: 2,
          gridTemplateColumns: {
            xs: '1fr',
            md: 'repeat(3, minmax(0, 1fr))'
          }
        }}
      >
        {students.map((student) => (
          <Box key={student.id}>
            <Card className="hall-card faculty-card student-record-card">
              <CardContent className="faculty-card-content student-record-content">
                <Typography variant="h6">{student.studentName}</Typography>
                <Typography variant="body2" className="faculty-meta">
                  <span className="faculty-meta-label">Student ID:</span>{' '}
                  <span className="faculty-meta-value">{student.studentId}</span>
                </Typography>
                <Typography variant="body2" className="faculty-meta">
                  <span className="faculty-meta-label">Email:</span>{' '}
                  <span className="faculty-meta-value">{student.studentEmail}</span>
                </Typography>
                <Typography variant="body2" className="faculty-meta">
                  <span className="faculty-meta-label">Year:</span>{' '}
                  <span className="faculty-meta-value">{student.year}</span>
                </Typography>
                <Typography variant="body2" className="faculty-meta">
                  <span className="faculty-meta-label">Dept:</span>{' '}
                  <span className="faculty-meta-value">{student.dept}</span>
                </Typography>
                <Stack direction="row" spacing={1} sx={{ mt: 2 }}>
                  <Button
                    variant="outlined"
                    onClick={() => openEditDialog(student)}
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
                    onClick={() => removeStudentById(student.id)}
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
          </Box>
        ))}
      </Box>

      {totalPages > 1 && (
        <Stack alignItems="center" sx={{ mt: 3 }}>
          <Pagination
            page={page}
            count={totalPages}
            onChange={(_, value) => setPage(value)}
            color="primary"
          />
        </Stack>
      )}

      {!loading && students.length === 0 && (
        <Typography sx={{ mt: 2 }}>No students found for selected filters.</Typography>
      )}

      <Dialog open={dialogOpen} onClose={closeDialog} fullWidth maxWidth="sm">
        <DialogTitle>{editingStudent ? 'Edit Student' : 'Add Student'}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              label="Student ID"
              value={form.studentId}
              onChange={onFieldChange('studentId')}
              fullWidth
            />
            <TextField
              label="Student Name"
              value={form.studentName}
              onChange={onFieldChange('studentName')}
              fullWidth
            />
            <TextField
              label="Student Email"
              value={form.studentEmail}
              onChange={onFieldChange('studentEmail')}
              fullWidth
            />
            <FormControl fullWidth>
              <InputLabel id="year-label">Year</InputLabel>
              <Select
                labelId="year-label"
                label="Year"
                value={form.year}
                onChange={onFieldChange('year')}
              >
                {YEARS.map((year) => (
                  <MenuItem key={year} value={year}>
                    {year}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <FormControl fullWidth>
              <InputLabel id="dept-label">Dept</InputLabel>
              <Select
                labelId="dept-label"
                label="Dept"
                value={form.dept}
                onChange={onFieldChange('dept')}
              >
                {DEPT_OPTIONS.map((dept) => (
                  <MenuItem key={dept} value={dept}>
                    {dept}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={closeDialog} variant="contained" color="error">
            Cancel
          </Button>
          <Button onClick={saveStudent} variant="contained" disabled={saving}>
            Save
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={generationDialogOpen} onClose={closeGenerationDialog} fullWidth maxWidth="sm">
        <DialogTitle>Generate Student</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <FormControl fullWidth>
              <InputLabel id="generation-year-label">Year</InputLabel>
              <Select
                labelId="generation-year-label"
                label="Year"
                value={generationForm.year}
                onChange={onGenerationFieldChange('year')}
              >
                <MenuItem value="ALL">All</MenuItem>
                {YEARS.map((year) => (
                  <MenuItem key={year} value={year}>
                    {year}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <FormControl fullWidth>
              <InputLabel id="generation-dept-label">Department</InputLabel>
              <Select
                labelId="generation-dept-label"
                label="Department"
                value={generationForm.dept}
                onChange={onGenerationFieldChange('dept')}
              >
                <MenuItem value="ALL">All</MenuItem>
                {generationDepartmentOptions.map((dept) => (
                  <MenuItem key={dept} value={dept}>
                    {dept}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <FormControl fullWidth>
              <InputLabel id="generation-degree-label">Degree</InputLabel>
              <Select
                labelId="generation-degree-label"
                label="Degree"
                value={generationForm.degreeScope}
                onChange={onGenerationFieldChange('degreeScope')}
              >
                <MenuItem value="ALL">Both</MenuItem>
                <MenuItem value="BE">BE</MenuItem>
                <MenuItem value="BTECH">B.Tech</MenuItem>
              </Select>
            </FormControl>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={closeGenerationDialog} variant="contained" color="error">
            Cancel
          </Button>
          <Button onClick={runBulkGeneration} variant="contained" disabled={generating}>
            {generating ? 'Generating...' : 'Generate'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}
