import {
  BuilderContext,
  BuilderOutput,
  createBuilder,
  scheduleTargetAndForget,
  targetFromTargetString,
} from '@angular-devkit/architect';
import { asWindowsPath, normalize } from '@angular-devkit/core';
import * as os from 'os';
import { dirname } from 'path';
import { from, noop, Observable, of, throwError } from 'rxjs';
import { catchError, concatMap, first, map, switchMap, tap } from 'rxjs/operators';
import { spawnSync as sh } from 'child_process';

export interface RunnerOptions {
  devServerTarget?: string;
  command: string;
  args?: string[];
  workspace: string;
  baseUrl?: string;
  watch?: boolean;
}

function builderFactory(options: RunnerOptions, context: BuilderContext): Observable<BuilderOutput> {
  const projectName = (context.target && context.target.project) || '';
  const workspace = context.getProjectMetadata(projectName);

  return from(workspace).pipe(
    map(() => os.platform() === 'win32'),
    map((isWindows) =>
      !isWindows ? normalize(context.workspaceRoot) : asWindowsPath(normalize(context.workspaceRoot)),
    ),
    map((workspace) => {
      return {
        ...options,
        workspace: workspace,
        args: options.args || [],
      };
    }),
    switchMap((options: RunnerOptions) => {
      return (
        options.devServerTarget ? startDevServerTarget(options.devServerTarget, !!options.watch, context) : of({})
      ).pipe(
        tap(() => context.logger.info(`Running command after changes: ${options.command} ${options.args?.join(' ')}`)),
        concatMap(() => runCommand(context, options)),
        options.watch ? tap(noop) : first(),
        catchError(onError(context)),
      );
    }),
  );
}

export function startDevServerTarget(devServerTarget: string, watch: boolean, context: any): Observable<any> {
  const serveOptions = { watch };

  return of(scheduleTargetAndForget(context, targetFromTargetString(devServerTarget), serveOptions)).pipe(
    map((output: any) => {
      if (!output.success && !watch) {
        throw new Error('Failed to run the dev server!');
      }

      return output;
    }),
  );
}

function runCommand(context: any, options: RunnerOptions): Observable<BuilderOutput> {
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
    tap((output) => context.logger.info(output)),
    map(() => ({ success: true })),
    catchError(onError(context)),
  );
}

function onError(context: any) {
  return (error: any) =>
    of({ success: false, error }).pipe(
      tap(() => context.reportStatus(`Error: ${error.message}`)),
      tap(() => context.logger.error(error.message)),
    );
}

export default createBuilder<RunnerOptions>(builderFactory);
