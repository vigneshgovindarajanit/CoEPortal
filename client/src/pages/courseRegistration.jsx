import { useEffect, useMemo, useState } from 'react'
import {
  Box,
  Button,
  Card,
  CardContent,
  InputAdornment,
  MenuItem,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography
} from '@mui/material'
import SearchRoundedIcon from '@mui/icons-material/SearchRounded'
import RefreshRoundedIcon from '@mui/icons-material/RefreshRounded'
import { fetchCourseRegistrations } from '../services/courseRegistrationService'

const DEPARTMENTS = ['BM', 'CE', 'CD', 'CS', 'EE', 'EC', 'EI', 'SE', 'ME', 'MZ', 'AG', 'AD', 'AL', 'BT', 'CB', 'CT', 'FD', 'IT', 'FT', 'TT']

function getErrorMessage(err, fallback) {
  if (!err) return fallback
  if (err.response?.data?.message) return err.response.data.message
  if (err.message) return err.message
  return fallback
}

export default function CourseRegistrationPage() {
  const [registrations, setRegistrations] = useState([])
  const [search, setSearch] = useState('')
  const [department, setDepartment] = useState('')
  const [semester, setSemester] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const totalByDept = useMemo(() => {
    return registrations.reduce((acc, reg) => {
      acc[reg.department] = (acc[reg.department] || 0) + 1
      return acc
    }, {})
  }, [registrations])

  async function loadRegistrations() {
    setLoading(true)
    setError('')
    try {
      const data = await fetchCourseRegistrations({
        search: search || undefined,
        department: department || undefined,
        semester: semester || undefined,
        limit: 500
      })
      setRegistrations(data?.items || [])
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to load course registrations'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadRegistrations()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <Box className="app-shell course-shell">
      <Box className="page-header">
        <div>
          <Typography variant="h5" fontWeight={800}>
            Course Registrations
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Student-course mappings with department and semester context.
          </Typography>
        </div>
        <Button
          variant="contained"
          startIcon={<RefreshRoundedIcon />}
          onClick={loadRegistrations}
          disabled={loading}
        >
          Refresh
        </Button>
      </Box>

      <Card className="course-filter-card">
        <CardContent className="course-filter-content">
          <Box className="course-search-row">
            <TextField
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by student name/ID or course code/name"
              fullWidth
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchRoundedIcon fontSize="small" />
                  </InputAdornment>
                )
              }}
            />
            <TextField
              select
              label="Department"
              value={department}
              onChange={(e) => setDepartment(e.target.value)}
              sx={{ minWidth: 150 }}
            >
              <MenuItem value="">All</MenuItem>
              {DEPARTMENTS.map((dept) => (
                <MenuItem key={dept} value={dept}>
                  {dept}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              label="Semester"
              placeholder="SEM1"
              value={semester}
              onChange={(e) => setSemester(e.target.value.toUpperCase())}
              sx={{ minWidth: 140 }}
            />
            <Button variant="contained" onClick={loadRegistrations} disabled={loading}>
              Apply
            </Button>
          </Box>
        </CardContent>
      </Card>

      {error && (
        <Typography color="error" sx={{ mt: 2 }}>
          {error}
        </Typography>
      )}

      <Card className="course-table-card" sx={{ mt: 2 }}>
        <CardContent className="course-table-content">
          <Table size="small" className="course-table">
            <TableHead>
              <TableRow>
                <TableCell className="course-head-cell">Name</TableCell>
                <TableCell className="course-head-cell">Student ID</TableCell>
                <TableCell className="course-head-cell">Course ID</TableCell>
                <TableCell className="course-head-cell">Course Name</TableCell>
                <TableCell className="course-head-cell">Dept</TableCell>
                <TableCell className="course-head-cell">Sem</TableCell>
                <TableCell align="center" className="course-head-cell">
                  Actions
                </TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {registrations.map((item) => (
                <TableRow key={item.id} hover className="course-row">
                  <TableCell>{item.studentName || '—'}</TableCell>
                  <TableCell>{item.studentId}</TableCell>
                  <TableCell>{item.courseId}</TableCell>
                  <TableCell>{item.courseName || '—'}</TableCell>
                  <TableCell>{item.department}</TableCell>
                  <TableCell>{item.semester}</TableCell>
                  <TableCell align="center">
                    <Button size="small" variant="outlined" disabled>
                      Action
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {!loading && registrations.length === 0 && (
            <Typography sx={{ mt: 2 }} className="course-empty-state">
              No registrations match the filters.
            </Typography>
          )}
        </CardContent>
      </Card>

      <Card className="course-stats-card" sx={{ mt: 2 }}>
        <CardContent>
          <Typography variant="subtitle1" fontWeight={700}>
            Totals by Department
          </Typography>
          <Box className="stat-pill-row" sx={{ mt: 1, display: 'flex', flexWrap: 'wrap', gap: 1 }}>
            {Object.entries(totalByDept).map(([dept, count]) => (
              <Box key={dept} className="stat-pill">
                <strong>{dept}</strong> {count}
              </Box>
            ))}
            {Object.keys(totalByDept).length === 0 && (
              <Typography color="text.secondary">Nothing to show yet.</Typography>
            )}
          </Box>
        </CardContent>
      </Card>
    </Box>
  )
}
