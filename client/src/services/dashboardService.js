import api from '../lib/axios'

export async function fetchDashboardOverview() {
  const response = await api.get('/dashboard/overview')
  return response.data
}
