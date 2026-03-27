import api from '../lib/api'

export async function fetchResults(params = {}) {
  const response = await api.get('/results', { params })
  return response.data
}
