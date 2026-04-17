import api from '../lib/api'

export async function generateAllocation(payload) {
  const response = await api.post('/api/allocations/generate', payload)
  return response.data
}

export async function fetchLatestAllocation(params = {}) {
  const response = await api.get('/api/allocations/latest', { params })
  return response.data
}

export async function assignFacultyToAllocation(allocationId) {
  const response = await api.post(`/api/allocations/${allocationId}/assign-faculty`)
  return response.data
}
