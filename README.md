# @dot-build/serve-and-run-angular

Serve your Angular project, then run a command.

## Why?

You want to run a command or test suite after the app is ready. The app takes some time to be ready. The Angular CLI has built-in features to streamline the execution of targets.

Usually, you start your server and run a11y or e2e scenarios on a CI environment.

This builder allows you to run any command after serve, so you don't need a new module for each and every tool you want to use.

## Usage

Install the module as a dev dependency:

```sh
npm i -D @dot-build/serve-and-run-angular
```

Then add it to your `angular.json` as a build.

For example, to run `npm run e2e_ci` after the development server is ready:

```json
// e2e setup in angular.json
{
  "$schema": "./node_modules/@angular/cli/lib/config/schema.json",
  "version": 1,
  "newProjectRoot": "projects",
  "projects": {
    "your-application": {
      "projectType": "application",
      "root": "",
      "sourceRoot": "src",
      "prefix": "app",
      "architect": {
        "serve": {
          "builder": "@angular-devkit/build-angular:dev-server",
          "options": {
            "browserTarget": "your-application:build"
          }
        },
        "e2e": {
          "builder": "@dot-build/serve-and-run-angular:run",
          "options": {
            "devServerTarget": "your-application:serve",
            "command": "npm",
            "args": ["run", "e2e_ci"]
          }
        },
        "build": {
          // ...
        }
      }
    }
  }
}
```

## Options

From `angular.json`, the following can be adjusted:

```json
// the target to serve
"devServerTarget": "your-application:serve",

// name of a command to execute
"command": "npm",

// arguments passed to that command
"args": ["run", "e2e_ci"]
```

From a command-line you can also use the `--watch` option to continuouly run the command after files change. Looking at the previous example, if your angular configuration has a target `e2e` for your tests, and you want to run them over and over, you can do:

```sh
ng run your-application:e2e --watch

```
