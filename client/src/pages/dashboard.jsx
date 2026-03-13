import { useCallback, useEffect, useMemo, useState } from 'react'
import { Alert, Box, Card, CardContent, Stack, Typography } from '@mui/material'
import SchoolRoundedIcon from '@mui/icons-material/SchoolRounded'
import ApartmentRoundedIcon from '@mui/icons-material/ApartmentRounded'
import BadgeRoundedIcon from '@mui/icons-material/BadgeRounded'
import EventNoteRoundedIcon from '@mui/icons-material/EventNoteRounded'
import { fetchDashboardOverview } from '../services/dashboardService'

function getErrorMessage(err, fallback) {
  return err?.response?.data?.error || err?.message || fallback
}

function formatCompactDate(value) {
  if (!value) {
    return '-'
  }

  const date = new Date(value)
  return Number.isNaN(date.getTime())
    ? String(value)
    : date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

function formatChartItems(items = []) {
  const max = Math.max(...items.map((item) => Number(item.value || 0)), 0)
  return items.map((item) => ({
    ...item,
    widthPercent: max > 0 ? Math.max((Number(item.value || 0) / max) * 100, 8) : 0
  }))
}

function DonutChart({ label, value, total, tone }) {
  const ratio = total > 0 ? Math.min(Math.round((value / total) * 100), 100) : 0
  return (
    <Box className="dashboard-donut-card">
      <Box
        className={`dashboard-donut dashboard-donut-${tone}`}
        style={{ background: `conic-gradient(var(--donut-fill) ${ratio}%, #e7edf6 0)` }}
      >
        <Box className="dashboard-donut-center">
          <Typography className="dashboard-donut-value">{ratio}%</Typography>
        </Box>
      </Box>
      <Typography className="dashboard-donut-label">{label}</Typography>
      <Typography className="dashboard-donut-meta">
        {value} / {total}
      </Typography>
    </Box>
  )
}

function BarChart({ title, subtitle, items, tone = 'blue' }) {
  const chartItems = useMemo(() => formatChartItems(items), [items])

  return (
    <Card className="dashboard-panel">
      <CardContent className="dashboard-panel-content">
        <Typography className="dashboard-panel-title">{title}</Typography>
        <Typography className="dashboard-panel-subtitle">{subtitle}</Typography>
        <Box className="dashboard-bar-chart">
          {chartItems.map((item) => (
            <Box key={`${title}-${item.label}`} className="dashboard-bar-row">
              <Box className="dashboard-bar-copy">
                <Typography className="dashboard-bar-label">{item.label}</Typography>
                <Typography className="dashboard-bar-value">{Number(item.value || 0).toLocaleString('en-IN')}</Typography>
              </Box>
              <Box className="dashboard-bar-track">
                <Box
                  className={`dashboard-bar-fill dashboard-bar-fill-${tone}`}
                  style={{ width: `${item.widthPercent}%` }}
                />
              </Box>
            </Box>
          ))}
        </Box>
      </CardContent>
    </Card>
  )
}

function buildSparklinePath(values = [], width = 320, height = 120) {
  if (!values.length) {
    return { line: '', area: '' }
  }

  const max = Math.max(...values, 1)
  const min = Math.min(...values, 0)
  const range = Math.max(max - min, 1)

  const points = values.map((value, index) => {
    const x = values.length === 1 ? width / 2 : (index / (values.length - 1)) * width
    const y = height - ((value - min) / range) * (height - 16) - 8
    return `${x},${y}`
  })

  const line = `M ${points.join(' L ')}`
  const area = `${line} L ${width},${height} L 0,${height} Z`

  return { line, area }
}

function OverviewTrendChart({ title, subtitle, items = [] }) {
  const [activeIndex, setActiveIndex] = useState(0)
  const normalizedItems = items.length
    ? items
    : [
        { label: 'Students', value: 0 },
        { label: 'Faculty', value: 0 },
        { label: 'Courses', value: 0 },
        { label: 'Schedules', value: 0 }
      ]
  const values = normalizedItems.map((item) => Number(item.value || 0))
  const { line, area } = buildSparklinePath(values)
  const max = Math.max(...values, 1)
  const min = Math.min(...values, 0)
  const range = Math.max(max - min, 1)
  const points = normalizedItems.map((item, index) => {
    const value = Number(item.value || 0)
    const x = normalizedItems.length === 1 ? 160 : (index / (normalizedItems.length - 1)) * 320
    const y = 120 - ((value - min) / range) * (120 - 16) - 8
    return { ...item, value, x, y }
  })
  const activePoint = points[activeIndex] || points[0]

  return (
    <Card className="dashboard-panel dashboard-panel-wide dashboard-trend-panel">
      <CardContent className="dashboard-panel-content">
        <Typography className="dashboard-panel-title">{title}</Typography>
        <Typography className="dashboard-panel-subtitle">{subtitle}</Typography>
        <Box className="dashboard-trend-chart">
          <Box className="dashboard-trend-visual">
            <svg viewBox="0 0 320 120" className="dashboard-trend-svg" preserveAspectRatio="none" aria-hidden="true">
              <defs>
                <linearGradient id="dashboardTrendArea" x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stopColor="#2f6fed" stopOpacity="0.32" />
                  <stop offset="100%" stopColor="#2f6fed" stopOpacity="0.02" />
                </linearGradient>
              </defs>
              <path d={area} fill="url(#dashboardTrendArea)" />
              <path d={line} className="dashboard-trend-line" />
              {points.map((point, index) => (
                <g key={point.label}>
                  <line
                    x1={point.x}
                    y1={point.y}
                    x2={point.x}
                    y2="120"
                    className={`dashboard-trend-guide${activeIndex === index ? ' is-active' : ''}`}
                  />
                  <circle
                    cx={point.x}
                    cy={point.y}
                    r={activeIndex === index ? '6' : '4'}
                    className={`dashboard-trend-point${activeIndex === index ? ' is-active' : ''}`}
                  />
                  <circle
                    cx={point.x}
                    cy={point.y}
                    r="14"
                    className="dashboard-trend-hitbox"
                    onMouseEnter={() => setActiveIndex(index)}
                    onFocus={() => setActiveIndex(index)}
                  />
                </g>
              ))}
            </svg>

            {activePoint && (
              <Box
                className="dashboard-trend-tooltip"
                style={{
                  left: `clamp(72px, calc(${(activePoint.x / 320) * 100}% - 68px), calc(100% - 140px))`,
                  top: `clamp(10px, calc(${(activePoint.y / 120) * 100}% - 70px), calc(100% - 82px))`
                }}
              >
                <Typography className="dashboard-trend-tooltip-label">{activePoint.label}</Typography>
                <Typography className="dashboard-trend-tooltip-value">
                  {activePoint.value.toLocaleString('en-IN')}
                </Typography>
              </Box>
            )}
          </Box>

          <Box className="dashboard-trend-labels">
            {normalizedItems.map((item, index) => (
              <Box
                key={item.label}
                className={`dashboard-trend-label-card${activeIndex === index ? ' is-active' : ''}`}
                onMouseEnter={() => setActiveIndex(index)}
              >
                <Typography className="dashboard-trend-label">{item.label}</Typography>
                <Typography className="dashboard-trend-value">
                  {Number(item.value || 0).toLocaleString('en-IN')}
                </Typography>
              </Box>
            ))}
          </Box>
        </Box>
      </CardContent>
    </Card>
  )
}

function CompositionChart({ title, subtitle, items = [] }) {
  const normalized = items.filter((item) => Number(item.value || 0) > 0)
  const total = normalized.reduce((sum, item) => sum + Number(item.value || 0), 0)

  return (
    <Card className="dashboard-panel">
      <CardContent className="dashboard-panel-content">
        <Typography className="dashboard-panel-title">{title}</Typography>
        <Typography className="dashboard-panel-subtitle">{subtitle}</Typography>
        <Box className="dashboard-composition-list">
          {normalized.map((item) => {
            const ratio = total > 0 ? (Number(item.value || 0) / total) * 100 : 0
            return (
              <Box key={item.label} className="dashboard-composition-item">
                <Box className="dashboard-composition-copy">
                  <Typography className="dashboard-composition-label">{item.label}</Typography>
                  <Typography className="dashboard-composition-value">
                    {Number(item.value || 0).toLocaleString('en-IN')}
                  </Typography>
                </Box>
                <Box className="dashboard-composition-track">
                  <Box className="dashboard-composition-fill" style={{ width: `${ratio}%` }} />
                </Box>
              </Box>
            )
          })}
          {normalized.length === 0 && (
            <Typography className="course-empty-state">No chart data available.</Typography>
          )}
        </Box>
      </CardContent>
    </Card>
  )
}

function ComparisonBarsChart({ title, subtitle, items = [] }) {
  const normalizedItems = items.filter((item) => Number(item.value || 0) >= 0)
  const max = Math.max(...normalizedItems.map((item) => Number(item.value || 0)), 1)

  return (
    <Card className="dashboard-panel dashboard-panel-compact">
      <CardContent className="dashboard-panel-content">
        <Typography className="dashboard-panel-title">{title}</Typography>
        <Typography className="dashboard-panel-subtitle">{subtitle}</Typography>
        <Box className="dashboard-compare-list">
          {normalizedItems.map((item) => {
            const width = (Number(item.value || 0) / max) * 100
            return (
              <Box key={item.label} className="dashboard-compare-item">
                <Box className="dashboard-compare-copy">
                  <Typography className="dashboard-compare-label">{item.label}</Typography>
                  <Typography className="dashboard-compare-value">
                    {Number(item.value || 0).toLocaleString('en-IN')}
                  </Typography>
                </Box>
                <Box className="dashboard-compare-track">
                  <Box
                    className={`dashboard-compare-fill dashboard-compare-fill-${item.tone || 'blue'}`}
                    style={{ width: `${Math.max(width, 10)}%` }}
                  />
                </Box>
              </Box>
            )
          })}
        </Box>
      </CardContent>
    </Card>
  )
}

function SectionHeader({ eyebrow, title, description }) {
  return (
    <Box className="dashboard-section-head">
      <Typography className="dashboard-section-eyebrow">{eyebrow}</Typography>
      <Typography className="dashboard-section-title">{title}</Typography>
      <Typography className="dashboard-section-description">{description}</Typography>
    </Box>
  )
}

export default function DashboardPage() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

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
  }, [loadDashboard])

  const topCards = useMemo(() => {
    if (!data) {
      return []
    }

    return [
      {
        key: 'students',
        label: 'Students',
        value: Number(data.students?.total || 0).toLocaleString('en-IN'),
        note: 'Registered across all years',
        tone: 'active',
        icon: <SchoolRoundedIcon fontSize="small" />
      },
      {
        key: 'halls',
        label: 'Active Halls',
        value: Number(data.halls?.active || 0).toLocaleString('en-IN'),
        note: `${Number(data.halls?.activeCapacity || 0).toLocaleString('en-IN')} seats available`,
        tone: 'capacity',
        icon: <ApartmentRoundedIcon fontSize="small" />
      },
      {
        key: 'faculty',
        label: 'Faculty',
        value: Number(data.faculty?.total || 0).toLocaleString('en-IN'),
        note: `${Number(data.faculty?.allotted || 0).toLocaleString('en-IN')} allotted`,
        tone: 'available',
        icon: <BadgeRoundedIcon fontSize="small" />
      },
      {
        key: 'schedules',
        label: 'Exam Schedules',
        value: Number(data.schedules?.total || 0).toLocaleString('en-IN'),
        note: 'Schedule allotted',
        tone: 'semester',
        icon: <EventNoteRoundedIcon fontSize="small" />
      }
    ]
  }, [data])

  const overviewSeries = useMemo(() => {
    if (!data) {
      return []
    }

    return [
      { label: 'Students', value: Number(data.students?.total || 0) },
      { label: 'Faculty', value: Number(data.faculty?.total || 0) },
      { label: 'Courses', value: Number(data.courses?.total || 0) },
      { label: 'Schedules', value: Number(data.schedules?.total || 0) }
    ]
  }, [data])

  const operationalComparison = useMemo(() => {
    if (!data) {
      return []
    }

    return [
      {
        label: 'Faculty Allotted',
        value: Number(data.faculty?.allotted || 0),
        tone: 'violet'
      },
      {
        label: 'Students Assigned',
        value: Number(data.seating?.assignedStudents || 0),
        tone: 'blue'
      },
      {
        label: 'Seats Available',
        value: Number(data.halls?.activeCapacity || 0),
        tone: 'green'
      },
      {
        label: 'Course Registrations',
        value: Number(data.courses?.registrations || 0),
        tone: 'gold'
      }
    ]
  }, [data])

  return (
    <Box className="app-shell dashboard-shell">
      <Box className="page-head">
        <Typography variant="h4" className="brand-title">
          Dashboard
        </Typography>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      <Box className="stats-row hall-stats-row">
        {topCards.map((item) => (
          <Card key={item.key} className={`stats-card hall-stats-card hall-stats-card-${item.tone}`}>
            <CardContent className="stats-card-content hall-stats-card-content">
              <Box className="dashboard-summary-title-row">
                <Box className={`dashboard-summary-icon-badge dashboard-summary-icon-badge-${item.tone}`}>
                  {item.icon}
                </Box>
                <Typography className="stats-card-label hall-stats-card-label">{item.label}</Typography>
              </Box>
              <Typography className="stats-card-value hall-stats-card-value">{item.value}</Typography>
              <Typography className="stats-card-note hall-stats-card-note">{item.note}</Typography>
            </CardContent>
          </Card>
        ))}
      </Box>

      <SectionHeader
        eyebrow=""
        title="Operational Summary"
        description="Primary monitoring cards for current exam operations, hall readiness, and seating status."
      />

      <Box className="dashboard-grid dashboard-grid-overview">
        <OverviewTrendChart
          title="Academic Operations Graph"
          subtitle="A quick relationship view across students, faculty, courses, and scheduled exams."
          items={overviewSeries}
        />

        <ComparisonBarsChart
          title="Operational Comparison"
          subtitle="Compare major workload and capacity counts side by side."
          items={operationalComparison}
        />

        <Card className="dashboard-panel dashboard-panel-compact">
          <CardContent className="dashboard-panel-content">
            <Typography className="dashboard-panel-title">Dashboard Status</Typography>
            <Typography className="dashboard-panel-subtitle">
              {loading ? 'Refreshing dashboard data from the server.' : 'Latest overview loaded successfully.'}
            </Typography>
            <Box className="dashboard-status-board">
              <Box className="dashboard-status-card">
                <span className={`dashboard-status-dot${loading ? ' is-loading' : ''}`} />
                <div>
                  <Typography className="dashboard-status-title">{loading ? 'Sync in progress' : 'Data ready'}</Typography>
                  <Typography className="dashboard-status-note">
                    {loading ? 'Charts are updating with the newest metrics.' : 'Dashboard metrics are ready for review.'}
                  </Typography>
                </div>
              </Box>
              <Box className="dashboard-status-mini-grid">
                <Box className="dashboard-status-mini">
                  <span>Active halls</span>
                  <strong>{Number(data?.halls?.active || 0).toLocaleString('en-IN')}</strong>
                </Box>
                <Box className="dashboard-status-mini">
                  <span>Faculty allotted</span>
                  <strong>{Number(data?.faculty?.allotted || 0).toLocaleString('en-IN')}</strong>
                </Box>
                <Box className="dashboard-status-mini">
                  <span>Seating halls</span>
                  <strong>{Number(data?.seating?.hallCount || 0).toLocaleString('en-IN')}</strong>
                </Box>
                <Box className="dashboard-status-mini">
                  <span>Unallocated</span>
                  <strong>{Number(data?.seating?.unallocatedStudents || 0).toLocaleString('en-IN')}</strong>
                </Box>
              </Box>
            </Box>
          </CardContent>
        </Card>

        <Card className="dashboard-panel dashboard-panel-wide dashboard-panel-emphasis">
          <CardContent className="dashboard-panel-content">
            <Typography className="dashboard-panel-title">Operations Snapshot</Typography>
            <Typography className="dashboard-panel-subtitle">
              High-level status across halls, faculty allocation, courses, and seating.
            </Typography>

            <Box className="dashboard-metric-grid">
              <Box className="dashboard-metric-box">
                <Typography className="dashboard-metric-label">Inactive Halls</Typography>
                <Typography className="dashboard-metric-value">{data?.halls?.inactive || 0}</Typography>
              </Box>
              <Box className="dashboard-metric-box">
                <Typography className="dashboard-metric-label">Total Courses</Typography>
                <Typography className="dashboard-metric-value">{data?.courses?.total || 0}</Typography>
              </Box>
              <Box className="dashboard-metric-box">
                <Typography className="dashboard-metric-label">Course Registrations</Typography>
                <Typography className="dashboard-metric-value">{Number(data?.courses?.registrations || 0).toLocaleString('en-IN')}</Typography>
              </Box>
              <Box className="dashboard-metric-box">
                <Typography className="dashboard-metric-label">Latest Seating Halls</Typography>
                <Typography className="dashboard-metric-value">{data?.seating?.hallCount || 0}</Typography>
              </Box>
              <Box className="dashboard-metric-box">
                <Typography className="dashboard-metric-label">Assigned Students</Typography>
                <Typography className="dashboard-metric-value">{Number(data?.seating?.assignedStudents || 0).toLocaleString('en-IN')}</Typography>
              </Box>
              <Box className="dashboard-metric-box">
                <Typography className="dashboard-metric-label">Unallocated Students</Typography>
                <Typography className="dashboard-metric-value">{Number(data?.seating?.unallocatedStudents || 0).toLocaleString('en-IN')}</Typography>
              </Box>
            </Box>
          </CardContent>
        </Card>

        <Card className="dashboard-panel dashboard-panel-compact">
          <CardContent className="dashboard-panel-content">
            <Typography className="dashboard-panel-title">Allocation Ratio</Typography>
            <Typography className="dashboard-panel-subtitle">Current faculty and hall utilization status.</Typography>
            <Box className="dashboard-donut-grid">
              <DonutChart
                label="Faculty Allotted"
                value={Number(data?.faculty?.allotted || 0)}
                total={Math.max(Number(data?.faculty?.total || 0), 1)}
                tone="blue"
              />
              <DonutChart
                label="Halls Active"
                value={Number(data?.halls?.active || 0)}
                total={Math.max(Number(data?.halls?.active || 0) + Number(data?.halls?.inactive || 0), 1)}
                tone="green"
              />
            </Box>
          </CardContent>
        </Card>
      </Box>

      <SectionHeader
        eyebrow="Breakdown"
        title="Distribution And Capacity"
        description="Student, course, exam, and department distributions presented in compact charts for quick comparison."
      />

      <Box className="dashboard-grid dashboard-grid-analytics">

        <BarChart
          title="Students by Year"
          subtitle="Distribution of registered students across year levels."
          items={data?.students?.byYear || []}
          tone="blue"
        />

        <CompositionChart
          title="Courses by Type"
          subtitle="Professional breakdown of course catalog share by type."
          items={data?.courses?.byType || []}
        />

        <BarChart
          title="Schedules by Exam Type"
          subtitle="Current exam schedule distribution by exam category."
          items={data?.schedules?.byType || []}
          tone="green"
        />

        <BarChart
          title="Top Student Departments"
          subtitle="Departments with the highest student count."
          items={data?.students?.topDepartments || []}
          tone="violet"
        />

        <CompositionChart
          title="Faculty by Department"
          subtitle="Top faculty department contribution in the current roster."
          items={data?.faculty?.topDepartments || []}
        />
      </Box>

      <SectionHeader
        eyebrow="Activity"
        title="Latest Exam And Seating Updates"
        description="Most recent scheduled slots and the latest saved seating allocation snapshot."
      />

      <Box className="dashboard-grid dashboard-grid-activity">
        <Card className="dashboard-panel dashboard-panel-wide">
          <CardContent className="dashboard-panel-content">
            <Typography className="dashboard-panel-title">Recent Exam Slots</Typography>
            <Typography className="dashboard-panel-subtitle">Latest scheduled exam entries.</Typography>
            <Box className="dashboard-activity-list">
              {(data?.schedules?.recent || []).map((item) => (
                <Box key={`${item.examDate}-${item.sessionName}-${item.courseCode}-${item.hallCode}`} className="dashboard-activity-item">
                  <Box className="dashboard-activity-copy">
                    <Typography className="dashboard-activity-title">{item.courseCode}</Typography>
                    <Typography className="dashboard-activity-meta">
                      {item.examType} | {item.hallCode}
                    </Typography>
                  </Box>
                  <Typography className="dashboard-activity-date">
                    {formatCompactDate(item.examDate)} {item.sessionName}
                  </Typography>
                </Box>
              ))}
              {(!data?.schedules?.recent || data.schedules.recent.length === 0) && (
                <Typography className="course-empty-state">No exam schedule activity available.</Typography>
              )}
            </Box>
          </CardContent>
        </Card>

        <Card className="dashboard-panel dashboard-panel-compact">
          <CardContent className="dashboard-panel-content">
            <Typography className="dashboard-panel-title">Latest Seating Snapshot</Typography>
            <Typography className="dashboard-panel-subtitle">Most recent saved seating allocation snapshot.</Typography>
            <Stack spacing={1.2} className="dashboard-snapshot-list">
              <Box className="dashboard-snapshot-row">
                <span>Allocation ID</span>
                <strong>{data?.seating?.allocationId || '-'}</strong>
              </Box>
              <Box className="dashboard-snapshot-row">
                <span>Year Filter</span>
                <strong>{data?.seating?.yearFilter || '-'}</strong>
              </Box>
              <Box className="dashboard-snapshot-row">
                <span>Created</span>
                <strong>{formatCompactDate(data?.seating?.createdAt)}</strong>
              </Box>
              <Box className="dashboard-snapshot-row">
                <span>Assigned</span>
                <strong>{Number(data?.seating?.assignedStudents || 0).toLocaleString('en-IN')}</strong>
              </Box>
              <Box className="dashboard-snapshot-row">
                <span>Unallocated</span>
                <strong>{Number(data?.seating?.unallocatedStudents || 0).toLocaleString('en-IN')}</strong>
              </Box>
            </Stack>
          </CardContent>
        </Card>
      </Box>
    </Box>
  )
}
