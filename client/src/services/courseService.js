import api from '../lib/axios'

export async function fetchCourses(params = {}) {
  const response = await api.get('/courses', { params })
  return response.data
}

export async function fetchCourseFilters() {
  const response = await api.get('/courses/filters')
  return response.data
}

export async function createCourse(payload) {
  const response = await api.post('/courses', payload)
  return response.data
}

export async function updateCourse(id, payload) {
  const response = await api.put(`/courses/${id}`, payload)
  return response.data
}
