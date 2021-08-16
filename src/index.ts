import {
  BuilderContext,
  BuilderOutput,
  createBuilder,
  scheduleTargetAndForget,
  targetFromTargetString,
} from '@angular-devkit/architect';
import { asWindowsPath, normalize } from '@angular-devkit/core';
import * as os from 'os';
import { from, noop, Observable, of, throwError } from 'rxjs';
import { catchError, concatMap, first, map, switchMap, tap } from 'rxjs/operators';
import { spawnSync as sh } from 'child_process';

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
  const workspace = context.getProjectMetadata(projectName);

  return from(workspace).pipe(
    switchMap(() => getRunnerOptions(context, userOptions)),
    switchMap((runnerOptions) => {
      const target: Observable<BuilderOutput> = runnerOptions.devServerTarget
        ? startDevServerTarget(runnerOptions.devServerTarget, !!runnerOptions.watch, context)
        : of({ success: true });

      return target.pipe(
        tap(() =>
          context.logger.info(
            `Running command after changes: ${runnerOptions.command} ${runnerOptions.args.join(' ')}`,
          ),
        ),
        concatMap(() => runCommand(context, runnerOptions)),
        runnerOptions.watch ? tap(noop) : first(),
        catchError(onError(context)),
      );
    }),
  );
}

function getRunnerOptions(context: BuilderContext, options: UserOptions): Observable<RunnerOptions> {
  return of(os.platform() === 'win32').pipe(
    map((win32) => (!win32 ? normalize(context.workspaceRoot) : asWindowsPath(normalize(context.workspaceRoot)))),
    map(
      (workspace) =>
        ({
          ...options,
          workspace,
          args: options.args || [],
          watch: !!options.watch,
          devServerTarget: options.devServerTarget || '',
        } as RunnerOptions),
    ),
  );
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

      return output;
    }),
  );
}

function runCommand(context: BuilderContext, options: RunnerOptions): Observable<BuilderOutput> {
  let result: Observable<string>;

  try {
    result = of(
      sh(options.command, options.args, {
        encoding: 'utf-8',
        shell: true,
        stdio: 'pipe',
        cwd: options.workspace,
      }).output.join('\n'),
    );
  } catch (error) {
    result = throwError(() => error);
  }

  return result.pipe(
    tap((output) => context.logger.info(String(output))),
    map(() => ({ success: true })),
    catchError(onError(context)),
  );
}

function onError(context: BuilderContext) {
  return (error: Error) =>
    of({ success: false, error: String(error.message || error) }).pipe(
      tap(() => context.reportStatus(`Error: ${error.message}`)),
      tap(() => context.logger.error(error.message)),
    );
}

export default createBuilder<UserOptions>(builderFactory);
