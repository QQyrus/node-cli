'use strict';

const gateway = require('./mobilityGateway.cjs');

const trigger = async function(apiKey) {
    try {
        const gatewayUrl = gateway.deriveGatewayUrlFromApiKey(apiKey);
        await gateway.validateApiKey(gatewayUrl, apiKey);
        console.log('\x1b[32m%s\x1b[0m', 'Connection successful!');
        process.exitCode = 0;
    } catch (error) {
        console.error('\x1b[31m%s\x1b[0m', `Connection failed: ${error.message}`);
        process.exitCode = 1;
    }
}

module.exports = {
    trigger
}
