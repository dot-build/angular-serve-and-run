import {
  BuilderContext,
  BuilderOutput,
  createBuilder,
  scheduleTargetAndForget,
  targetFromTargetString,
} from '@angular-devkit/architect';
import { asWindowsPath, normalize } from '@angular-devkit/core';
import { platform } from 'os';
import { BehaviorSubject, from, noop, Observable, of, Subject, throwError } from 'rxjs';
import { catchError, concatMap, filter, first, map, switchMap, tap } from 'rxjs/operators';
import { spawn as sh } from 'child_process';

export interface UserOptions {
  devServerTarget?: string;
  command: string;
  args?: string[];
  watch?: boolean;
}

export interface RunnerOptions {
  devServerTarget: string;
  workspace: string;
  command: string;
  args: string[];
  watch: boolean;
}

function builderFactory(userOptions: UserOptions, context: BuilderContext): Observable<BuilderOutput> {
  const projectName = (context.target && context.target.project) || '';
  const workspace = from(context.getProjectMetadata(projectName));

  return workspace.pipe(
    map(() => getRunnerOptions(context, userOptions)),
    tap((options) => context.logger.info(`Running with command: ${options.command} ${options.args.join(' ')}`)),
    switchMap((runnerOptions) => {
      const server: Observable<BuilderOutput> = runnerOptions.devServerTarget
        ? startDevServerTarget(runnerOptions.devServerTarget, runnerOptions.watch, context).pipe(
            runnerOptions.watch ? tap(noop) : first(),
          )
        : of({ success: true });

      return server.pipe(
        switchMap(() => runCommand(context, runnerOptions)),
        catchError((error) => onError(context, error)),
      );
    }),
  );
}

function getRunnerOptions(context: BuilderContext, options: UserOptions): RunnerOptions {
  const isWindows = platform() === 'win32';
  const workspace = !isWindows ? normalize(context.workspaceRoot) : asWindowsPath(normalize(context.workspaceRoot));

  return {
    ...options,
    workspace,
    args: options.args || [],
    watch: !!options.watch,
    devServerTarget: options.devServerTarget || '',
  };
}

function startDevServerTarget(
  devServerTarget: string,
  watch: boolean,
  context: BuilderContext,
): Observable<BuilderOutput> {
  const serveOptions = { watch };
  const server = scheduleTargetAndForget(context, targetFromTargetString(devServerTarget), serveOptions);

  return server.pipe(
    map((output) => {
      if (!output.success && !watch) {
        throw new Error('Failed to run the dev server!');
      }

      return { success: output.success };
    }),
  );
}

function runCommand(context: BuilderContext, options: RunnerOptions): Observable<BuilderOutput> {
  const result = new BehaviorSubject<BuilderOutput>({ success: true });

  try {
    const shell = sh(options.command, options.args, {
      shell: true,
      detached: true,
      cwd: options.workspace,
    });

    const onData = (data: string) => process.stdout.write(String(data || ''));
    shell.stdout.on('data', onData);
    shell.stderr.on('data', onData);
    shell.on('error', (error) => onError(context, error));
    shell.on('exit', (code) => {
      if (code) {
        onError(context, new Error('Command exited with code: ' + code));
      }

      if (!options.watch) {
        result.complete();
      }
    });
    result.next({ success: true });
  } catch (error) {
    result.next({ success: false, error: error.message });
  }

  return result;
}

function onError(context: BuilderContext, error: Error): Observable<BuilderOutput> {
  return of({ success: false }).pipe(
    tap(() => context.reportStatus(`Error: ${error.message}`)),
    tap(() => context.logger.error(String(error.message))),
  );
}

export default createBuilder<UserOptions>(builderFactory);
