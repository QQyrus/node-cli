#!/usr/bin/env node

const { Command } = require('commander');
var webUtil = require('./utils/web.cjs');
var mobilityUtil = require('./utils/mobility.cjs');
var componentUtil = require('./utils/component.cjs');
var globalVarUtil = require('./utils/globalVar.cjs');
var globalVarMobilityUtil = require('./utils/globalVarMobility.cjs');
var appUploadMobilityUtil = require('./utils/appUpload.cjs');
var appCountMobilityUtil = require('./utils/appCount.cjs');
var apkMobilityUtil = require('./utils/getApkMobility.cjs');
const importMobilityScriptFromFile = require('./utils/importMobilityScriptFromFile.cjs');
const updateMobilityScriptFromFile = require('./utils/updateMobilityScriptFromFile.cjs');
var apkComponentUtil= require('./utils/getApkComponent.cjs');
var appDeleteUtil = require('./utils/appDelete.cjs');
var globalVarComponentUtil = require('./utils/globalVarComponent.cjs');
var connCheck = require('./utils/conn.cjs');
var roverUtil = require('./utils/rover.cjs');
var apiFunctionalUtil = require('./utils/apiFunctional.cjs');
var apiProcessUtil = require('./utils/apiProcess.cjs');
var apiPerformanceUtil = require('./utils/apiPerformance.cjs');

const program = new Command();

program
  .name('qyrus-cli')
  .description('Helps you to manage variables, apps and to run tests on Qyrus platform')
  .version('1.8.9');

// Web Commands
program.command('web')
  .description('helps you trigger web tests on the platform')
  .option('--endPoint <string>', 'Qyrus endpoint provided by Qyrus admin')
  .option('-u, --username <string>', 'Qyrus admin provided email')
  .option('-p, --passcode <string>', 'Qyrus admin provided passcode in base64 format')
  .option('--teamName <string>', 'Team name you can find by logging into Qyrus app.')
  .option('--projectName <string>', 'Project name you can find by logging into Qyrus app.')
  .option('--suiteName <string>', 'Test suite name you can find by logging into Qyrus app.')
  .option('--env <string>', '(optional) Global variable name you can find by logging into Qyrus app.')
  .option('--browserOS <string>', 'Browser operating system eg: windows/linux')
  .option('--browser <string>', 'Browser name eg: chrome/firefox/MicrosoftEdge?')
  .option('--onErrorContinue <boolean>', 'Continue execution on error?')
  .option('--parameterFileSource <string>','parameterFileSource name you can find by logging into Qyrus app.')
  .option('--emailId <string>', '(optional) email id to which the reports need to be sent post execution')
  .action((options) => {
    webUtil.trigger(options.endPoint, options.username, options.passcode, 
        options.teamName, options.projectName, options.suiteName,
        options.browserOS, options.browser, options.onErrorContinue,options.parameterFileSource,
        options.emailId, options.env);
});

program.command('update-web-variables')
  .description('helps you update global variables on web automation service')
  .option('--endPoint <string>', 'Qyrus endpoint provided by Qyrus admin')
  .option('-u, --username <string>', 'Qyrus admin provided email')
  .option('-p, --passcode <string>', 'Qyrus admin provided passcode in base64 format')
  .option('--teamName <string>', 'Team name you can find by logging into Qyrus app.')
  .option('--projectName <string>', 'Project name you can find by logging into Qyrus app.')
  .option('--variableEnvName <string>', 'Variables environment name, you can find by logging into Qyrus app.')
  .option('--variableName <string>', 'Existing variable name eg: Demo')
  .option('--variableType <string>', 'Existing variable type eg: Custom, BaseURL, Password.')
  .option('--variableValue <string>', 'Value to update the existing variable.')
  .action((options) => {
    globalVarUtil.trigger(options.endPoint, options.username, options.passcode, 
        options.teamName, options.projectName, options.variableEnvName, 
        options.variableName, options.variableType, options.variableValue);
});

// Mobility Commands
program.command('mobility')
  .description('helps you trigger mobility tests on the platform')
  .option('--endPoint <string>', 'Qyrus endpoint provided by Qyrus admin')
  .option('-u, --username <string>', 'Qyrus admin provided email')
  .option('-p, --passcode <string>', 'Qyrus admin provided passcode in base64 format')
  .option('--teamName <string>', 'Team name you can find by logging into Qyrus app.')
  .option('--projectName <string>', 'Project name you can find by logging into Qyrus app.')
  .option('--suiteName <string>', 'Test suite name you can find by logging into Qyrus app.')
  .option('--appName <string>', '(Optional) Enter android/iOS app name')
  .option('--appActivity <string>', '(Optional - if bundleId is passed) Enter android app activity which will be in the form of com.example.splash_screen')
  .option('--appPackage <string>', '(Optional - if bundleId is passed) Enter android app package which will be in the form of com.android.chrome (Optional, To run tests on preinstalled apps)')
  .option('--devicePoolName <string>', 'Specify your device pool name which you created on Qyrus, a device pool will have list of devices added and a test run will happen on a device from the pool.')
  .option('--enableDebug <string>', 'Prints additional debug information if this option is enabled. ex: yes/no')
  .option('--bundleId <string>', 'Enter iOS app bundleId which will be in the form of com.example.splash_screen (Optional, during android runs)')
  .option('--emailId <string>', '(optional) email id to which the reports need to be sent post execution')
  .option('--envName <string>', 'environment name to run the tests with. (Optional if its Global)')
  .option('--firstAvailableDevice <string>', 'use first available device. ex: yes/no')
  .option('--file <string>', '(Optional) File path to read configuration to run command' )
  .action((options) => {
    mobilityUtil.trigger(options.endPoint, options.username, options.passcode,
      options.teamName, options.projectName, options.suiteName, 
      options.appName, options.appActivity, options.devicePoolName,
      options.enableDebug, options.bundleId, options.emailId, options.appPackage, options.envName, options.firstAvailableDevice, options.file);
});

program.command('update-mobility-variables')
  .description('helps you update global variables on mobility service')
  .option('--endPoint <string>', 'Qyrus endpoint provided by Qyrus admin')
  .option('-u, --username <string>', 'Qyrus admin provided email')
  .option('-p, --passcode <string>', 'Qyrus admin provided passcode in base64 format')
  .option('--teamName <string>', 'Team name you can find by logging into Qyrus app.')
  .option('--projectName <string>', 'Project name you can find by logging into Qyrus app.')
  .option('--variableName <string>', 'Existing variable name eg: Demo')
  .option('--variableType <string>', 'Existing variable type eg: Custom, BaseURL, Password.')
  .option('--variableValue <string>', 'Value to update the existing variable.')
  .option('--envName <string>', 'environment name to which the value needs to be updated. (Optional if its Global)')
  .option('--file <string>', '(Optional) File path to read configuration to run command' )
  .action((options) => {
    globalVarMobilityUtil.trigger(options.endPoint, options.username, options.passcode, 
        options.teamName, options.projectName, options.variableName, 
        options.variableType, options.variableValue, options.envName, options.file);
});

program.command('upload-app-mobility')
  .description('helps you upload apps iOS/android to mobility service')
  .option('--endPoint <string>', 'Qyrus endpoint provided by Qyrus admin')
  .option('-u, --username <string>', 'Qyrus admin provided email')
  .option('-p, --passcode <string>', 'Qyrus admin provided passcode in base64 format')
  .option('--teamName <string>', 'Team name you can find by logging into Qyrus app.')
  .option('--projectName <string>', 'Project name you can find by logging into Qyrus app.')
  .option('--appPath <string>', 'Path to app to be uploaded')
  .option('--file <string>', '(Optional) File path to read configuration to run command' )
  .action((options) => {
    var execCmd = 'mobility';
    var appType = '';
    appUploadMobilityUtil.trigger(options.endPoint, options.username, options.passcode, 
        options.teamName, options.projectName, options.appPath,appType,execCmd, options.file);
});

program.command('delete-app-mobility')
  .description('helps you delete apps iOS/android to mobility service')
  .option('--endPoint <string>', 'Qyrus endpoint provided by Qyrus admin')
  .option('-u, --username <string>', 'Qyrus admin provided email')
  .option('-p, --passcode <string>', 'Qyrus admin provided passcode in base64 format')
  .option('--teamName <string>', 'Team name you can find by logging into Qyrus app.')
  .option('--projectName <string>', 'Project name you can find by logging into Qyrus app.')
  .option('--appName <string>', 'Existing app name eg: Demo.apk/Demo.ipa')
  .option('--file <string>', '(Optional) File path to read configuration to run command' )
  .action((options) => {
    var execCmd = 'mobility';
    appDeleteUtil.trigger(options.endPoint, options.username, options.passcode, 
        options.teamName, options.projectName, options.appName, execCmd, options.file);
});

program.command('get-apk-count-mobility')
  .description('helps you to get app count for iOS/android to mobility service')
  .option('--endPoint <string>', 'Qyrus endpoint provided by Qyrus admin')
  .option('-u, --username <string>', 'Qyrus admin provided email')
  .option('-p, --passcode <string>', 'Qyrus admin provided passcode in base64 format')
  .option('--teamName <string>', 'Team name you can find by logging into Qyrus app.')
  .option('--projectName <string>', 'Project name you can find by logging into Qyrus app.')
  .option('--file <string>', '(Optional) File path to read configuration to run command' )
  .action((options) => {
    var execCmd = 'mobility';
    appCountMobilityUtil.trigger(options.endPoint, options.username, options.passcode, 
        options.teamName, options.projectName, execCmd, options.file);
});

program.command('get-apk-mobility')
  .description('helps you to get uploaded apps from mobility service for iOS/Android project')
  .option('--endPoint <string>', 'Qyrus endpoint provided by Qyrus admin')
  .option('--teamName <string>', 'Team name you can find by logging into Qyrus app.')
  .option('--projectName <string>', 'Project name you can find by logging into Qyrus app.')
  .option('--file <string>', '(Optional) File path to read configuration to run command' )
  .action((options) => {
    var execCmd = 'mobility';
    apkMobilityUtil.trigger(options.endPoint, options.teamName, options.projectName, execCmd, options.file);
});

program.command('import-mobility-script-from-file')
  .description('imports script using file data into mobility service')
  .option('--endPoint <string>', 'Qyrus endpoint provided by Qyrus admin')
  .option('-u, --username <string>', 'Qyrus admin provided email')
  .option('-p, --passcode <string>', 'Qyrus admin provided passcode in base64 format')
  .option('--teamName <string>', 'Team name you can find by logging into Qyrus app.')
  .option('--projectName <string>', 'Project name you can find by logging into Qyrus app.')
  .option('--suiteName <string>', 'Test suite name you can find by logging into Qyrus app.')
  .option('--scriptFile <string>', 'File path to import script data' )
  .option('--file <string>', '(Optional) File path to read configuration to run command' )
  .action((options) => {
    importMobilityScriptFromFile.trigger(options.endPoint, options.username, options.passcode, 
        options.teamName, options.projectName, options.suiteName, options.scriptFile, options.file);
});

program.command('update-mobility-script-from-file')
  .description('updates script steps using file data in mobility service')
  .option('--endPoint <string>', 'Qyrus endpoint provided by Qyrus admin')
  .option('-u, --username <string>', 'Qyrus admin provided email')
  .option('-p, --passcode <string>', 'Qyrus admin provided passcode in base64 format')
  .option('--teamName <string>', 'Team name you can find by logging into Qyrus app.')
  .option('--projectName <string>', 'Project name you can find by logging into Qyrus app.')
  .option('--suiteName <string>', 'Test suite name you can find by logging into Qyrus app.')
  .option('--scriptName <string>', 'Test script name you can find by logging into Qyrus app.')
  .option('--scriptFile <string>', 'File path to update script data' )
  .option('--file <string>', '(Optional) File path to read configuration to run command' )
  .action((options) => {
    updateMobilityScriptFromFile.trigger(options.endPoint, options.username, options.passcode, 
        options.teamName, options.projectName, options.suiteName, options.scriptName, options.scriptFile, options.file);
});


// Component Commands
program.command('update-component-variables')
  .description('helps you update global variables on component service')
  .option('--endPoint <string>', 'Qyrus endpoint provided by Qyrus admin')
  .option('-u, --username <string>', 'Qyrus admin provided email')
  .option('-p, --passcode <string>', 'Qyrus admin provided passcode in base64 format')
  .option('--teamName <string>', 'Team name you can find by logging into Qyrus app.')
  .option('--projectName <string>', 'Project name you can find by logging into Qyrus app.')
  .option('--variableName <string>', 'Existing variable name eg: Demo')
  .option('--variableType <string>', 'Existing variable type eg: Custom, BaseURL, Password.')
  .option('--variableValue <string>', 'Value to update the existing variable.')
  .option('--envName <string>', 'environment name to which the value needs to be updated. (Optional if its Global)')
  .action((options) => {
    globalVarComponentUtil.trigger(options.endPoint, options.username, options.passcode, 
        options.teamName, options.projectName, options.variableName, 
        options.variableType, options.variableValue, options.envName);
});

program.command('component')
  .description('helps you trigger component tests on the platform')
  .option('--endPoint <string>', 'Qyrus endpoint provided by Qyrus admin')
  .option('-u, --username <string>', 'Qyrus admin provided email')
  .option('-p, --passcode <string>', 'Qyrus admin provided passcode in base64 format')
  .option('--teamName <string>', 'Team name you can find by logging into Qyrus app.')
  .option('--projectName <string>', 'Project name you can find by logging into Qyrus app.')
  .option('--componentWeb <boolean>', 'set it true if you want to run web tests on component eg: true/false')
  .option('--componentMobility <boolean>', 'set it true if you want to run mobility tests on component eg: true/false')
  .option('--appName <string>', '(Optional) Enter android/iOS app name')
  .option('--appPackage <string>', 'Enter android app package which will be in the form of com.android.chrome (Optional, when the appName is defined.)')
  .option('--appActivity <string>', 'Enter android app activity which will be in the form of com.example.splash_screen')
  .option('--devicePoolName <string>', 'Specify your device pool name which you created on Qyrus, a device pool will have list of devices added and a test run will happen on a device from the pool.')
  .option('--deviceName <string>', 'Specify your device name which belongs to a pool')
  .option('--testName <string>', 'Specify your test name created under component tests')
  .option('--bundleId <string>', 'Enter iOS app bundleId which will be in the form of com.example.splash_screen (Optional, during android runs)')
  .option('--browserOS <string>', 'Browser operating system eg: windows/linux')
  .option('--browser <string>', 'Browser name eg: chrome/firefox/MicrosoftEdge?')
  .option('--emailId <string>', '(optional) email id to which the reports need to be sent post execution')
  .option('--envName <string>', 'environment name to run the tests with. (Optional if its Global)')
  .option('--consolidateReports <string>', 'To send reports for multiple steps, Note: emailId is mandatory')
  
  .action((options) => {
    componentUtil.trigger(options.endPoint, options.username, options.passcode,
      options.teamName, options.projectName, options.componentWeb, 
      options.componentMobility, options.browser, options.browserOS,
      options.appName, options.appActivity, options.deviceName, 
      options.devicePoolName, options.testName, options.bundleId,
      options.emailId, options.appPackage, options.envName,
      options.consolidateReports);
});

program.command('upload-app-component')
  .description('helps you upload apps iOS/android to component service')
  .option('--endPoint <string>', 'Qyrus endpoint provided by Qyrus admin')
  .option('-u, --username <string>', 'Qyrus admin provided email')
  .option('-p, --passcode <string>', 'Qyrus admin provided passcode in base64 format')
  .option('--teamName <string>', 'Team name you can find by logging into Qyrus app.')
  .option('--projectName <string>', 'Project name you can find by logging into Qyrus app.')
  .option('--appPath <string>', 'Path to app to be uploaded')
  .option('--file <string>', '(Optional) File path to read configuration to run command' )
  .action((options) => {
    var execCmd = 'component';
    var appType = '';
    appUploadMobilityUtil.trigger(options.endPoint, options.username, options.passcode, 
        options.teamName, options.projectName, options.appPath,appType, execCmd, options.file);
});

program.command('delete-app-component')
  .description('helps you delete apps iOS/android to component service')
  .option('--endPoint <string>', 'Qyrus endpoint provided by Qyrus admin')
  .option('-u, --username <string>', 'Qyrus admin provided email')
  .option('-p, --passcode <string>', 'Qyrus admin provided passcode in base64 format')
  .option('--teamName <string>', 'Team name you can find by logging into Qyrus app.')
  .option('--projectName <string>', 'Project name you can find by logging into Qyrus app.')
  .option('--appName <string>', 'Existing app name eg: Demo.apk/Demo.ipa')
  .option('--file <string>', '(Optional) File path to read configuration to run command' )
  .action((options) => {
    var execCmd = 'component';
    appDeleteUtil.trigger(options.endPoint, options.username, options.passcode, 
        options.teamName, options.projectName, options.appName, execCmd, options.file);
});

program.command('get-apk-count-component')
  .description('helps you to get app count for iOS/android to component service')
  .option('--endPoint <string>', 'Qyrus endpoint provided by Qyrus admin')
  .option('-u, --username <string>', 'Qyrus admin provided email')
  .option('-p, --passcode <string>', 'Qyrus admin provided passcode in base64 format')
  .option('--teamName <string>', 'Team name you can find by logging into Qyrus app.')
  .option('--projectName <string>', 'Project name you can find by logging into Qyrus app.')
  .option('--file <string>', '(Optional) File path to read configuration to run command' )
  .action((options) => {
    appCountMobilityUtil.trigger(options.endPoint, options.username, options.passcode, 
        options.teamName, options.projectName, options.file);
});

program.command('get-apk-component')
  .description('helps you to get uploaded app names from component services for iOS/android to mobility service')
  .option('--endPoint <string>', 'Qyrus endpoint provided by Qyrus admin')
  .option('-u, --username <string>', 'Qyrus admin provided email')
  .option('--teamName <string>', 'Team name you can find by logging into Qyrus app.')
  .option('--projectName <string>', 'Project name you can find by logging into Qyrus app.')
  .action((options) => {
    apkComponentUtil.trigger(options.endPoint, options.username, options.teamName, options.projectName);
});
// Rover Commands
program.command('rover')
  .description('helps you trigger mobility tests on the platform')
  .option('--endPoint <string>', 'Qyrus endpoint provided by Qyrus admin')
  .option('-u, --username <string>', 'Qyrus admin provided email')
  .option('-p, --passcode <string>', 'Qyrus admin provided passcode in base64 format')
  .option('--teamName <string>', 'Team name you can find by logging into Qyrus app.')
  .option('--projectName <string>', 'Project name you can find by logging into Qyrus app.')
  .option('--appName <string>', 'Specify your android app name.')
  .option('--deviceId <string>', 'Specify your device Id which you created on Qyrus.')
  .option('--deviceName <string>', 'Specify your device name which you created on Qyrus.')
  .option('--dataListId <string>', 'Specify the data list Id.')
  .option('--explorationName <string>', 'Enter the exploration name which you are going to create.')
  .option('--enableDebug <string>', 'Prints additional debug information if this option is enabled. eg: yes/no')
  .action((options) => {
    roverUtil.trigger(options.endPoint, options.username, options.passcode,
      options.teamName, options.projectName, options.appName, options.deviceId, options.deviceName, options.dataListId, options.explorationName,options.enableDebug
    );
});

program.command('upload-app-rover')
  .description('helps you upload apps iOS/android to component service')
  .option('--endPoint <string>', 'Qyrus endpoint provided by Qyrus admin')
  .option('-u, --username <string>', 'Qyrus admin provided email')
  .option('-p, --passcode <string>', 'Qyrus admin provided passcode in base64 format')
  .option('--teamName <string>', 'Team name you can find by logging into Qyrus app.')
  .option('--projectName <string>', 'Project name you can find by logging into Qyrus app.')
  .option('--appPath <string>', 'Specify the app path.')
  .option('--appType <string>', 'Specify the app type.')
  .option('--file <string>', '(Optional) File path to read configuration to run command' )
  .action((options) => {
    var execCmd = 'rover';
    appUploadMobilityUtil.trigger(options.endPoint, options.username, options.passcode, 
        options.teamName, options.projectName, options.appPath, options.appType,execCmd, options.file);
});

program.command('delete-app-rover')
  .description('helps you delete apps iOS/android to component service')
  .option('--endPoint <string>', 'Qyrus endpoint provided by Qyrus admin')
  .option('-u, --username <string>', 'Qyrus admin provided email')
  .option('-p, --passcode <string>', 'Qyrus admin provided passcode in base64 format')
  .option('--teamName <string>', 'Team name you can find by logging into Qyrus app.')
  .option('--projectName <string>', 'Project name you can find by logging into Qyrus app.')
  .option('--appName <string>', 'Existing app name eg: Demo.apk/Demo.ipa')
  .option('--file <string>', '(Optional) File path to read configuration to run command' )
  .action((options) => {
    var execCmd = 'rover';
    appDeleteUtil.trigger(options.endPoint, options.username, options.passcode, 
        options.teamName, options.projectName, options.appName,execCmd, options.file);
});
//ApiFunctional Commands
program.command('apiFunctional')
  .description('helps you trigger apiFunctional tests on the platform')
  .option('--endPoint <string>', 'Qyrus endpoint provided by Qyrus admin')
  .option('-u, --username <string>', 'Qyrus admin provided email')
  .option('-p, --passcode <string>', 'Qyrus admin provided passcode in base64 format')
  .option('--teamName <string>', 'Team name you can find by logging into Qyrus app.')
  .option('--projectName <string>', 'Project name you can find by logging into Qyrus app.')
  .option('--testSuiteName <string>', 'Specify your SuiteName name.')
  .option('--testScriptName <string>', 'Specify your testScript name.')
  .option('--emailId <string>', '(optional) email id to which the reports need to be sent post execution')
  .option('--enableDebug <string>', 'Prints additional debug information if this option is enabled. eg: yes/no')
  .action((options) => {
    apiFunctionalUtil.trigger(options.endPoint, options.username, options.passcode,
      options.teamName, options.projectName, options.testSuiteName, options.testScriptName,options.emailId, options.enableDebug
    );
});

//ApiProcess Commands
program.command('apiProcess')
  .description('helps you trigger apiFunctional tests on the platform')
  .option('--endPoint <string>', 'Qyrus endpoint provided by Qyrus admin')
  .option('-u, --username <string>', 'Qyrus admin provided email')
  .option('-p, --passcode <string>', 'Qyrus admin provided passcode in base64 format')
  .option('--teamName <string>', 'Team name you can find by logging into Qyrus app.')
  .option('--projectName <string>', 'Project name you can find by logging into Qyrus app.')
  .option('--testSuiteName <string>', 'Specify your SuiteName name.')
  .option('--testScriptName <string>', 'Specify your testScript name.')
  .option('--emailId <string>', '(optional) email id to which the reports need to be sent post execution')
  .option('--enableDebug <string>', 'Prints additional debug information if this option is enabled. eg: yes/no')
  .action((options) => {
    apiProcessUtil.trigger(options.endPoint, options.username, options.passcode,
      options.teamName, options.projectName, options.testSuiteName, options.testScriptName,options.emailId, options.enableDebug
    );
});

//ApiPerformance Commands
program.command('apiPerformance')
  .description('helps you trigger apiFunctional tests on the platform')
  .option('--endPoint <string>', 'Qyrus endpoint provided by Qyrus admin')
  .option('-u, --username <string>', 'Qyrus admin provided email')
  .option('-p, --passcode <string>', 'Qyrus admin provided passcode in base64 format')
  .option('--teamName <string>', 'Team name you can find by logging into Qyrus app.')
  .option('--projectName <string>', 'Project name you can find by logging into Qyrus app.')
  .option('--testSuiteName <string>', 'Specify your SuiteName name.')
  .option('--testScriptName <string>', 'Specify your testScript name.')
  .option('--thread <long>', 'Specify your thread.')
  .option('--latencyThreshold <long>', 'Specify your latencyThreshold value.')
  .option('--emailId <string>', '(optional) email id to which the reports need to be sent post execution')
  .option('--enableDebug <string>', 'Prints additional debug information if this option is enabled. eg: yes/no')
  .action((options) => {
    apiPerformanceUtil.trigger(options.endPoint, options.username, options.passcode,
      options.teamName, options.projectName, options.testSuiteName, options.testScriptName, options.thread, options.latencyThreshold,options.emailId, options.enableDebug
    );
});

//--- Connectivity check
program.command('conn-check')
  .description('helps you to check the connectivity with Qyrus platform.')
  .option('--endPoint <string>', 'Qyrus endpoint provided by Qyrus admin')
  .action((options) => {
    connCheck.trigger(options.endPoint);
});

program.parse();
