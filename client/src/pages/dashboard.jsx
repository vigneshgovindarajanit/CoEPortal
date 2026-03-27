import { useCallback, useEffect, useMemo, useState } from 'react'
import { Alert, Box, Card, CardContent, Grid, Stack, Typography, useTheme } from '@mui/material'
import SchoolRoundedIcon from '@mui/icons-material/SchoolRounded'
import ApartmentRoundedIcon from '@mui/icons-material/ApartmentRounded'
import BadgeRoundedIcon from '@mui/icons-material/BadgeRounded'
import EventNoteRoundedIcon from '@mui/icons-material/EventNoteRounded'
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis
} from 'recharts'
import { fetchDashboardOverview } from '../services/dashboardService'

function getErrorMessage(err, fallback) {
  return err?.response?.data?.error || err?.message || fallback
}

function formatCompactDate(value) {
  if (!value) return '-'
  const date = new Date(value)
  return Number.isNaN(date.getTime())
    ? String(value)
    : date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

const COLORS = ['#6e5af3', '#169f68', '#d84343', '#f0a500', '#2d9cdb', '#9b51e0']

function CustomTooltip({ active, payload, label }) {
  if (active && payload && payload.length) {
    return (
      <Box sx={{
        bg: 'rgba(255, 255, 255, 0.95)',
        backdropFilter: 'blur(10px)',
        p: 2,
        borderRadius: 2,
        boxShadow: '0 8px 32px rgba(31, 38, 51, 0.15)',
        border: '1px solid rgba(223, 228, 239, 0.5)'
      }}>
        <Typography sx={{ fontWeight: 700, mb: 1, color: '#1f2433' }}>{label}</Typography>
        {payload.map((entry, index) => (
          <Box key={`item-${index}`} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: entry.color }} />
            <Typography sx={{ fontSize: '0.85rem', color: '#626c80' }}>
              {entry.name}: <span style={{ fontWeight: 800, color: '#1f2433' }}>{entry.value.toLocaleString('en-IN')}</span>
            </Typography>
          </Box>
        ))}
      </Box>
    )
  }
  return null
}

export default function DashboardPage() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const theme = useTheme()

  const loadDashboard = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const overview = await fetchDashboardOverview()
      setData(overview || null)
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to load dashboard'))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadDashboard()
    // Simulate real-time updates every 30 seconds for visual dynamic
    const interval = setInterval(loadDashboard, 30000)
    return () => clearInterval(interval)
  }, [loadDashboard])

  const topCards = useMemo(() => {
    if (!data) return []
    return [
      {
        key: 'students',
        label: 'Total Students',
        value: Number(data.students?.total || 0).toLocaleString('en-IN'),
        note: '+2.4%',
        icon: <SchoolRoundedIcon fontSize="small" />,
        tone: 'active'
      },
      {
        key: 'halls',
        label: 'Active Halls',
        value: Number(data.halls?.active || 0).toLocaleString('en-IN'),
        note: `${Number(data.halls?.activeCapacity || 0).toLocaleString('en-IN')} seats`,
        icon: <ApartmentRoundedIcon fontSize="small" />,
        tone: 'available'
      },
      {
        key: 'faculty',
        label: 'Faculty',
        value: Number(data.faculty?.total || 0).toLocaleString('en-IN'),
        note: `${Number(data.faculty?.allotted || 0).toLocaleString('en-IN')} allotted`,
        icon: <BadgeRoundedIcon fontSize="small" />,
        tone: 'inactive'
      },
      {
        key: 'schedules',
        label: 'Exams',
        value: Number(data.schedules?.total || 0).toLocaleString('en-IN'),
        note: 'Scheduled exams',
        icon: <EventNoteRoundedIcon fontSize="small" />,
        tone: 'semester'
      }
    ]
  }, [data])

  const overviewSeries = useMemo(() => {
    if (!data) return []
    return [
      { name: 'Students', value: Number(data.students?.total || 0) },
      { name: 'Faculty', value: Number(data.faculty?.total || 0) * 10 }, // scaled for visibility
      { name: 'Courses', value: Number(data.courses?.total || 0) * 10 }
    ]
  }, [data])

  const operationalComparison = useMemo(() => {
    if (!data) return []
    return [
      { name: 'Capacity', Available: Number(data.halls?.activeCapacity || 0), Used: Number(data.seating?.assignedStudents || 0) },
      { name: 'Faculty', Available: Number(data.faculty?.total || 0), Used: Number(data.faculty?.allotted || 0) },
    ]
  }, [data])

  const courseDistribution = useMemo(() => {
    return (data?.courses?.byType || []).map(item => ({
      name: item.label,
      value: Number(item.value || 0)
    }))
  }, [data])

  return (
    <Box sx={{ maxWidth: 1400, margin: '0 auto', p: { xs: 2, md: 4 } }}>
      <Box className="page-head">
        <Typography variant="h4" className="brand-title">
          Dashboard {loading && <span style={{ fontSize: '1rem', color: '#626c80', fontWeight: 500, marginLeft: '8px' }}>(Syncing...)</span>}
        </Typography>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 3, borderRadius: 2 }}>{error}</Alert>}

      {/* Top Cards */}
      <Box className="stats-row hall-stats-row">
        {topCards.map((item) => (
          <Card key={item.key} className={`stats-card stats-card-${item.tone} hall-stats-card hall-stats-card-${item.tone}`}>
            <CardContent className="stats-card-content hall-stats-card-content">
              <Box className="dashboard-summary-title-row">
                <Box className={`dashboard-summary-icon-badge dashboard-summary-icon-badge-${item.tone}`}>
                  {item.icon}
                </Box>
                <Typography variant="body2" className="stats-card-label hall-stats-card-label">{item.label}</Typography>
              </Box>
              <Typography variant="h4" className="stats-card-value hall-stats-card-value">{item.value}</Typography>
              <Typography variant="caption" className="stats-card-note hall-stats-card-note">{item.note}</Typography>
            </CardContent>
          </Card>
        ))}
      </Box>

      <Grid container spacing={3} sx={{ mb: 4 }}>
        {/* Real-time Trend Graph */}
        <Grid item xs={12} md={8}>
          <Card sx={{ 
            height: '100%', borderRadius: 4, 
            boxShadow: '0 10px 30px rgba(31, 38, 51, 0.04)', 
            border: '1px solid rgba(223, 228, 239, 0.8)'
          }}>
            <CardContent sx={{ p: 3, height: 400 }}>
              <Typography sx={{ fontSize: '1.1rem', fontWeight: 800, color: '#1f2433', mb: 0.5 }}>
                Academic Entities Growth
              </Typography>
              <Typography sx={{ fontSize: '0.85rem', color: '#626c80', mb: 3 }}>
                Dynamic overview of registered students, courses, and faculty over time.
              </Typography>
              <ResponsiveContainer width="100%" height={280}>
                <AreaChart data={overviewSeries} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorStudents" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#6e5af3" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#6e5af3" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f2f5" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#626c80', fontSize: 12, fontWeight: 500 }} dy={10} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fill: '#626c80', fontSize: 12, fontWeight: 500 }} />
                  <RechartsTooltip content={<CustomTooltip />} />
                  <Area type="monotone" dataKey="value" stroke="#6e5af3" strokeWidth={3} fillOpacity={1} fill="url(#colorStudents)" activeDot={{ r: 6, strokeWidth: 0, fill: '#6e5af3' }} />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </Grid>

        {/* Comparison Bar Chart */}
        <Grid item xs={12} md={4}>
          <Card sx={{ 
            height: '100%', borderRadius: 4, 
            boxShadow: '0 10px 30px rgba(31, 38, 51, 0.04)', 
            border: '1px solid rgba(223, 228, 239, 0.8)'
          }}>
            <CardContent sx={{ p: 3, height: 400 }}>
              <Typography sx={{ fontSize: '1.1rem', fontWeight: 800, color: '#1f2433', mb: 0.5 }}>
                Capacity vs Usage
              </Typography>
              <Typography sx={{ fontSize: '0.85rem', color: '#626c80', mb: 3 }}>
                Comparison of available resources against current allocations.
              </Typography>
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={operationalComparison} margin={{ top: 20, right: 0, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f2f5" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#626c80', fontSize: 12, fontWeight: 500 }} dy={10} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fill: '#626c80', fontSize: 12, fontWeight: 500 }} />
                  <RechartsTooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(223, 228, 239, 0.4)' }} />
                  <Legend iconType="circle" wrapperStyle={{ fontSize: '12px', fontWeight: 600, color: '#1f2433', paddingTop: '10px' }} />
                  <Bar dataKey="Available" fill="#d1e0fc" radius={[4, 4, 0, 0]} barSize={28} />
                  <Bar dataKey="Used" fill="#167deb" radius={[4, 4, 0, 0]} barSize={28} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <Grid container spacing={3}>
        {/* Course Distribution */}
        <Grid item xs={12} md={4}>
          <Card sx={{ 
            height: '100%', borderRadius: 4, 
            boxShadow: '0 10px 30px rgba(31, 38, 51, 0.04)', 
            border: '1px solid rgba(223, 228, 239, 0.8)'
          }}>
            <CardContent sx={{ p: 3, height: 360 }}>
              <Typography sx={{ fontSize: '1.1rem', fontWeight: 800, color: '#1f2433', mb: 0.5 }}>
                Course Distribution
              </Typography>
              <Typography sx={{ fontSize: '0.85rem', color: '#626c80', mb: 1 }}>
                Breakdown of active courses.
              </Typography>
              {courseDistribution.length > 0 ? (
                <ResponsiveContainer width="100%" height={240}>
                  <PieChart>
                    <Pie
                      data={courseDistribution}
                      cx="50%" cy="50%"
                      innerRadius={60} outerRadius={80}
                      paddingAngle={5}
                      dataKey="value"
                      stroke="none"
                    >
                      {courseDistribution.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <RechartsTooltip content={<CustomTooltip />} />
                    <Legend iconType="circle" wrapperStyle={{ fontSize: '12px', fontWeight: 600 }} />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <Box sx={{ height: 240, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Typography sx={{ color: '#a0aabf', fontWeight: 500 }}>No data available</Typography>
                </Box>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Recent Exams List */}
        <Grid item xs={12} md={8}>
          <Card sx={{ 
            height: '100%', borderRadius: 4, 
            boxShadow: '0 10px 30px rgba(31, 38, 51, 0.04)', 
            border: '1px solid rgba(223, 228, 239, 0.8)'
          }}>
            <CardContent sx={{ p: 3 }}>
              <Typography sx={{ fontSize: '1.1rem', fontWeight: 800, color: '#1f2433', mb: 0.5 }}>
                Recent Exam Schedules
              </Typography>
              <Typography sx={{ fontSize: '0.85rem', color: '#626c80', mb: 3 }}>
                The latest slots assigned in the system.
              </Typography>
              <Stack spacing={2}>
                {(data?.schedules?.recent || []).slice(0, 4).map((item, idx) => (
                  <Box key={idx} sx={{ 
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center', 
                    p: 2, borderRadius: 3, bgcolor: '#f8f9fc',
                    border: '1px solid rgba(223, 228, 239, 0.5)',
                    transition: 'background 0.2s ease',
                    '&:hover': { bgcolor: '#f0f2f5' }
                  }}>
                    <Box>
                      <Typography sx={{ fontWeight: 700, color: '#1f2433', fontSize: '0.95rem' }}>
                        {item.courseCode}
                      </Typography>
                      <Typography sx={{ fontSize: '0.8rem', color: '#626c80', mt: 0.5 }}>
                        {item.examType} &bull; Hall {item.hallCode}
                      </Typography>
                    </Box>
                    <Box sx={{ textAlign: 'right' }}>
                      <Typography sx={{ fontWeight: 800, color: '#6e5af3', fontSize: '0.9rem' }}>
                        {formatCompactDate(item.examDate)}
                      </Typography>
                      <Typography sx={{ fontSize: '0.75rem', fontWeight: 700, color: '#8f9bb3', mt: 0.5, bgcolor: '#ffffff', px: 1, py: 0.25, borderRadius: 1, display: 'inline-block' }}>
                        {item.sessionName}
                      </Typography>
                    </Box>
                  </Box>
                ))}
                {(!data?.schedules?.recent || data.schedules.recent.length === 0) && (
                  <Typography sx={{ textAlign: 'center', py: 4, color: '#a0aabf', fontWeight: 500 }}>
                    No recent activity to display.
                  </Typography>
                )}
              </Stack>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  )
}
