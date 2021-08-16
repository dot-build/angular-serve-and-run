# serve-and-run-angular

Serve your Angular project, then run a command.

## Why?

You want to run a command or test suite after the app is ready.
The app takes some time to be ready.
The Angular CLI has built-in features to streamline the execution of targets.
Usually, you start your server and run a11y or e2e scenarios on a CI environment.

This builder allows you to run any command after serve, so you don't need a new module for each and every tool you want to use.

## Usage

Example: run `npm run e2e_ci` after the local development server is ready:

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
          "builder": "serve-and-run-angular:run",
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