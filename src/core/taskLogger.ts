/**
 * TaskLogger (Requirements 3, 10.2).
 *
 * Validates and persists task entries; supports edit and delete. Empty or
 * whitespace-only descriptions are rejected with a ValidationError and nothing
 * is persisted. Persistence is delegated to an injectable sink so the same
 * logic works against SQLite or an in-memory store (for tests).
 */

import { TaskLogger } from '../shared/interfaces';
import {
  err,
  ok,
  Result,
  TaskEntry,
  validationError,
  ValidationError,
} from '../shared/types';

/** True when a description has at least one non-whitespace character. */
export function isValidDescription(description: string): boolean {
  return description.trim().length > 0;
}

/** Side-effect hooks so the logger can write through to a Repository. */
export interface TaskSink {
  onSave?(task: TaskEntry): void;
  onUpdate?(id: string, description: string): void;
  onDelete?(id: string): void;
}

let taskCounter = 0;
function defaultIdFactory(): string {
  taskCounter += 1;
  return `task-${Date.now().toString(36)}-${taskCounter.toString(36)}`;
}

export class InMemoryTaskLogger implements TaskLogger {
  private tasks: TaskEntry[] = [];

  constructor(
    private readonly sink: TaskSink = {},
    private readonly idFactory: () => string = defaultIdFactory,
    initial: TaskEntry[] = []
  ) {
    this.tasks = [...initial];
  }

  add(description: string, now: Date): Result<TaskEntry, ValidationError> {
    if (!isValidDescription(description)) {
      return err(validationError('Task description cannot be empty.'));
    }
    const task: TaskEntry = {
      id: this.idFactory(),
      description,
      timestamp: now.toISOString(),
    };
    this.tasks.push(task);
    this.sink.onSave?.(task);
    return ok(task);
  }

  edit(id: string, description: string): Result<TaskEntry, ValidationError> {
    if (!isValidDescription(description)) {
      return err(validationError('Task description cannot be empty.'));
    }
    const task = this.tasks.find((t) => t.id === id);
    if (!task) {
      return err(validationError(`No task with id ${id}.`));
    }
    task.description = description;
    this.sink.onUpdate?.(id, description);
    return ok({ ...task });
  }

  delete(id: string): void {
    this.tasks = this.tasks.filter((t) => t.id !== id);
    this.sink.onDelete?.(id);
  }

  list(): TaskEntry[] {
    return this.tasks.map((t) => ({ ...t }));
  }
}
