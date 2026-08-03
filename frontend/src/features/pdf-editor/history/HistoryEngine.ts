// ============================================================
// CompressKro PDF Editor — History Engine (Command Pattern)
// ============================================================
// Delta-based undo/redo system. Each command stores only the
// minimal diff needed to reverse/replay the operation.
// This fixes the memory leak from storing full state snapshots.
// ============================================================

import type { EditorObject, Bounds } from '../core/types';
import { MAX_HISTORY_DEPTH } from '../core/constants';

// ---- Command Interface ----

/**
 * A reversible editing command.
 * Every command can be executed (do) and reversed (undo).
 * Commands store only the delta — not a full state snapshot.
 */
export interface Command {
  /** Human-readable description for debugging. */
  readonly description: string;
  /** Execute or re-execute this command. */
  execute(objects: Map<string, EditorObject>): Map<string, EditorObject>;
  /** Reverse this command. */
  undo(objects: Map<string, EditorObject>): Map<string, EditorObject>;
}

// ---- Concrete Commands ----

/** Insert one or more objects. */
export class InsertObjectsCommand implements Command {
  readonly description: string;
  private readonly objects: EditorObject[];

  constructor(objects: EditorObject[]) {
    this.objects = objects;
    this.description = `Insert ${objects.length} object(s)`;
  }

  execute(map: Map<string, EditorObject>): Map<string, EditorObject> {
    const next = new Map(map);
    for (const obj of this.objects) {
      next.set(obj.id, obj);
    }
    return next;
  }

  undo(map: Map<string, EditorObject>): Map<string, EditorObject> {
    const next = new Map(map);
    for (const obj of this.objects) {
      next.delete(obj.id);
    }
    return next;
  }
}

/** Delete one or more objects. */
export class DeleteObjectsCommand implements Command {
  readonly description: string;
  private readonly snapshots: EditorObject[];

  constructor(objects: EditorObject[]) {
    // Store snapshots of the deleted objects so we can restore them
    this.snapshots = objects.map((o) => ({ ...o }));
    this.description = `Delete ${objects.length} object(s)`;
  }

  execute(map: Map<string, EditorObject>): Map<string, EditorObject> {
    const next = new Map(map);
    for (const obj of this.snapshots) {
      next.delete(obj.id);
    }
    return next;
  }

  undo(map: Map<string, EditorObject>): Map<string, EditorObject> {
    const next = new Map(map);
    for (const obj of this.snapshots) {
      next.set(obj.id, obj);
    }
    return next;
  }
}

/** Move one or more objects (change bounds position). */
export class MoveObjectsCommand implements Command {
  readonly description: string;
  private readonly moves: Array<{
    id: string;
    oldBounds: Bounds;
    newBounds: Bounds;
  }>;

  constructor(
    moves: Array<{ id: string; oldBounds: Bounds; newBounds: Bounds }>
  ) {
    this.moves = moves;
    this.description = `Move ${moves.length} object(s)`;
  }

  execute(map: Map<string, EditorObject>): Map<string, EditorObject> {
    const next = new Map(map);
    for (const move of this.moves) {
      const obj = next.get(move.id);
      if (obj) {
        next.set(move.id, { ...obj, bounds: { ...move.newBounds } } as EditorObject);
      }
    }
    return next;
  }

  undo(map: Map<string, EditorObject>): Map<string, EditorObject> {
    const next = new Map(map);
    for (const move of this.moves) {
      const obj = next.get(move.id);
      if (obj) {
        next.set(move.id, { ...obj, bounds: { ...move.oldBounds } } as EditorObject);
      }
    }
    return next;
  }
}

/** Resize an object (change bounds). */
export class ResizeObjectCommand implements Command {
  readonly description = 'Resize object';
  private readonly id: string;
  private readonly oldBounds: Bounds;
  private readonly newBounds: Bounds;

  constructor(id: string, oldBounds: Bounds, newBounds: Bounds) {
    this.id = id;
    this.oldBounds = { ...oldBounds };
    this.newBounds = { ...newBounds };
  }

  execute(map: Map<string, EditorObject>): Map<string, EditorObject> {
    const next = new Map(map);
    const obj = next.get(this.id);
    if (obj) {
      next.set(this.id, { ...obj, bounds: { ...this.newBounds } } as EditorObject);
    }
    return next;
  }

  undo(map: Map<string, EditorObject>): Map<string, EditorObject> {
    const next = new Map(map);
    const obj = next.get(this.id);
    if (obj) {
      next.set(this.id, { ...obj, bounds: { ...this.oldBounds } } as EditorObject);
    }
    return next;
  }
}

/** Edit text content of a text object. */
export class EditTextCommand implements Command {
  readonly description = 'Edit text';
  private readonly id: string;
  private readonly oldText: string;
  private readonly newText: string;

  constructor(id: string, oldText: string, newText: string) {
    this.id = id;
    this.oldText = oldText;
    this.newText = newText;
  }

  execute(map: Map<string, EditorObject>): Map<string, EditorObject> {
    const next = new Map(map);
    const obj = next.get(this.id);
    if (obj && obj.type === 'text') {
      next.set(this.id, { ...obj, text: this.newText, isModified: true } as EditorObject);
    }
    return next;
  }

  undo(map: Map<string, EditorObject>): Map<string, EditorObject> {
    const next = new Map(map);
    const obj = next.get(this.id);
    if (obj && obj.type === 'text') {
      const isModified = this.oldText !== obj.type && 'originalText' in obj
        ? this.oldText !== (obj as any).originalText
        : true;
      next.set(this.id, { ...obj, text: this.oldText, isModified } as EditorObject);
    }
    return next;
  }
}

/** Change a single property of an object. */
export class EditPropertyCommand<K extends keyof EditorObject> implements Command {
  readonly description: string;
  private readonly id: string;
  private readonly property: K;
  private readonly oldValue: EditorObject[K];
  private readonly newValue: EditorObject[K];

  constructor(id: string, property: K, oldValue: EditorObject[K], newValue: EditorObject[K]) {
    this.id = id;
    this.property = property;
    this.oldValue = oldValue;
    this.newValue = newValue;
    this.description = `Change ${String(property)}`;
  }

  execute(map: Map<string, EditorObject>): Map<string, EditorObject> {
    const next = new Map(map);
    const obj = next.get(this.id);
    if (obj) {
      next.set(this.id, { ...obj, [this.property]: this.newValue } as EditorObject);
    }
    return next;
  }

  undo(map: Map<string, EditorObject>): Map<string, EditorObject> {
    const next = new Map(map);
    const obj = next.get(this.id);
    if (obj) {
      next.set(this.id, { ...obj, [this.property]: this.oldValue } as EditorObject);
    }
    return next;
  }
}

/** Batch command: groups multiple commands into a single undo step. */
export class BatchCommand implements Command {
  readonly description: string;
  private readonly commands: Command[];

  constructor(commands: Command[], description?: string) {
    this.commands = commands;
    this.description = description || `Batch (${commands.length} operations)`;
  }

  execute(map: Map<string, EditorObject>): Map<string, EditorObject> {
    let result = map;
    for (const cmd of this.commands) {
      result = cmd.execute(result);
    }
    return result;
  }

  undo(map: Map<string, EditorObject>): Map<string, EditorObject> {
    let result = map;
    // Undo in reverse order
    for (let i = this.commands.length - 1; i >= 0; i--) {
      result = this.commands[i].undo(result);
    }
    return result;
  }
}

// ---- History Engine ----

/**
 * Manages undo/redo stacks using the Command pattern.
 * Each entry is a Command that stores only deltas.
 */
export class HistoryEngine {
  private undoStack: Command[] = [];
  private redoStack: Command[] = [];
  private maxDepth: number;

  constructor(maxDepth: number = MAX_HISTORY_DEPTH) {
    this.maxDepth = maxDepth;
  }

  /**
   * Push a command onto the undo stack and clear the redo stack.
   * The command should already be executed.
   */
  push(command: Command): void {
    this.undoStack.push(command);
    this.redoStack = []; // New action invalidates redo history

    // Enforce maximum depth
    if (this.undoStack.length > this.maxDepth) {
      this.undoStack.shift();
    }
  }

  /**
   * Undo the last command.
   * @param objects - Current objects map.
   * @returns New objects map after undo, or null if nothing to undo.
   */
  undo(objects: Map<string, EditorObject>): Map<string, EditorObject> | null {
    const command = this.undoStack.pop();
    if (!command) return null;

    this.redoStack.push(command);
    return command.undo(objects);
  }

  /**
   * Redo the last undone command.
   * @param objects - Current objects map.
   * @returns New objects map after redo, or null if nothing to redo.
   */
  redo(objects: Map<string, EditorObject>): Map<string, EditorObject> | null {
    const command = this.redoStack.pop();
    if (!command) return null;

    this.undoStack.push(command);
    return command.execute(objects);
  }

  /** Whether undo is available. */
  get canUndo(): boolean {
    return this.undoStack.length > 0;
  }

  /** Whether redo is available. */
  get canRedo(): boolean {
    return this.redoStack.length > 0;
  }

  /** Number of commands in the undo stack. */
  get undoCount(): number {
    return this.undoStack.length;
  }

  /** Number of commands in the redo stack. */
  get redoCount(): number {
    return this.redoStack.length;
  }

  /** Clear all history. */
  clear(): void {
    this.undoStack = [];
    this.redoStack = [];
  }
}
