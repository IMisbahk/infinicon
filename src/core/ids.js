let sequence = 0

function nextId(prefix = 'obj') {
  sequence += 1
  const value = String(sequence).padStart(8, '0')
  return `${prefix}_${value}`
}

module.exports = {
  nextId
}
