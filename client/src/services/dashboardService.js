import api from '../lib/api'

export async function fetchDashboardOverview() {
  const response = await api.get('/api/dashboard/overview')
  return response.data
}
