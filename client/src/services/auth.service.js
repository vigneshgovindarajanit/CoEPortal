import api from '../lib/api'

export async function loginUser(credentials) {
  const response = await api.post('/auth/login', credentials)
  return response.data?.user ? response.data : response.data?.data ?? response.data
}

export async function fetchProfile() {
  const response = await api.get('/auth/me')
  return response.data?.user || response.data
}
