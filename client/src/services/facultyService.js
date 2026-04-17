import api from '../lib/api'

export async function fetchFaculty(params = {}) {
  const response = await api.get('/api/faculty', { params })
  return response.data
}

export async function fetchFacultyDepartments() {
  const response = await api.get('/api/faculty/departments')
  return response.data
}

export async function fetchWorkloadRules() {
  const response = await api.get('/api/faculty/rules')
  return response.data
}

export async function createFaculty(payload) {
  const response = await api.post('/api/faculty', payload)
  return response.data
}

export async function updateFaculty(id, payload) {
  const response = await api.put(`/api/faculty/${id}`, payload)
  return response.data
}

export async function autoAssignSupervisor(payload) {
  const response = await api.post('/api/faculty/auto-assign', payload)
  return response.data
}

export async function autoAssignAllFaculty(payload = {}) {
  const response = await api.post('/api/faculty/auto-assign-all', payload)
  return response.data
}

export async function fetchLatestFacultyAssignments() {
  const response = await api.get('/api/faculty/assignments/latest')
  return response.data
}

export async function fetchHistoricalFacultyAssignments() {
  const response = await api.get('/api/faculty/assignments/historical')
  return response.data
}

export async function cancelAllAssignedFaculty() {
  const response = await api.post('/api/faculty/cancel-all-assigned')
  return response.data
}

export async function cancelFacultyAssignment(id) {
  const response = await api.post(`/api/faculty/${id}/cancel-assignment`)
  return response.data
}

export async function fetchPracticalHalls() {
  const response = await api.get('/api/halls')
  return (response.data || []).filter((hall) => String(hall.examType || '').toUpperCase() === 'PRACTICAL')
}

export async function fetchHalls() {
  const response = await api.get('/api/halls')
  return response.data || []
}
