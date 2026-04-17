import api from '../lib/api'

export async function fetchCourses(params = {}) {
  const response = await api.get('/api/courses', { params })
  return response.data
}

export async function fetchCourseFilters() {
  const response = await api.get('/api/courses/filters')
  return response.data
}

export async function createCourse(payload) {
  const response = await api.post('/api/courses', payload)
  return response.data
}

export async function updateCourse(id, payload) {
  const response = await api.put(`/api/courses/${id}`, payload)
  return response.data
}
