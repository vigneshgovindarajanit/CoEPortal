const ROLE_RULES = [
  {
    canonicalRole: 'Assistant Professor',
    maxWorkload: 5,
    aliases: ['assistant professor', 'assistant prof', 'asst professor', 'asst prof']
  },
  {
    canonicalRole: 'Assistant Professor Level II',
    maxWorkload: 4,
    aliases: [
      'assistant professor level ii',
      'assistant professor level 2',
      'assistant prof level ii',
      'assistant prof level 2',
      'asp level ii',
      'asp level 2'
    ]
  },
  {
    canonicalRole: 'Assistant Professor Level III',
    maxWorkload: 3,
    aliases: [
      'assistant professor level iii',
      'assistant professor level 3',
      'assistant prof level iii',
      'assistant prof level 3',
      'asp level iii',
      'asp level 3'
    ]
  },
  {
    canonicalRole: 'Associate Professor',
    maxWorkload: 2,
    aliases: ['associate professor', 'associate prof', 'associative prof']
  },
  {
    canonicalRole: 'Professor',
    maxWorkload: 1,
    aliases: ['professor', 'prof']
  },
  {
    canonicalRole: 'Head',
    maxWorkload: 1,
    aliases: ['head', 'hod', 'head of department']
  }
]

function normalizeRoleText(value = '') {
  return String(value).trim().toLowerCase().replace(/\s+/g, ' ')
}

function toTitleCase(value = '') {
  return String(value)
    .toLowerCase()
    .replace(/\b\w/g, (char) => char.toUpperCase())
}

function resolveRole(roleInput = '') {
  const normalized = normalizeRoleText(roleInput)
  if (!normalized) {
    return null
  }

  if (normalized.includes('principal')) {
    return {
      canonicalRole: 'Principal',
      maxWorkload: 0
    }
  }

  for (const rule of ROLE_RULES) {
    if (rule.aliases.includes(normalized)) {
      return {
        canonicalRole: rule.canonicalRole,
        maxWorkload: rule.maxWorkload
      }
    }
  }

  return null
}

function isPrincipalRole(roleInput = '') {
  return normalizeRoleText(roleInput).includes('principal')
}

function getRoleRules() {
  return ROLE_RULES.map((rule) => ({
    canonicalRole: rule.canonicalRole,
    maxWorkload: rule.maxWorkload
  }))
}

function validateFacultyInput(payload = {}, options = {}) {
  const partial = Boolean(options.partial)
  const errors = []

  const fullNameRaw = payload.fullName ?? payload.full_name
  const departmentRaw = payload.department ?? payload.department_name
  const roleRaw = payload.role ?? payload.role_title
  const currentWorkloadRaw = payload.currentWorkload ?? payload.current_workload
  const isActiveRaw = payload.isActive ?? payload.is_active

  const fullName = fullNameRaw === undefined ? undefined : String(fullNameRaw).trim()
  const department = departmentRaw === undefined ? undefined : String(departmentRaw).trim()
  const roleResolved = roleRaw === undefined ? null : resolveRole(roleRaw)
  const role = roleResolved ? roleResolved.canonicalRole : undefined
  const maxWorkload = roleResolved ? roleResolved.maxWorkload : undefined
  const currentWorkload =
    currentWorkloadRaw === undefined || currentWorkloadRaw === null
      ? undefined
      : Number(currentWorkloadRaw)
  const isActive =
    isActiveRaw === undefined || isActiveRaw === null ? undefined : Boolean(isActiveRaw)

  if (!partial || fullName !== undefined) {
    if (!fullName) {
      errors.push('Full name is required')
    }
  }

  if (!partial || department !== undefined) {
    if (!department) {
      errors.push('Department is required')
    }
  }

  if (!partial || roleRaw !== undefined) {
    if (!roleRaw) {
      errors.push('Role is required')
    } else if (!roleResolved) {
      errors.push('Role is invalid for workload rules')
    }
  }

  if (currentWorkload !== undefined) {
    if (!Number.isInteger(currentWorkload) || currentWorkload < 0) {
      errors.push('Current workload must be a non-negative integer')
    }
  }

  if (errors.length > 0) {
    const err = new Error(errors.join('. '))
    err.status = 400
    throw err
  }

  const normalized = {}

  if (fullName !== undefined) {
    normalized.fullName = toTitleCase(fullName)
  }
  if (department !== undefined) {
    normalized.department = department.toUpperCase()
  }
  if (role !== undefined) {
    normalized.role = role
    normalized.maxWorkload = maxWorkload
  }
  if (currentWorkload !== undefined) {
    normalized.currentWorkload = currentWorkload
  }
  if (isActive !== undefined) {
    normalized.isActive = isActive
  }

  return normalized
}

module.exports = {
  getRoleRules,
  resolveRole,
  isPrincipalRole,
  validateFacultyInput
}
