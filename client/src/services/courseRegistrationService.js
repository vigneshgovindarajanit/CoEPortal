import api from '../lib/axios'\n\nexport async function fetchCourseRegistrations(params = {}) {\n  const response = await api.get('/course-registrations', { params })\n  return response.data\n}\n
