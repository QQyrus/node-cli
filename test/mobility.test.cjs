'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const gateway = require('../utils/mobilityGateway.cjs');
const { buildReportUrl } = require('../utils/mobility.cjs');

test('buildReportUrl encodes the report name without altering the signed query', async (t) => {
    const originalGetJson = gateway.getJson;
    t.after(() => {
        gateway.getJson = originalGetJson;
    });

    gateway.getJson = async () => ({
        cloudFrontDomain: 'cdn.example.test',
        signature: '?Policy=policy-value&Signature=signature-value&Key-Pair-Id=key-id'
    });

    const cases = [
        ['Legacy Script', 'Legacy%20Script'],
        ['LegacyScript', 'LegacyScript'],
        ['Legacy/Script?#', 'Legacy%2FScript%3F%23']
    ];

    for (const [name, encodedName] of cases) {
        const reportUrl = await buildReportUrl(
            'https://gateway.example.test',
            'api-key',
            'team-id',
            {
                organization: 'organization-id',
                uuid: 'run-id',
                name
            }
        );

        assert.equal(
            reportUrl,
            `https://cdn.example.test/organization-id/run-id/${encodedName}.zip` +
                '?Policy=policy-value&Signature=signature-value&Key-Pair-Id=key-id'
        );
    }
});
