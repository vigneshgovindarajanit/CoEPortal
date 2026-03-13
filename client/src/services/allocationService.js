import api from '../lib/axios'

export async function generateAllocation(payload) {
  const response = await api.post('/allocations/generate', payload)
  return response.data
}

export async function fetchLatestAllocation() {
  const response = await api.get('/allocations/latest')
  return response.data
}

export async function assignFacultyToAllocation(allocationId) {
  const response = await api.post(`/allocations/${allocationId}/assign-faculty`)
  return response.data
}
