import api from '../lib/axios'

export async function fetchExamSchedules(params = {}) {
  const response = await api.get('/exam-schedules', { params })
  return response.data
}

export async function fetchExamScheduleFilters() {
  const response = await api.get('/exam-schedules/filters')
  return response.data
}

export async function createExamSchedule(payload) {
  const response = await api.post('/exam-schedules', payload)
  return response.data
}

export async function updateExamSchedule(id, payload) {
  const response = await api.put(`/exam-schedules/${id}`, payload)
  return response.data
}

export async function deleteExamSchedule(id) {
  await api.delete(`/exam-schedules/${id}`)
}

