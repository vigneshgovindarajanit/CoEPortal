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
import MenuBookRoundedIcon from '@mui/icons-material/MenuBookRounded'
import GroupsRoundedIcon from '@mui/icons-material/GroupsRounded'
import CalendarViewMonthRoundedIcon from '@mui/icons-material/CalendarViewMonthRounded'
import { createCourse, fetchCourseFilters, fetchCourses, updateCourse } from '../services/courseService'

const EMPTY_FORM = {
  semester: '',
  courseCode: '',
  courseName: '',
  courseYear: 1,
  department: '',
  courseType: 'CORE',
  electiveType: '',
  courseCount: 0
}

function getErrorMessage(err, fallback) {
  return err?.response?.data?.error || err?.message || fallback
}

function toTitleCase(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase())
}

function formatCourseType(course) {
  if (course.courseType !== 'ELECTIVE') {
    return toTitleCase(course.courseType)
  }

  if (!course.electiveType) {
    return 'Elective'
  }

  return formatElectiveTypeLabel(course.electiveType)
}

function formatElectiveTypeLabel(value) {
  const normalized = String(value || '').toUpperCase()
  if (normalized === 'OPEN_ELECTIVE') {
    return 'Open Elective'
  }
  if (normalized === 'PROFESSIONAL_ELECTIVE') {
    return 'Professional Elective'
  }
  return toTitleCase(value)
}

function getCourseTypeClass(course) {
  const normalizedType = String(course?.courseType || '').toUpperCase()
  if (normalizedType === 'ADD_ON') {
    return 'course-pill-add-on'
  }
  if (normalizedType === 'CORE') {
    return 'course-pill-core'
  }
  if (normalizedType === 'ELECTIVE') {
    return 'course-pill-elective'
  }
  return 'course-pill-default'
}

export default function CoursePage() {
  const [courses, setCourses] = useState([])
  const [filters, setFilters] = useState({
    semesters: [],
    departments: [],
    courseTypes: [],
    electiveTypes: []
  })
  const [search, setSearch] = useState('')
  const [semesterFilter, setSemesterFilter] = useState('')
  const [departmentFilter, setDepartmentFilter] = useState('')
  const [courseTypeFilter, setCourseTypeFilter] = useState('')
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingCourse, setEditingCourse] = useState(null)
  const [form, setForm] = useState(EMPTY_FORM)

  const totalRegistered = useMemo(
    () => courses.reduce((sum, course) => sum + Number(course.courseCount || 0), 0),
    [courses]
  )
  const courseStats = useMemo(
    () => [
      {
        key: 'available',
        label: 'Available Courses',
        value: courses.length,
        note: 'Current filtered list',
        tone: 'available',
        icon: <MenuBookRoundedIcon fontSize="small" />
      },
      {
        key: 'registrations',
        label: 'Total Registrations',
        value: Number(totalRegistered || 0).toLocaleString('en-IN'),
        note: 'Total students registered',
        tone: 'registrations',
        icon: <GroupsRoundedIcon fontSize="small" />
      },
      {
        key: 'semester',
        label: 'Selected Semester',
        value: semesterFilter || 'All',
        note: 'Scope of current view',
        tone: 'semester',
        icon: <CalendarViewMonthRoundedIcon fontSize="small" />
      }
    ],
    [courses.length, totalRegistered, semesterFilter]
  )

  const loadCourses = useCallback(async () => {
    setLoading(true)
    setError('')

    try {
      const [coursesData, filtersData] = await Promise.all([
        fetchCourses({
          semester: semesterFilter || undefined,
          department: departmentFilter || undefined,
          courseType: courseTypeFilter || undefined,
          search: search || undefined
        }),
        fetchCourseFilters()
      ])

      setCourses(coursesData || [])
      setFilters({
        semesters: filtersData?.semesters || [],
        departments: filtersData?.departments || [],
        courseTypes: filtersData?.courseTypes || [],
        electiveTypes: filtersData?.electiveTypes || []
      })
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to load courses'))
    } finally {
      setLoading(false)
    }
  }, [semesterFilter, departmentFilter, courseTypeFilter, search])

  useEffect(() => {
    loadCourses()
  }, [loadCourses])

  function openCreateDialog() {
    setEditingCourse(null)
    setForm(EMPTY_FORM)
    setDialogOpen(true)
  }

  function openEditDialog(course) {
    setEditingCourse(course)
    setForm({
      semester: course.semester,
      courseCode: course.courseCode,
      courseName: course.courseName,
      courseYear: Number(course.courseYear),
      department: course.department,
      courseType: course.courseType,
      electiveType: course.electiveType || '',
      courseCount: Number(course.courseCount)
    })
    setDialogOpen(true)
  }

  function closeDialog() {
    setDialogOpen(false)
    setEditingCourse(null)
    setForm(EMPTY_FORM)
  }

  function onFormChange(field) {
    return (event) => {
      const value = event.target.value
      setForm((prev) => ({
        ...prev,
        [field]: ['courseYear', 'courseCount'].includes(field) ? Number(value) : value
      }))
    }
  }

  async function saveCourse() {
    setSaving(true)
    setError('')
    setSuccess('')

    try {
      const payload = {
        semester: form.semester,
        courseCode: form.courseCode,
        courseName: form.courseName,
        courseYear: Number(form.courseYear),
        department: form.department,
        courseType: form.courseType,
        electiveType: form.courseType === 'ELECTIVE' ? form.electiveType : null,
        courseCount: Number(form.courseCount)
      }

      if (editingCourse) {
        await updateCourse(editingCourse.id, payload)
      } else {
        await createCourse(payload)
      }

      closeDialog()
      await loadCourses()
      setSuccess('Course saved successfully')
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to save course'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Box className="app-shell course-shell">
      <Box className="page-head">
        <Typography variant="h4" className="brand-title">
          Course Page
        </Typography>
        <Button variant="contained" onClick={openCreateDialog}>
          Add Course
        </Button>
      </Box>

      <Box className="stats-row hall-stats-row">
        {courseStats.map((item) => (
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
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search by course code or course name"
              />
            </Box>

            <FormControl size="small" sx={{ minWidth: 140 }}>
              <InputLabel id="semester-filter-label">Semester</InputLabel>
              <Select
                labelId="semester-filter-label"
                value={semesterFilter}
                label="Semester"
                onChange={(event) => setSemesterFilter(event.target.value)}
              >
                <MenuItem value="">All</MenuItem>
                {filters.semesters.map((semester) => (
                  <MenuItem key={semester} value={semester}>
                    {semester}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <FormControl size="small" sx={{ minWidth: 160 }}>
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

            <FormControl size="small" sx={{ minWidth: 170 }}>
              <InputLabel id="course-type-filter-label">Course Type</InputLabel>
              <Select
                labelId="course-type-filter-label"
                value={courseTypeFilter}
                label="Course Type"
                onChange={(event) => setCourseTypeFilter(event.target.value)}
              >
                <MenuItem value="">All</MenuItem>
                {filters.courseTypes.map((courseType) => (
                  <MenuItem key={courseType} value={courseType}>
                    {courseType}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

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

      <Card className="course-table-card">
        <CardContent className="course-table-content">
          <Table size="small" className="course-table">
            <TableHead>
              <TableRow>
                <TableCell className="course-head-cell">Semester</TableCell>
                <TableCell className="course-head-cell">Course Code</TableCell>
                <TableCell className="course-head-cell">Course Name</TableCell>
                <TableCell className="course-head-cell">Year</TableCell>
                <TableCell className="course-head-cell">Department</TableCell>
                <TableCell className="course-head-cell course-col-type">Type</TableCell>
                <TableCell align="left" className="course-head-cell course-col-count">
                  Course Count
                </TableCell>
                <TableCell align="center" className="course-head-cell">Action</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {courses.map((course) => (
                <TableRow key={course.id} hover className="course-row">
                  <TableCell>{course.semester}</TableCell>
                  <TableCell>{course.courseCode}</TableCell>
                  <TableCell>{course.courseName}</TableCell>
                  <TableCell>{course.courseYear}</TableCell>
                  <TableCell>{course.department}</TableCell>
                  <TableCell className="course-col-type">
                    <Box component="span" className={`course-pill ${getCourseTypeClass(course)}`}>
                      {formatCourseType(course)}
                    </Box>
                  </TableCell>
                  <TableCell align="left" className="course-col-count">
                    {course.courseCount}
                  </TableCell>
                  <TableCell align="center">
                    <Button
                      variant="outlined"
                      size="small"
                      onClick={() => openEditDialog(course)}
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
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          {!loading && courses.length === 0 && (
            <Typography sx={{ mt: 2 }} className="course-empty-state">
              No courses found for selected filters.
            </Typography>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onClose={closeDialog} fullWidth maxWidth="sm">
        <DialogTitle>{editingCourse ? 'Edit Course' : 'Add Course'}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField label="Semester" value={form.semester} onChange={onFormChange('semester')} fullWidth />
            <TextField label="Course Code" value={form.courseCode} onChange={onFormChange('courseCode')} fullWidth />
            <TextField label="Course Name" value={form.courseName} onChange={onFormChange('courseName')} fullWidth />
            <TextField
              label="Course Year"
              type="number"
              inputProps={{ min: 1, max: 5 }}
              value={form.courseYear}
              onChange={onFormChange('courseYear')}
              fullWidth
            />
            <TextField label="Department" value={form.department} onChange={onFormChange('department')} fullWidth />

            <FormControl fullWidth>
              <InputLabel id="course-type-label">Course Type</InputLabel>
              <Select
                labelId="course-type-label"
                label="Course Type"
                value={form.courseType}
                onChange={onFormChange('courseType')}
              >
                {filters.courseTypes.map((courseType) => (
                  <MenuItem key={courseType} value={courseType}>
                    {courseType}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            {form.courseType === 'ELECTIVE' && (
              <FormControl fullWidth>
                <InputLabel id="elective-type-label">Elective Type</InputLabel>
                <Select
                  labelId="elective-type-label"
                  label="Elective Type"
                  value={form.electiveType}
                  onChange={onFormChange('electiveType')}
                >
                  {filters.electiveTypes.map((electiveType) => (
                    <MenuItem key={electiveType} value={electiveType}>
                      {formatElectiveTypeLabel(electiveType)}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            )}

            <TextField
              label="Course Count"
              type="number"
              inputProps={{ min: 0 }}
              value={form.courseCount}
              onChange={onFormChange('courseCount')}
              fullWidth
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={closeDialog} variant="contained" color="error">
            Cancel
          </Button>
          <Button onClick={saveCourse} variant="contained" disabled={saving}>
            Save
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}
