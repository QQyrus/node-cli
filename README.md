# node-cli
This repository contains code for the command line application which helps to trigger tests, and to perform dynamic updates on the variables, apps.

Qyrus is a end to end testing platform designed to test Web, Mobile and APIs for all digital enterprises. With its codeless approach to testing Web, Mobile & APIs, Qyrus is the fastest way to start the journey of automated testing for your enterprise.

## Getting Started

These instructions will cover usage information for the command line utility.

### Supported Operating Systems
* Windows - 64 and 32 Bit.
* Ubuntu - 18.04 and above.
* Linux.
* MacOS - x86 and M1 arch.

### Usage

```shell
Usage: qyrus-cli [options] [command]

Helps you to manage variables, apps and to run tests on Qyrus platform

Options:
  -V, --version                         output the version number
  -h, --help                            display help for command

Commands:
  web [options]                         helps you trigger web tests on the platform
  update-web-variables [options]        helps you update global variables on web automation service
  mobility [options]                    helps you trigger mobility tests on the platform
  update-mobility-variables [options]   helps you update global variables on mobility service
  upload-app-mobility [options]         helps you upload apps iOS/android to mobility service
  update-component-variables [options]  helps you update global variables on component service
  component [options]                   helps you trigger component tests on the platform
  upload-app-component [options]        helps you upload apps iOS/android to component service
  help [command]                        display help for command
```

```shell
./index.cjs help web
Usage: qyrus-cli web [options]

helps you trigger web tests on the platform

Options:
  --endPoint <string>          Qyrus endpoint provided by Qyrus admin
  -u, --username <string>      Qyrus admin provided email
  -p, --passcode <string>      Qyrus admin provided passcode in base64 format
  --teamName <string>          Team name you can find by logging into Qyrus app.
  --projectName <string>       Project name you can find by logging into Qyrus app.
  --suiteName <string>         Test suite name you can find by logging into Qyrus app.
  --variableEnvName <string>   (optional) Global variable name you can find by logging into Qyrus app.
  --browserOS <string>         Browser operating system eg: windows/linux
  --browser <string>           Browser name eg: chrome/firefox/MicrosoftEdge?
  --onErrorContinue <boolean>  Continue execution on error?
  --emailId <string>           (optional) email id to which the reports need to be sent post execution
  -h, --help                   display help for command
```

```shell
./index.cjs help update-web-variables
Usage: qyrus-cli update-web-variables [options]

helps you update global variables on web automation service

Options:
  --endPoint <string>         Qyrus endpoint provided by Qyrus admin
  -u, --username <string>     Qyrus admin provided email
  -p, --passcode <string>     Qyrus admin provided passcode in base64 format
  --teamName <string>         Team name you can find by logging into Qyrus app.
  --projectName <string>      Project name you can find by logging into Qyrus app.
  --variableEnvName <string>  Variables environment name, you can find by logging into Qyrus app.
  --variableName <string>     Existing variable name eg: Demo
  --variableType <string>     Existing variable type eg: Custom, BaseURL, Password.
  --variableValue <string>    Value to update the existing variable.
  -h, --help                  display help for command
```

```shell
./index.cjs help mobility
Usage: qyrus-cli mobility [options]

helps you trigger mobility tests on the platform

Options:
  --endPoint <string>        Qyrus endpoint provided by Qyrus admin
  -u, --username <string>    Qyrus admin provided email
  -p, --passcode <string>    Qyrus admin provided passcode in base64 format
  --teamName <string>        Team name you can find by logging into Qyrus app.
  --projectName <string>     Project name you can find by logging into Qyrus app.
  --suiteName <string>       Test suite name you can find by logging into Qyrus app.
  --appName <string>         Enter android/iOS app name
  --appActivity <string>     Enter android app activity which will be in the form of
                             com.example.splash_screen
  --devicePoolName <string>  Specify your device pool name which you created on Qyrus, a device pool will
                             have list of devices added and a test run will happen on a device from the
                             pool.
  --enableDebug <string>     Prints additional debug information if this option is enabled. ex: yes/no
  --bundleId <string>        Enter iOS app bundleId which will be in the form of com.example.splash_screen
                             (Optional, during android runs)
  --emailId <string>         (Optional) email id to which the reports need to be sent post execution
  --envName <string>         environment name to run the tests with. (Optional if its Global)
  --firstAvailableDevice <string> use first available device. ex: yes/no
  --file <string>            (Optional) File path to read configuration to run command
  -h, --help                 display help for command
```

```shell
./index.cjs help update-mobility-variables
Usage: qyrus-cli update-mobility-variables [options]

helps you update global variables on mobility service

Options:
  --endPoint <string>       Qyrus endpoint provided by Qyrus admin
  -u, --username <string>   Qyrus admin provided email
  -p, --passcode <string>   Qyrus admin provided passcode in base64 format
  --teamName <string>       Team name you can find by logging into Qyrus app.
  --projectName <string>    Project name you can find by logging into Qyrus app.
  --variableName <string>   Existing variable name eg: Demo
  --variableType <string>   Existing variable type eg: Custom, BaseURL, Password.
  --variableValue <string>  Value to update the existing variable.
  --envName <string>        environment name to which the value needs to be updated. (Optional if its Global)
  --file <string>           (Optional) File path to read configuration to run command
  -h, --help                display help for command
```

```shell
./index.cjs help upload-app-mobility
Usage: qyrus-cli upload-app-mobility [options]

helps you upload apps iOS/android to mobility service

Options:
  --endPoint <string>      Qyrus endpoint provided by Qyrus admin
  -u, --username <string>  Qyrus admin provided email
  -p, --passcode <string>  Qyrus admin provided passcode in base64 format
  --teamName <string>      Team name you can find by logging into Qyrus app.
  --projectName <string>   Project name you can find by logging into Qyrus app.
  --appPath <string>'      Path to app to be uploaded
  --file <string>          (Optional) File path to read configuration to run command
  -h, --help               display help for command
```

```shell
./index.cjs help delete-app-mobility
Usage: qyrus-cli delete-app-mobility [options]

helps you delete apps iOS/android to mobility service

Options:
  --endPoint <string>      Qyrus endpoint provided by Qyrus admin
  -u, --username <string>  Qyrus admin provided email
  -p, --passcode <string>  Qyrus admin provided passcode in base64 format
  --teamName <string>      Team name you can find by logging into Qyrus app.
  --projectName <string>   Project name you can find by logging into Qyrus app.
  --appName <string>'      Existing app name eg: Demo.apk/Demo.ipa
  --file <string>          (Optional) File path to read configuration to run command
  -h, --help               display help for command
```

```shell
./index.cjs help get-apk-count-mobility
Usage: qyrus-cli get-apk-count-mobility [options]

helps you to get app count for iOS/android to mobility service

Options:
  --endPoint <string>      Qyrus endpoint provided by Qyrus admin
  -u, --username <string>  Qyrus admin provided email
  -p, --passcode <string>  Qyrus admin provided passcode in base64 format
  --teamName <string>      Team name you can find by logging into Qyrus app.
  --projectName <string>   Project name you can find by logging into Qyrus app.
  --file <string>          (Optional) File path to read configuration to run command
  -h, --help               display help for command
```

```shell
./index.cjs help get-apk-mobility
Usage: qyrus-cli get-apk-mobility [options]

helps you to get uploaded apps from mobility service for iOS/Android project

Options:
  --endPoint <string>      Qyrus endpoint provided by Qyrus admin
  --teamName <string>      Team name you can find by logging into Qyrus app.
  --projectName <string>   Project name you can find by logging into Qyrus app.
  --file <string>          (Optional) File path to read configuration to run command
  -h, --help               display help for command
```

```shell
./index.cjs help import-mobility-script-from-file
Usage: qyrus-cli import-mobility-script-from-file [options]

imports script using file data into mobility service

Options:
  --endPoint <string>      Qyrus endpoint provided by Qyrus admin
  -u, --username <string>  Qyrus admin provided email
  -p, --passcode <string>  Qyrus admin provided passcode in base64 format
  --teamName <string>      Team name you can find by logging into Qyrus app.
  --projectName <string>   Project name you can find by logging into Qyrus app.
  --suiteName <string>     Test suite name you can find by logging into Qyrus app.
  --scriptFile <string>    File path to import script data
  --file <string>          (Optional) File path to read configuration to run command
  -h, --help               display help for command
```

```shell
./index.cjs help update-mobility-script-from-file
Usage: qyrus-cli update-mobility-script-from-file [options]

updates script steps using file data in mobility service

Options:
  --endPoint <string>      Qyrus endpoint provided by Qyrus admin
  -u, --username <string>  Qyrus admin provided email
  -p, --passcode <string>  Qyrus admin provided passcode in base64 format
  --teamName <string>      Team name you can find by logging into Qyrus app.
  --projectName <string>   Project name you can find by logging into Qyrus app.
  --suiteName <string>     Test suite name you can find by logging into Qyrus app.
  --scriptFile <string>    File path to update script data
  --file <string>          (Optional) File path to read configuration to run command
  -h, --help               display help for command
```

```shell
./index.cjs help update-component-variables
Usage: qyrus-cli update-component-variables [options]

helps you update global variables on component service

Options:
  --endPoint <string>       Qyrus endpoint provided by Qyrus admin
  -u, --username <string>   Qyrus admin provided email
  -p, --passcode <string>   Qyrus admin provided passcode in base64 format
  --teamName <string>       Team name you can find by logging into Qyrus app.
  --projectName <string>    Project name you can find by logging into Qyrus app.
  --variableName <string>   Existing variable name eg: Demo
  --variableType <string>   Existing variable type eg: Custom, BaseURL, Password.
  --variableValue <string>  Value to update the existing variable.
  -h, --help                display help for command
```

```shell
./index.cjs help component
Usage: qyrus-cli component [options]

helps you trigger component tests on the platform

Options:
  --endPoint <string>            Qyrus endpoint provided by Qyrus admin
  -u, --username <string>        Qyrus admin provided email
  -p, --passcode <string>        Qyrus admin provided passcode in base64 format
  --teamName <string>            Team name you can find by logging into Qyrus app.
  --projectName <string>         Project name you can find by logging into Qyrus app.
  --componentWeb <boolean>       set it true if you want to run web tests on component eg: true/false
  --componentMobility <boolean>  set it true if you want to run mobility tests on component eg: true/false
  --appName <string>             Enter android/iOS app name
  --appActivity <string>         Enter android app activity which will be in the form of
                                 com.example.splash_screen
  --devicePoolName <string>      Specify your device pool name which you created on Qyrus, a device pool
                                 will have list of devices added and a test run will happen on a device
                                 from the pool.
  --deviceName <string>          Specify your device name which belongs to a pool
  --testName <string>            Specify your test name created under component tests
  --bundleId <string>            Enter iOS app bundleId which will be in the form of
                                 com.example.splash_screen (Optional, during android runs)
  --browserOS <string>           Browser operating system eg: windows/linux
  --browser <string>             Browser name eg: chrome/firefox/MicrosoftEdge?
  --emailId <string>             (optional) email id to which the reports need to be sent post execution
  -h, --help                     display help for command
```

```shell
./index.cjs help rover
Usage: qyrus-cli rover [options]

helps you trigger rover tests on the platform

Options:
  --endPoint <string>            Qyrus endpoint provided by Qyrus admin
  -u, --username <string>        Qyrus admin provided email
  -p, --passcode <string>        Qyrus admin provided passcode in base64 format
  --teamName <string>            Team name you can find by logging into Qyrus app.
  --projectName <string>         Project name you can find by logging into Qyrus app.
  --appName <string>             Enter android app name
  --deviceId <string>            Specify your device Id which belongs to a pool
  --deviceName <string>          Specify your device name which belongs to a pool
  --dataListId <string>          Specify your dataListId
  --explorationName <string>     Specify your explorationName which you want to create on Qyrus
  -h, --help                     display help for command
```
```shell
  
./index.cjs help apiFunctional trigger
Usage: qyrus-cli apiFunctional trigger [options]

helps you trigger apiFunctional service

Options:
  --endPoint <string>       Qyrus endpoint provided by Qyrus admin
  -u, --username <string>   Qyrus admin provided email
  -p, --passcode <string>   Qyrus admin provided passcode in base64 format
  --teamName <string>       Team name you can find by logging into Qyrus app.
  --projectName <string>    Project name you can find by logging into Qyrus app.
  --testSuiteName <string>   Enter testSuite name created under project
  --testScriptName <string>   Enter testScript Name
  --emailId <string>          (optional) email id to which the reports need to be sent post execution
  -h, --help                display help for command
```
```shell

./index.cjs help apiPerformance trigger
Usage: qyrus-cli apiPerformance trigger [options]

helps you trigger apiPerformance service

Options:
  --endPoint <string>           Qyrus endpoint provided by Qyrus admin
  -u, --username <string>       Qyrus admin provided email
  -p, --passcode <string>       Qyrus admin provided passcode in base64 format
  --teamName <string>           Team name you can find by logging into Qyrus app.
  --projectName <string>        Project name you can find by logging into Qyrus app.
  --testSuiteName <string>      Enter testSuite name created under project
  --testScriptName <string>     Enter testScript Name
  --thread <long>               Enter thread value
  --latencyThreshold <long>     Enter latencyThreshold value 
  --emailId <string>            (optional) email id to which the reports need to be sent post execution
  -h, --help                    display help for command
```
```shell

./index.cjs help apiProcess trigger
Usage: qyrus-cli apiProcess trigger [options]

helps you trigger apiProcess service

Options:
  --endPoint <string>           Qyrus endpoint provided by Qyrus admin
  -u, --username <string>       Qyrus admin provided email
  -p, --passcode <string>       Qyrus admin provided passcode in base64 format
  --teamName <string>           Team name you can find by logging into Qyrus app.
  --projectName <string>        Project name you can find by logging into Qyrus app.
  --testSuiteName <string>      Enter testSuite name created under project
  --testScriptName <string>     Enter testScript Name
  --emailId <string>            (optional) email id to which the reports need to be sent post execution
  -h, --help                    display help for command
```
```shell

```

## Samples
```shell
//To trigger test
// ./index.cjs web --endPoint http://localhost:8087 --username demo@domain.com --passcode ******** --teamName "CTC - STG Common Area" --projectName Test --suiteName Test --browserOS Windows --browser Chrome --onErrorContinue true --emailId saiprasadt@quinnox.com

//To update env variables web
// ./index.cjs update-web-variables --endPoint http://localhost:8087 --username demo@domain.com --passcode ******** --teamName "CTC - STG Common Area" --projectName Test --variableEnvName Test --variableName url --variableType Custom --variableValue PrajwalT

//upload app mobility
// ./index.cjs upload-app-mobility --endPoint http://localhost:8081 --username demo@domain.com --passcode ******** --teamName "CTC - STG Common Area" --projectName TestAndroid --appPath /Users/saiprasadt/Downloads/qyrus_training.apk

//delete app mobility
./index.cjs delete-app-mobility --endPoint http://localhost:8081 --username demo@domain.com --passcode ******** --teamName "Some Team" --projectName "Some Project" --appName qyrus_training.apk

//To update env variables mobility
// ./index.cjs update-mobility-variables --endPoint http://localhost:8081 --username demo@domain.com --passcode ******** --teamName "CTC - STG Common Area" --projectName TestAndroid --variableName URL --variableType BaseURL --variableValue "https://qyrus.com"

// trigger test mobility
// ./index.cjs mobility --endPoint http://localhost:8081 --username demo@domain.com --passcode ******** --teamName "CTC - STG Common Area" --projectName TestAndroid --suiteName Demo --appName qyrus_training.apk --appActivity "com.quinnox.qyrus_training.SplashScreen" --devicePoolName Samsung --enableDebug no --emailId someemail@test.com

//To update env variables component
// ./index.cjs update-component-variables --endPoint http://localhost:8087 --username demo@domain.com --passcode ******** --teamName "CTC - STG Common Area" --projectName CliTest --variableName URL --variableType BaseURL --variableValue "https://qyrus.com"

//delete app component
./index.cjs delete-app-component --endPoint http://localhost:8081 --username demo@domain.com --passcode ******** --teamName "Some Team" --projectName "Some Project" --appName qyrus_training.apk

//trigger test component
// ./index.cjs component --endPoint http://localhost:8087 --username demo@domain.com --passcode ******** --teamName "CTC - STG Common Area" --projectName CliTest --componentWeb true --componentMobility true --appName qyrus_training.apk --appActivity "com.quinnox.qyrus_training.SplashScreen" --devicePoolName samsung --deviceName "Galaxy A32" --testName DemoTest --browser chrome --browserOS windows

//To get Apk Component
// ./index.cjs get-apk-component --endPoint http://localhost:8087 --username "demo@domain.com" --teamName "example" --projectName "example"

//To get Apk mobility
// ./index.cjs get-apk-mobility --endPoint http://localhost:8081 --teamName "test" --projectName "test"

//To get App Count Component
// ./index.cjs get-apk-count-component --endPoint http://localhost:8087 --username "demo@domain.com" --passcode "*******" --teamName "test" --projectName "test"

//To get App Count Mobility
// ./index.cjs get-apk-count-mobility --endPoint http://localhost:8081 --username "demo@domain.com" --passcode "******" --teamName "test" --projectName "Test"

//trigger test Rover
// ./index.cjs rover --endPoint http://localhost:8097 --username "demo@domain.com" --passcode "*********" --teamName "test" --projectName "test" --appName "test.apk" --deviceId "985b208e" --deviceName "Oneplus 9 5G" --dataListId " " --explorationName "Example apps222"

//trigger test apiFunctional
//./index.cjs apiFunctional --endPoint http://localhost:8094 --username "bhavanar@quinnox.com" --passcode "******" --teamName "Qyrus Walkthrough - New" --projectName "Test" --testSuiteName "test" --testScriptName "get all teams"--emailId "bhavanar@quinnox.com" --enableDebug yes                          

//trigger test apiPerformance
//./index.cjs apiPerformance --endPoint http://localhost:8095 --username "bhavanar@quinnox.com" --passcode "*******" --teamName "Qyrus Walkthrough - New" --projectName "test" --testSuiteName "test" --testScriptName "Get a example product"--thread 1 --latencyThreshold 1 --emailId "bhavanar@quinnox.com " --enableDebug yes

//trigger test apiProcess
//./index.cjs apiProcess --endPoint http://localhost:8096 --username "bhavanar@quinnox.com" --passcode "********" --teamName "Qyrus Walkthrough - New" --projectName "test" --testSuiteName "jh" --testScriptName "_example_user_login"--emailId "bhavanar@quinnox.com " --enableDebug yes
```

## To install binary by using the script
```shell
For macOS:
curl -s https://raw.githubusercontent.com/QQyrus/node-cli/master/scripts/install_mac.sh | bash -s v1.0.1

To operate with the command on macOS:
qyrus-cli help

For Linux:
curl -s https://raw.githubusercontent.com/QQyrus/node-cli/master/scripts/install_linux.sh | bash -s v1.0.1

To operate with the command on linux:
/tmp/qyrus-cli help
```

## Contact Us
support@qyrus.com