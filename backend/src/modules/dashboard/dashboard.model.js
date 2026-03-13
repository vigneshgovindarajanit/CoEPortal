function toNumber(value) {
  return Number(value || 0)
}

function mapCountRows(rows, labelKey, valueKey = 'total') {
  return (rows || []).map((row) => ({
    label: String(row?.[labelKey] ?? ''),
    value: toNumber(row?.[valueKey])
  }))
}

module.exports = {
  toNumber,
  mapCountRows
}
