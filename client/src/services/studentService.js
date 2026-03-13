import api from '../lib/axios'

export async function fetchStudents(params = {}) {
  const response = await api.get('/students', { params })
  return response.data
}

export async function fetchStudentsSummary() {
  const response = await api.get('/students/summary')
  return response.data
}

export async function createStudent(payload) {
  const response = await api.post('/students', payload)
  return response.data
}

export async function updateStudent(id, payload) {
  const response = await api.put(`/students/${id}`, payload)
  return response.data
}

export async function generateBulkStudents(payload) {
  const response = await api.post('/students/generate-bulk', payload)
  return response.data
}

export async function deleteStudent(id) {
  await api.delete(`/students/${id}`)
}
