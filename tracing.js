const api = require('@opentelemetry/api')

const version = require('./package.json').version

const libraryTracer = api.trace.getTracer('posthog-node', version)

module.exports = libraryTracer
