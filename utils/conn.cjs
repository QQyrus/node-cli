const fs = require('fs');
const https = require('https')
const http = require('http')
const request = require('request')
const path = require('path')
const url = require('url')
const { exec } = require("child_process");

let baseContext = '/cli-adapter-mobility/v1';

const trigger = function(endPoint) {
    const gatewayURLParse = new URL(endPoint);
    let host_name = gatewayURLParse.hostname;
    let port = gatewayURLParse.port;
   
    var testSuiteNames = {
        host: host_name,
        port: port,
        path: baseContext+'/testGet',
        method: 'GET'
    };

    var testSuiteName = "";
    var req = https.request(testSuiteNames, function(res) {
        res.on('data', function(d) {
            testSuiteName+=d;
            console.log('\x1b[32m%s\x1b[0m','Connection successful!');
            process.exitCode = 0;
        });
    });
    req.end();
    req.on('error', function(e) {
        console.error(e);
        process.exitCode = 1;
    });
}

module.exports = {
    trigger
}
