const PostHog = require('./index')

async function test() {
    const ph = new PostHog('uezHoiphmRMX4iatknEJY3bbAxzRlvNdQCpxl4nmDjo', {
        host: 'https://app.posthog.com',
        personalApiKey: '9nEm6Gd1-vdlh7c1putekaS-utx3iq1TDzZx0dRpgkQ',
        flushAt: 0,
        flushInterval: 0,
        debug: true,
    })
    ph.capture({
        distinctId: 'distinct id',
        event: 'movie played',
        properties: {
            movieId: '123',
            category: 'romcom',
        },
    })
    ph.flush()
    const isEnabled = await ph.isFeatureEnabled('hey', '630516e9-15bf-41c2-87b4-d0233a3d7ba0')
    console.log(isEnabled)
    ph.shutdown()
}

test()
