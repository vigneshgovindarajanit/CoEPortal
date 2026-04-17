import api from '../lib/api'

export async function fetchStudents(params = {}) {
  const response = await api.get('/api/students', { params })
  return response.data
}

export async function fetchStudentsSummary() {
  const response = await api.get('/api/students/summary')
  return response.data
}

export async function createStudent(payload) {
  const response = await api.post('/api/students', payload)
  return response.data
}

export async function updateStudent(id, payload) {
  const response = await api.put(`/api/students/${id}`, payload)
  return response.data
}

export async function generateBulkStudents(payload) {
  const response = await api.post('/api/students/generate-bulk', payload)
  return response.data
}

export async function deleteStudent(id) {
  await api.delete(`/api/students/${id}`)
}
