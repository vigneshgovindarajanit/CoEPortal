import api from '../lib/api'

export async function fetchCourseRegistrations(params = {}) {
  const response = await api.get('/course-registrations', { params })
  return response.data
}
