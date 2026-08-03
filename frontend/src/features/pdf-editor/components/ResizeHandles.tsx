// ============================================================
// CompressKro PDF Editor — Resize Handles Component
// ============================================================
// Renders 8-point resize handles around a selected object.
// Handles emit pointerdown events that the parent drag system
// consumes.
// ============================================================

import React from 'react';
import type { ResizeHandle } from '../core/types';

interface ResizeHandlesProps {
  /** Called when a handle is grabbed. */
  onHandlePointerDown: (e: React.PointerEvent, handle: ResizeHandle) => void;
}

const HANDLE_SIZE = 8;
const HANDLE_OFFSET = -(HANDLE_SIZE / 2);

/**
 * Positions for the 8 resize handles.
 * Coordinates are CSS percentages/positions relative to the parent.
 */
const handlePositions: Array<{
  handle: ResizeHandle;
  style: React.CSSProperties;
  cursor: string;
}> = [
  { handle: 'tl', style: { top: HANDLE_OFFSET, left: HANDLE_OFFSET }, cursor: 'nwse-resize' },
  { handle: 'tc', style: { top: HANDLE_OFFSET, left: '50%', marginLeft: HANDLE_OFFSET }, cursor: 'ns-resize' },
  { handle: 'tr', style: { top: HANDLE_OFFSET, right: HANDLE_OFFSET }, cursor: 'nesw-resize' },
  { handle: 'ml', style: { top: '50%', marginTop: HANDLE_OFFSET, left: HANDLE_OFFSET }, cursor: 'ew-resize' },
  { handle: 'mr', style: { top: '50%', marginTop: HANDLE_OFFSET, right: HANDLE_OFFSET }, cursor: 'ew-resize' },
  { handle: 'bl', style: { bottom: HANDLE_OFFSET, left: HANDLE_OFFSET }, cursor: 'nesw-resize' },
  { handle: 'bc', style: { bottom: HANDLE_OFFSET, left: '50%', marginLeft: HANDLE_OFFSET }, cursor: 'ns-resize' },
  { handle: 'br', style: { bottom: HANDLE_OFFSET, right: HANDLE_OFFSET }, cursor: 'nwse-resize' },
];

export const ResizeHandles = React.memo(function ResizeHandles({
  onHandlePointerDown,
}: ResizeHandlesProps) {
  return (
    <>
      {handlePositions.map(({ handle, style, cursor }) => (
        <div
          key={handle}
          onPointerDown={(e) => {
            e.stopPropagation();
            e.preventDefault();
            onHandlePointerDown(e, handle);
          }}
          className="absolute z-50 border-2 border-pink-600 bg-white"
          style={{
            width: HANDLE_SIZE,
            height: HANDLE_SIZE,
            cursor,
            ...style,
          }}
        />
      ))}
    </>
  );
});
