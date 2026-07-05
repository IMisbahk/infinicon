function toMemoryApiError(error) {
  if (error && error.memoryApiError) {
    return error.memoryApiError
  }

  return {
    code: 'internal_error',
    message: error && error.message ? error.message : 'internal error',
    retryable: false
  }
}

module.exports = {
  toMemoryApiError
}
