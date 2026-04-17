import api from '../lib/api'

export async function loginUser(credentials) {
  const response = await api.post('/api/auth/login', credentials)
  return response.data?.user ? response.data : response.data?.data ?? response.data
}

export async function fetchProfile() {
  const response = await api.get('/api/auth/me')
  return response.data?.user || response.data
}
