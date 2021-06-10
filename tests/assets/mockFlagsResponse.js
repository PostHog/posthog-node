const mockSimpleFlagResponse = {
    count: 1,
    next: null,
    previous: null,
    results: [
        {
            id: 719,
            name: '',
            key: 'simpleFlag',
            filters: {
                groups: [
                    {
                        properties: [],
                        rollout_percentage: null,
                    },
                ],
            },
            deleted: false,
            active: true,
            is_simple_flag: true,
            rollout_percentage: null,
        },
        {
            id: 720,
            name: '',
            key: 'enabled-flag',
            filters: {
                groups: [
                    {
                        properties: [],
                        rollout_percentage: null,
                    },
                ],
            },
            deleted: false,
            active: true,
            is_simple_flag: false,
            rollout_percentage: null,
        },
        {
            id: 721,
            name: '',
            key: 'disabled-flag',
            filters: {
                groups: [
                    {
                        properties: [],
                        rollout_percentage: null,
                    },
                ],
            },
            deleted: false,
            active: true,
            is_simple_flag: false,
            rollout_percentage: null,
        },
    ],
}

module.exports = { mockSimpleFlagResponse }
