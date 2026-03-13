function validateDepartmentInput(payload = {}) {
  const program = String(payload.program || '')
    .trim()
    .toUpperCase()
  const code = String(payload.code || '')
    .trim()
    .toUpperCase()
  const name = String(payload.name || '').trim()
  const intake = Number(payload.intake)
  const isActive = payload.isActive === undefined ? true : Boolean(payload.isActive)

  const errors = []
  if (!['BE', 'BTECH'].includes(program)) {
    errors.push('Program must be BE or BTECH')
  }
  if (!code) {
    errors.push('Department code is required')
  }
  if (!name) {
    errors.push('Department name is required')
  }
  if (!Number.isInteger(intake) || intake < 0) {
    errors.push('Intake must be a non-negative integer')
  }

  if (errors.length > 0) {
    const err = new Error(errors.join(', '))
    err.status = 400
    throw err
  }

  return { program, code, name, intake, isActive }
}

module.exports = {
  validateDepartmentInput
}
