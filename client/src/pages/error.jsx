import { Box, Button, Typography, Container, Card, CardContent } from '@mui/material'
import ErrorOutlineRoundedIcon from '@mui/icons-material/ErrorOutlineRounded'
import { useNavigate } from 'react-router-dom'

export default function ErrorPage() {
  const navigate = useNavigate()

  return (
    <Box sx={{
      display: 'flex',
      minHeight: '100vh',
      alignItems: 'center',
      justifyContent: 'center',
      bgcolor: 'background.default',
      p: 3
    }}>
      <Container maxWidth="sm">
        <Card sx={{
          textAlign: 'center',
          borderRadius: 4,
          boxShadow: '0 12px 32px rgba(37, 53, 85, 0.12)',
          border: '1px solid #e2e7f0',
          p: 2
        }}>
          <CardContent>
            <Box sx={{
              bgcolor: 'rgba(255, 86, 86, 0.1)',
              color: 'error.main',
              width: 80,
              height: 80,
              borderRadius: '50%',
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              margin: '0 auto',
              mb: 3
            }}>
              <ErrorOutlineRoundedIcon sx={{ fontSize: 40 }} />
            </Box>
            <Typography variant="h2" sx={{ fontWeight: 800, color: 'text.primary', mb: 1, letterSpacing: '-0.02em' }}>
              404
            </Typography>
            <Typography variant="h5" sx={{ fontWeight: 700, color: 'text.primary', mb: 1 }}>
              Page Not Found
            </Typography>
            <Typography variant="body1" sx={{ color: 'text.secondary', mb: 4 }}>
              The page you are looking for doesn't exist or has been moved.
            </Typography>
            <Button
              variant="contained"
              onClick={() => navigate('/dashboard')}
              sx={{ px: 4, py: 1.5, borderRadius: 2, fontSize: '1rem', fontWeight: 700 }}
            >
              Go to Dashboard
            </Button>
          </CardContent>
        </Card>
      </Container>
    </Box>
  )
}
