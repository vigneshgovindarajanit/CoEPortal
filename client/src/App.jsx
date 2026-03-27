import AppRoutes from './routes'
import { CssBaseline, ThemeProvider, createTheme } from '@mui/material'
import { AuthProvider } from './hooks/useAuth'

const appTheme = createTheme({
  palette: {
    primary: {
      main: '#6e5af3'
    },
    secondary: {
      main: '#4a67d6'
    },
    background: {
      default: '#eef1f7',
      paper: '#ffffff'
    },
    text: {
      primary: '#1f2433',
      secondary: '#626c80'
    }
  },
  shape: {
    borderRadius: 14
  },
  typography: {
    fontFamily: 'Inter, Poppins, sans-serif'
  },
  components: {
    MuiButton: {
      defaultProps: {
        disableElevation: true
      },
      styleOverrides: {
        root: {
          textTransform: 'none',
          fontWeight: 700,
          borderRadius: 10
        },
        containedPrimary: {
          background: 'linear-gradient(90deg, #6e5af3 0%, #7f63f2 100%)',
          color: '#ffffff',
          '&:hover': {
            background: 'linear-gradient(90deg, #5f4be7 0%, #7158e7 100%)'
          }
        },
        containedError: {
          background: '#ff5656',
          color: '#ffffff',
          '&:hover': {
            background: '#f34848'
          }
        },
        outlined: {
          borderColor: '#c9d0df',
          color: '#2f3a4f',
          backgroundColor: 'transparent',
          '&:hover': {
            borderColor: '#b8c0d2',
            backgroundColor: 'rgba(111, 76, 240, 0.06)'
          }
        }
      }
    },
    MuiCard: {
      styleOverrides: {
        root: {
          border: '1px solid #e2e7f0',
          boxShadow: '0 10px 26px rgba(37, 53, 85, 0.1)'
        }
      }
    },
    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          borderRadius: 8,
          backgroundColor: '#e7ebf3',
          '& .MuiOutlinedInput-notchedOutline': {
            borderColor: '#d6dcea'
          },
          '&:hover .MuiOutlinedInput-notchedOutline': {
            borderColor: '#c3ccdf'
          },
          '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
            borderColor: '#7a68ef'
          }
        },
        input: {
          color: '#1f2433'
        }
      }
    },
    MuiInputLabel: {
      styleOverrides: {
        root: {
          color: '#5f6981',
          '&.Mui-focused': {
            color: '#5f6981'
          }
        }
      }
    },
    MuiDialog: {
      styleOverrides: {
        paper: {
          borderRadius: 16,
          border: '1px solid #dfe4ee',
          background: '#f7f8fc'
        }
      }
    },
    MuiDialogTitle: {
      styleOverrides: {
        root: {
          fontWeight: 800,
          color: '#1f2433',
          padding: '16px 20px 8px'
        }
      }
    },
    MuiDialogContent: {
      styleOverrides: {
        root: {
          padding: '12px 20px'
        }
      }
    },
    MuiDialogActions: {
      styleOverrides: {
        root: {
          padding: '12px 20px 20px',
          gap: 10,
          '& .MuiButton-root': {
            minHeight: 48,
            flex: 1,
            fontSize: '1rem',
            letterSpacing: '0.01em'
          }
        }
      }
    },
    MuiLinearProgress: {
      styleOverrides: {
        root: {
          height: 9,
          borderRadius: 999
        },
        bar: {
          borderRadius: 999
        }
      }
    }
  }
})

import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider'
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs'

export default function App() {
  return (
    <ThemeProvider theme={appTheme}>
      <LocalizationProvider dateAdapter={AdapterDayjs}>
        <CssBaseline />
        <AuthProvider>
          <AppRoutes />
        </AuthProvider>
      </LocalizationProvider>
    </ThemeProvider>
  )
}

