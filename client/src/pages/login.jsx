import { useState } from 'react'
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Paper,
  Stack,
  TextField,
  Typography
} from '@mui/material'
import GoogleIcon from '@mui/icons-material/Google'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function LoginPage() {
  const { isAuthenticated, login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [formData, setFormData] = useState({ username: '', password: '' })
  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />
  }

  function handleChange(event) {
    const { name, value } = event.target
    setFormData((current) => ({ ...current, [name]: value }))
  }

  async function handleSubmit(event) {
    event.preventDefault()
    setIsSubmitting(true)
    setError('')

    try {
      await login(formData)
      const redirectTo = location.state?.from?.pathname || '/dashboard'
      navigate(redirectTo, { replace: true })
    } catch (err) {
      setError(err.response?.data?.message || 'Unable to sign in with those credentials')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Box className="login-page">
      <Paper className="login-card" elevation={0}>
        <Stack spacing={4}>
          <Stack spacing={1.5} alignItems="center" className="login-brand">
            <Box className="login-brand-row">
              <Box className="login-brand-mark" aria-hidden="true">
                <img
                  src="https://ps.bitsathy.ac.in/static/media/logo.e99a8edb9e376c3ed2e5.png"
                  alt="CoE logo"
                  className="login-brand-logo"
                />
              </Box>
              <Typography variant="h3" className="login-brand-title">
                CoE Portal
              </Typography>
            </Box>
            <Typography component="h1" className="login-welcome">
              Hi, Welcome Back!
            </Typography>
          </Stack>

          <Box component="form" onSubmit={handleSubmit} noValidate>
            <Stack spacing={3}>
              {error ? <Alert severity="error">{error}</Alert> : null}

              <Box>
                <Typography component="label" htmlFor="username" className="login-field-label">
                  Username
                </Typography>
                <TextField
                  fullWidth
                  id="username"
                  name="username"
                  placeholder="Enter your username"
                  value={formData.username}
                  onChange={handleChange}
                  autoComplete="username"
                />
              </Box>

              <Box>
                <Typography component="label" htmlFor="password" className="login-field-label">
                  Password
                </Typography>
                <TextField
                  fullWidth
                  id="password"
                  name="password"
                  type="password"
                  placeholder="Enter your password"
                  value={formData.password}
                  onChange={handleChange}
                  autoComplete="current-password"
                />
              </Box>

              <Button
                type="submit"
                variant="contained"
                size="large"
                disabled={isSubmitting}
                className="login-submit"
              >
                {isSubmitting ? <CircularProgress size={22} color="inherit" /> : 'Login'}
              </Button>

              <Typography className="login-divider">Or</Typography>

              <Button
                variant="outlined"
                startIcon={<GoogleIcon className="login-google-icon" />}
                disabled
                className="login-google-button"
              >
                Sign in with Google
              </Button>
            </Stack>
          </Box>
        </Stack>
      </Paper>
    </Box>
  )
}
