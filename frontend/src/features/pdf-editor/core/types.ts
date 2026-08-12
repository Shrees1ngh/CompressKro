// ============================================================
// CompressKro PDF Editor — Core Type Definitions
// ============================================================
// Central type system for the PDF editing engine.
// Every editor module imports from here.
// ============================================================

// ---- Geometry Primitives ----

/** Axis-aligned bounding rectangle in PDF user-space coordinates. */
export interface Bounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** 2D point in any coordinate space. */
export interface Point {
  x: number;
  y: number;
}

/** CSS-friendly positioning rectangle (screen space, pixels). */
export interface ViewportRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

/**
 * 6-element affine transform matrix [a, b, c, d, e, f].
 * Matches the PDF/Canvas convention:
 *   | a  b  0 |
 *   | c  d  0 |
 *   | e  f  1 |
 */
export type AffineMatrix = [number, number, number, number, number, number];

// ---- Color ----

/** Normalized RGB color (0–1 range per channel). */
export interface RgbColor {
  r: number;
  g: number;
  b: number;
}

// ---- Font ----

/** Resolved font properties for rendering and export. */
export interface FontProperties {
  /** Original PDF font name (e.g. "BCDEEE+ArialMT"). */
  pdfFontName: string;
  /** Mapped CSS font-family (e.g. "Arial, Helvetica, sans-serif"). */
  cssFontFamily: string;
  /** pdf-lib StandardFont key if available (e.g. "Helvetica"). */
  standardFontKey: string;
  /** Font weight: normal (400) or bold (700). */
  weight: 'normal' | 'bold';
  /** Font style: normal or italic. */
  style: 'normal' | 'italic';
}

// ---- Editor Object Types ----

export type EditorObjectType =
  | 'text'
  | 'image'
  | 'shape'
  | 'whiteout'
  | 'signature'
  | 'freehand';

export type ShapeKind = 'rectangle' | 'circle' | 'arrow' | 'line';

export type TextOrigin = 'extracted' | 'inserted';

export type ImageOrigin = 'extracted' | 'inserted';

// ---- Base Editor Object ----

/**
 * Properties shared by every object on the editing canvas.
 * All coordinates are in PDF user-space (points, Y-up from page bottom-left).
 */
export interface EditorObjectBase {
  /** Globally unique identifier (nanoid or crypto.randomUUID). */
  id: string;
  /** Object type discriminator. */
  type: EditorObjectType;
  /** Zero-based page index this object belongs to. */
  pageIndex: number;
  /** Bounding rectangle in PDF user-space. */
  bounds: Bounds;
  /** Rotation in degrees (clockwise). Default 0. */
  rotation: number;
  /** Opacity 0–1. Default 1. */
  opacity: number;
  /** Z-index for layering within the page. Higher = on top. */
  zIndex: number;
  /** If true, object cannot be moved, resized, or edited. */
  locked: boolean;
}

// ---- Concrete Object Types ----

export interface TextObject extends EditorObjectBase {
  type: 'text';
  /** Whether this text was extracted from the PDF or inserted by the user. */
  origin: TextOrigin;
  /** Current text content (may differ from originalText after editing). */
  text: string;
  /** Original text content from the PDF (empty string for inserted text). */
  originalText: string;
  /** Font size in PDF points. */
  fontSize: number;
  /** Resolved font properties. */
  font: FontProperties;
  /** Text color as hex string (e.g. "#000000"). */
  color: string;
  /** Letter spacing in points. Default 0. */
  letterSpacing: number;
  /** Line height multiplier. Default 1.2. */
  lineHeight: number;
  /** Text alignment. Default 'left'. */
  alignment: 'left' | 'center' | 'right';
  /** Whether the text has been modified from its original. */
  isModified: boolean;
  /** Whether the text color has been extracted from the canvas. */
  colorExtracted?: boolean;
}

export interface ImageObject extends EditorObjectBase {
  type: 'image';
  /** Whether this image was extracted from the PDF or inserted by the user. */
  origin: ImageOrigin;
  /** XObject name from the PDF (e.g. "Im0"). Null for inserted images. */
  xObjectName: string | null;
  /** Data URL for display (preview). */
  dataUrl: string | null;
  /** File reference for export (inserted/replacement images only). */
  file: File | null;
  /** Original transform matrix from PDF (extracted images only). */
  originalTransform: AffineMatrix | null;
  /** If true, the extracted image has been marked for deletion. */
  deleted: boolean;
  /** If set, this file/dataUrl replaces the original extracted image. */
  replacementFile: File | null;
  replacementDataUrl: string | null;
}

export interface ShapeObject extends EditorObjectBase {
  type: 'shape';
  /** Shape variant. */
  shapeKind: ShapeKind;
  /** Fill color hex. Null = no fill. */
  fillColor: string | null;
  /** Stroke color hex. Null = no stroke. */
  strokeColor: string | null;
  /** Stroke width in points. */
  strokeWidth: number;
  /** For arrows/lines: start point in PDF space. */
  startPoint?: Point;
  /** For arrows/lines: end point in PDF space. */
  endPoint?: Point;
}

export interface WhiteoutObject extends EditorObjectBase {
  type: 'whiteout';
  /** Whiteout is always white in the exported PDF. */
}

export interface SignatureObject extends EditorObjectBase {
  type: 'signature';
  /** Data URL of the signature image (PNG). */
  dataUrl: string;
  /** File blob for export. */
  file: File;
}

export interface FreehandObject extends EditorObjectBase {
  type: 'freehand';
  /** Array of points forming the freehand path, in PDF user-space. */
  points: Point[];
  /** Stroke color hex. */
  strokeColor: string;
  /** Stroke width in points. */
  strokeWidth: number;
}

/** Union of all concrete editor object types. */
export type EditorObject =
  | TextObject
  | ImageObject
  | ShapeObject
  | WhiteoutObject
  | SignatureObject
  | FreehandObject;

// ---- Page Data ----

/**
 * Parsed data for a single PDF page.
 * Populated during the initial document parse phase.
 */
export interface PageData {
  /** Zero-based page index. */
  pageIndex: number;
  /** Page width in PDF points (user-space, before rotation). */
  widthPts: number;
  /** Page height in PDF points (user-space, before rotation). */
  heightPts: number;
  /** Page rotation in degrees from the /Rotate key (0, 90, 180, 270). */
  rotation: number;
  /** Text objects extracted from this page. */
  textObjects: TextObject[];
  /** Image objects extracted from this page. */
  imageObjects: ImageObject[];
}

/**
 * Full parsed PDF document structure.
 */
export interface ParsedDocument {
  /** Total number of pages. */
  numPages: number;
  /** Per-page extracted data. */
  pages: PageData[];
  /** The pdfjs-dist document proxy (typed as any to avoid pdfjs type import). */
  pdfjsDocument: any;
  /** Original file reference. */
  file: File;
}

// ---- Tool Types ----

export type ToolType =
  | 'select'
  | 'text'
  | 'whiteout'
  | 'image'
  | 'signature'
  | 'shape'
  | 'ellipse'
  | 'line'
  | 'arrow'
  | 'freehand'
  | 'freehand-highlight'
  | 'highlight'
  | 'underline'
  | 'strikeout';

// ---- History / Command ----

export type CommandType =
  | 'insert'
  | 'delete'
  | 'move'
  | 'resize'
  | 'edit-text'
  | 'edit-property'
  | 'replace-image'
  | 'batch';

/** Minimal snapshot for undo/redo delta. */
export interface CommandDelta<T = any> {
  objectId: string;
  property: string;
  oldValue: T;
  newValue: T;
}

// ---- Resize Handle ----

export type ResizeHandle =
  | 'tl' | 'tc' | 'tr'
  | 'ml'          | 'mr'
  | 'bl' | 'bc' | 'br';

// ---- Interaction State ----

export interface DragInteraction {
  objectId: string;
  type: 'drag' | 'resize';
  handle?: ResizeHandle;
  startScreenX: number;
  startScreenY: number;
  startBounds: Bounds;
}

export interface DrawInteraction {
  pageIndex: number;
  startX: number;
  startY: number;
  currentX: number;
  currentY: number;
  points?: Point[];
}

// ---- Editor State ----

export interface EditorState {
  /** The parsed PDF document, or null if no file is loaded. */
  document: ParsedDocument | null;
  /** All editor objects indexed by ID. */
  objects: Map<string, EditorObject>;
  /** Currently selected object IDs. */
  selection: Set<string>;
  /** The active editing tool. */
  activeTool: ToolType;
  /** Current zoom level (1.0 = 100%). */
  zoom: number;
  /** Zero-based index of the currently focused page. */
  currentPageIndex: number;
  /** True while the PDF is being parsed. */
  isLoading: boolean;
  /** True while the export is running. */
  isExporting: boolean;
  /** Progress message for loading/exporting. */
  progressMessage: string;
  /** Active text editing object ID, or null. */
  editingTextId: string | null;
}

// ---- Editor Actions ----

export type EditorAction =
  | { type: 'SET_DOCUMENT'; payload: ParsedDocument }
  | { type: 'RESET' }
  | { type: 'SET_LOADING'; payload: { isLoading: boolean; message?: string } }
  | { type: 'SET_EXPORTING'; payload: { isExporting: boolean; message?: string } }
  | { type: 'SET_TOOL'; payload: ToolType }
  | { type: 'SET_ZOOM'; payload: number }
  | { type: 'SET_CURRENT_PAGE'; payload: number }
  | { type: 'SET_EDITING_TEXT'; payload: string | null }
  | { type: 'INSERT_OBJECT'; payload: EditorObject }
  | { type: 'INSERT_OBJECTS'; payload: EditorObject[] }
  | { type: 'DELETE_OBJECT'; payload: string }
  | { type: 'DELETE_OBJECTS'; payload: string[] }
  | { type: 'UPDATE_OBJECT'; payload: { id: string; changes: Partial<EditorObject> } }
  | { type: 'UPDATE_OBJECTS'; payload: Array<{ id: string; changes: Partial<EditorObject> }> }
  | { type: 'SET_SELECTION'; payload: Set<string> }
  | { type: 'ADD_TO_SELECTION'; payload: string }
  | { type: 'REMOVE_FROM_SELECTION'; payload: string }
  | { type: 'CLEAR_SELECTION' }
  | { type: 'REPLACE_ALL_OBJECTS'; payload: Map<string, EditorObject> };
