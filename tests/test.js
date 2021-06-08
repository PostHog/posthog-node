import { spy, stub } from 'sinon'
import bodyParser from 'body-parser'
import express from 'express'
import delay from 'delay'
import pify from 'pify'
import test from 'ava'
import PostHog from '../index'
import { version } from '../package'
import { mockSimpleFlagResponse } from './assets/mockFlagsResponse'


const noop = () => {}

const port = 6042

const createClient = (options) => {
    options = Object.assign(
        {
            host: `http://localhost:${port}`,
        },
        options
    )

    const client = new PostHog('key', options)
    client.flush = pify(client.flush.bind(client))
    client.flushed = true

    return client
}

test.before.cb((t) => {
    express()
        .use(bodyParser.json())
        .post('/batch', (req, res) => {
            const { api_key: apiKey, batch } = req.body

            if (!apiKey) {
                return res.status(400).json({
                    error: { message: 'missing api key' },
                })
            }

            const ua = req.headers['user-agent']
            if (ua !== `posthog-node/${version}`) {
                return res.status(400).json({
                    error: { message: 'invalid user-agent' },
                })
            }

            if (batch[0] === 'error') {
                return res.status(400).json({
                    error: { message: 'error' },
                })
            }

            if (batch[0] === 'timeout') {
                return setTimeout(() => res.end(), 5000)
            }

            res.json({})
        })
        .get('/api/feature_flag', (req, res) => {
            return res.status(200).json(mockSimpleFlagResponse)
        })
        .post('/decide', (req, res) => {
            return res.status(200).json({
                featureFlags: ['enabled-flag']
            })
        })
        .listen(port, t.end)
})

test('expose a constructor', (t) => {
    t.is(typeof PostHog, 'function')
})

test('require a api key', (t) => {
    t.throws(() => new PostHog(), "You must pass your PostHog project's api key.")
})

test('create a queue', (t) => {
    const client = createClient()

    t.deepEqual(client.queue, [])
})

test('default options', (t) => {
    const client = new PostHog('key')

    t.is(client.apiKey, 'key')
    t.is(client.host, 'https://app.posthog.com')
    t.is(client.flushAt, 20)
    t.is(client.flushInterval, 10000)
})

test('remove trailing slashes from `host`', (t) => {
    const client = new PostHog('key', { host: 'http://google.com///' })

    t.is(client.host, 'http://google.com')
})

test('overwrite defaults with options', (t) => {
    const client = new PostHog('key', {
        host: 'a',
        flushAt: 1,
        flushInterval: 2,
    })

    t.is(client.host, 'a')
    t.is(client.flushAt, 1)
    t.is(client.flushInterval, 2)
})

test('keep the flushAt option above zero', (t) => {
    const client = createClient({ flushAt: 0 })

    t.is(client.flushAt, 1)
})

test('enqueue - add a message to the queue', (t) => {
    const client = createClient()

    const timestamp = new Date()
    client.enqueue('type', { timestamp }, noop)

    t.is(client.queue.length, 1)

    const item = client.queue.pop()

    // t.is(typeof item.message.messageId, 'string')
    // t.regex(item.message.messageId, /node-[a-zA-Z0-9]{32}/)
    t.deepEqual(item, {
        message: {
            timestamp,
            library: 'posthog-node',
            library_version: version,
            type: 'type',
            // messageId: item.message.messageId
        },
        callback: noop,
    })
})

test("enqueue - don't modify the original message", (t) => {
    const client = createClient()
    const message = { event: 'test' }

    client.enqueue('type', message)

    t.deepEqual(message, { event: 'test' })
})

test('enqueue - flush on first message', (t) => {
    const client = createClient({ flushAt: 2 })
    client.flushed = false
    spy(client, 'flush')

    client.enqueue('type', {})
    t.true(client.flush.calledOnce)

    client.enqueue('type', {})
    t.true(client.flush.calledOnce)

    client.enqueue('type', {})
    t.true(client.flush.calledTwice)
})

test('enqueue - flush the queue if it hits the max length', (t) => {
    const client = createClient({
        flushAt: 1,
        flushInterval: null,
    })

    stub(client, 'flush')

    client.enqueue('type', {})

    t.true(client.flush.calledOnce)
})

test('enqueue - flush after a period of time', async (t) => {
    const client = createClient({ flushInterval: 10 })
    stub(client, 'flush')

    client.enqueue('type', {})

    t.false(client.flush.called)
    await delay(20)

    t.true(client.flush.calledOnce)
})

test("enqueue - don't reset an existing timer", async (t) => {
    const client = createClient({ flushInterval: 10 })
    stub(client, 'flush')

    client.enqueue('type', {})
    await delay(5)
    client.enqueue('type', {})
    await delay(5)

    t.true(client.flush.calledOnce)
})

test('enqueue - skip when client is disabled', async (t) => {
    const client = createClient({ enable: false })
    stub(client, 'flush')

    const callback = spy()
    client.enqueue('type', {}, callback)
    await delay(5)

    t.true(callback.calledOnce)
    t.false(client.flush.called)
})

test("flush - don't fail when queue is empty", async (t) => {
    const client = createClient()

    await t.notThrows(client.flush())
})

test('flush - send messages', async (t) => {
    const client = createClient({ flushAt: 2 })

    const callbackA = spy()
    const callbackB = spy()
    const callbackC = spy()

    client.queue = [
        {
            message: 'a',
            callback: callbackA,
        },
        {
            message: 'b',
            callback: callbackB,
        },
        {
            message: 'c',
            callback: callbackC,
        },
    ]

    const data = await client.flush()
    t.deepEqual(Object.keys(data), ['api_key', 'batch'])
    t.deepEqual(data.batch, ['a', 'b'])
    t.true(callbackA.calledOnce)
    t.true(callbackB.calledOnce)
    t.false(callbackC.called)
})

test('flush - respond with an error', async (t) => {
    const client = createClient()
    const callback = spy()

    client.queue = [
        {
            message: 'error',
            callback,
        },
    ]

    await t.throws(client.flush(), 'Bad Request')
})

test('flush - time out if configured', async (t) => {
    const client = createClient({ timeout: 500 })
    const callback = spy()

    client.queue = [
        {
            message: 'timeout',
            callback,
        },
    ]
    await t.throws(client.flush(), 'timeout of 500ms exceeded')
}) 

test('flush - skip when client is disabled', async (t) => {
    const client = createClient({ enable: false })
    const callback = spy()

    client.queue = [
        {
            message: 'test',
            callback,
        },
    ]

    await client.flush()

    t.false(callback.called)
})

test('identify - enqueue a message', (t) => {
    const client = createClient()
    stub(client, 'enqueue')

    const message = { distinctId: 'id', properties: { fish: 'swim in the sea' } }
    client.identify(message, noop)

    const apiMessage = {
        distinctId: 'id',
        $set: { fish: 'swim in the sea' },
        event: '$identify',
        properties: { $lib: 'posthog-node', $lib_version: version },
    }

    t.true(client.enqueue.calledOnce)
    t.deepEqual(client.enqueue.firstCall.args, ['identify', apiMessage, noop])
})

test('identify - require a distinctId or alias', (t) => {
    const client = createClient()
    stub(client, 'enqueue')

    t.throws(() => client.identify(), 'You must pass a message object.')
    t.throws(() => client.identify({}), 'You must pass a "distinctId".')
    t.notThrows(() => client.identify({ distinctId: 'id' }))
})

test('capture - enqueue a message', (t) => {
    const client = createClient()
    stub(client, 'enqueue')

    const message = {
        distinctId: '1',
        event: 'event',
    }
    const apiMessage = {
        distinctId: '1',
        properties: { $lib: 'posthog-node', $lib_version: version },
        event: 'event',
    }

    client.capture(message, noop)

    t.true(client.enqueue.calledOnce)
    t.deepEqual(client.enqueue.firstCall.args, ['capture', apiMessage, noop])
})

test('capture - require event and either distinctId or alias', (t) => {
    const client = createClient()
    stub(client, 'enqueue')

    t.throws(() => client.capture(), 'You must pass a message object.')
    t.throws(() => client.capture({}), 'You must pass a "distinctId".')
    t.throws(() => client.capture({ distinctId: 'id' }), 'You must pass an "event".')
    t.notThrows(() => {
        client.capture({
            distinctId: 'id',
            event: 'event',
        })
    })
})

test('alias - enqueue a message', (t) => {
    const client = createClient()
    stub(client, 'enqueue')

    const message = {
        distinctId: 'id',
        alias: 'id',
    }
    const apiMessage = {
        properties: { distinct_id: 'id', alias: 'id', $lib: 'posthog-node', $lib_version: version },
        event: '$create_alias',
        distinct_id: null,
    }

    client.alias(message, noop)

    t.true(client.enqueue.calledOnce)
    t.deepEqual(client.enqueue.firstCall.args, ['alias', apiMessage, noop])
})

test('alias - require alias and distinctId', (t) => {
    const client = createClient()
    stub(client, 'enqueue')

    t.throws(() => client.alias(), 'You must pass a message object.')
    t.throws(() => client.alias({}), 'You must pass a "distinctId".')
    t.throws(() => client.alias({ distinctId: 'id' }), 'You must pass a "alias".')
    t.notThrows(() => {
        client.alias({
            distinctId: 'id',
            alias: 'id',
        })
    })
})

test('isErrorRetryable', (t) => {
    const client = createClient()

    t.false(client._isErrorRetryable({}))

    // ETIMEDOUT is retryable as per `is-retry-allowed` (used by axios-retry in `isNetworkError`).
    t.true(client._isErrorRetryable({ code: 'ETIMEDOUT' }))

    // ECONNABORTED is not retryable as per `is-retry-allowed` (used by axios-retry in `isNetworkError`).
    t.false(client._isErrorRetryable({ code: 'ECONNABORTED' }))

    t.true(client._isErrorRetryable({ response: { status: 500 } }))
    t.true(client._isErrorRetryable({ response: { status: 429 } }))

    t.false(client._isErrorRetryable({ response: { status: 200 } }))
})

test('allows messages > 32kb', (t) => {
    const client = createClient()

    const event = {
        distinctId: 1,
        event: 'event',
        properties: {},
    }
    for (var i = 0; i < 10000; i++) {
        event.properties[i] = 'a'
    }

    t.notThrows(() => {
        client.capture(event, noop)
    })
})

test('feature flags - require personalApiKey', async (t) => {
    const client = createClient()

    await t.throws(client.isFeatureEnabled('simpleFlag', 'some id'), 'You have to specify the option personalApiKey to use feature flags.')

    client.shutdown()
})

test('feature flags - isSimpleFlag', async (t) => {
    const client = createClient({ personalApiKey: 'my very secret key' })

    const isEnabled = await client.isFeatureEnabled('simpleFlag', 'some id')

    t.is(isEnabled, true)

    client.shutdown()
})

test('feature flags - complex flags', async (t) => {
    const client = createClient({ personalApiKey: 'my very secret key' })

    const expectedEnabledFlag = await client.isFeatureEnabled('enabled-flag', 'some id')
    const expectedDisabledFlag = await client.isFeatureEnabled('disabled-flag', 'some id')

    t.is(expectedEnabledFlag, true)
    t.is(expectedDisabledFlag, false)

    client.shutdown()
})

test('feature flags - default override', async (t) => {
    const client = createClient({ personalApiKey: 'my very secret key' })

    let flagEnabled = await client.isFeatureEnabled('i-dont-exist', 'some id')
    t.is(flagEnabled, false)

    flagEnabled = await client.isFeatureEnabled('i-dont-exist', 'some id', true)
    t.is(flagEnabled, true)

    client.shutdown()
})

test('feature flags - simple flag calculation', async (t) => {
    const client = createClient({ personalApiKey: 'my very secret key' })

    // This tests that the hashing + mathematical operations across libs are consistent 
    let flagEnabled = client.featureFlagsPoller._isSimpleFlagEnabled({key: 'a', distinctId: 'b', rolloutPercentage: 42})
    t.is(flagEnabled, true)

    flagEnabled = client.featureFlagsPoller._isSimpleFlagEnabled({key: 'a', distinctId: 'b', rolloutPercentage: 40})
    t.is(flagEnabled, false)

    client.shutdown()
})