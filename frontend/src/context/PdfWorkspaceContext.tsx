// ============================================================
// CompressKro — PDF Workspace Shared State Context
// Holds the active file, multi-file list, and chain-output wiring.
// Memory-safe: revokes previous blob URLs on replacement.
// ============================================================

import React, { createContext, useContext, useState, useCallback, useRef } from 'react';

export interface WorkspaceFileItem {
  id: string;
  name: string;
  size: number;
  blob: File | Blob;
}

interface PdfWorkspaceContextValue {
  // Active file state
  activeFile: File | Blob | null;
  activeFileName: string;
  activeFileSize: number;
  activeFileUrl: string | null;

  // Multi-file state
  activeFiles: WorkspaceFileItem[];

  // Chained state
  isChained: boolean;
  setIsChained: (chained: boolean) => void;

  // "File updated ✓" indicator (auto-dismisses after 3s)
  fileUpdatedIndicator: boolean;

  // Actions
  setActiveFile: (file: File | Blob, name: string, size?: number) => void;
  addActiveFiles: (files: File[]) => void;
  removeActiveFile: (id: string) => void;
  reorderActiveFiles: (direction: 'up' | 'down', index: number) => void;
  setAllActiveFiles: (files: WorkspaceFileItem[]) => void;
  chainOutput: (blob: Blob, name: string) => void;
  clearActiveFile: () => void;
  resetWorkspace: () => void;
}

const PdfWorkspaceContext = createContext<PdfWorkspaceContextValue | null>(null);

export function PdfWorkspaceProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<{
    file: File | Blob | null;
    name: string;
    size: number;
    objectUrl: string | null;
    files: WorkspaceFileItem[];
  }>({
    file: null,
    name: '',
    size: 0,
    objectUrl: null,
    files: [],
  });

  const [isChained, setIsChained] = useState(false);
  const [fileUpdatedIndicator, setFileUpdatedIndicator] = useState(false);

  // Ref to track the previous object URL for revocation
  const prevObjectUrlRef = useRef<string | null>(null);
  // Ref for the indicator timeout
  const indicatorTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const revokeOldUrl = useCallback(() => {
    if (prevObjectUrlRef.current) {
      URL.revokeObjectURL(prevObjectUrlRef.current);
      prevObjectUrlRef.current = null;
    }
  }, []);

  const setActiveFile = useCallback((file: File | Blob, name: string, size?: number) => {
    revokeOldUrl();
    const url = URL.createObjectURL(file);
    prevObjectUrlRef.current = url;
    setIsChained(false);

    const fileSize = size ?? file.size;
    setState(prev => {
      const alreadyExists = prev.files.some(f => f.name === name && f.size === fileSize);
      const newFiles = alreadyExists
        ? prev.files
        : [{ id: 'active', name, size: fileSize, blob: file }, ...prev.files];
      return {
        file,
        name,
        size: fileSize,
        objectUrl: url,
        files: newFiles,
      };
    });
  }, [revokeOldUrl]);

  const addActiveFiles = useCallback((files: File[]) => {
    const newItems = files.map(f => ({
      id: Math.random().toString(36).substring(2),
      name: f.name,
      size: f.size,
      blob: f,
    }));
    setIsChained(false);

    setState(prev => {
      const updatedFiles = [...prev.files, ...newItems];
      if (!prev.file && updatedFiles.length > 0) {
        revokeOldUrl();
        const first = updatedFiles[0];
        const url = URL.createObjectURL(first.blob);
        prevObjectUrlRef.current = url;
        return {
          file: first.blob,
          name: first.name,
          size: first.size,
          objectUrl: url,
          files: updatedFiles,
        };
      }
      return {
        ...prev,
        files: updatedFiles,
      };
    });
  }, [revokeOldUrl]);

  const removeActiveFile = useCallback((id: string) => {
    setIsChained(false);
    setState(prev => {
      const updatedFiles = prev.files.filter(f => f.id !== id);
      if (updatedFiles.length === 0) {
        revokeOldUrl();
        return {
          file: null,
          name: '',
          size: 0,
          objectUrl: null,
          files: [],
        };
      }
      const removedItem = prev.files.find(f => f.id === id);
      if (removedItem && removedItem.blob === prev.file) {
        revokeOldUrl();
        const first = updatedFiles[0];
        const url = URL.createObjectURL(first.blob);
        prevObjectUrlRef.current = url;
        return {
          file: first.blob,
          name: first.name,
          size: first.size,
          objectUrl: url,
          files: updatedFiles,
        };
      }
      return {
        ...prev,
        files: updatedFiles,
      };
    });
  }, [revokeOldUrl]);

  const reorderActiveFiles = useCallback((direction: 'up' | 'down', index: number) => {
    setIsChained(false);
    setState(prev => {
      const list = [...prev.files];
      const targetIdx = direction === 'up' ? index - 1 : index + 1;
      if (targetIdx >= 0 && targetIdx < list.length) {
        const temp = list[index];
        list[index] = list[targetIdx];
        list[targetIdx] = temp;
        return {
          ...prev,
          files: list,
        };
      }
      return prev;
    });
  }, []);

  const setAllActiveFiles = useCallback((files: WorkspaceFileItem[]) => {
    setIsChained(false);
    setState(prev => {
      if (files.length === 0) {
        revokeOldUrl();
        return {
          file: null,
          name: '',
          size: 0,
          objectUrl: null,
          files: [],
        };
      }
      // If we don't have an activeFile or the previous activeFile is gone
      const hasActive = files.some(f => f.blob === prev.file);
      if (!hasActive) {
        revokeOldUrl();
        const first = files[0];
        const url = URL.createObjectURL(first.blob);
        prevObjectUrlRef.current = url;
        return {
          file: first.blob,
          name: first.name,
          size: first.size,
          objectUrl: url,
          files,
        };
      }
      return {
        ...prev,
        files,
      };
    });
  }, [revokeOldUrl]);

  const chainOutput = useCallback((blob: Blob, name: string) => {
    revokeOldUrl();
    const url = URL.createObjectURL(blob);
    prevObjectUrlRef.current = url;
    setIsChained(true);

    setState({
      file: blob,
      name,
      size: blob.size,
      objectUrl: url,
      files: [{ id: 'active', name, size: blob.size, blob }],
    });

    setFileUpdatedIndicator(true);
    if (indicatorTimeoutRef.current) {
      clearTimeout(indicatorTimeoutRef.current);
    }
    indicatorTimeoutRef.current = setTimeout(() => {
      setFileUpdatedIndicator(false);
      indicatorTimeoutRef.current = null;
    }, 3000);
  }, [revokeOldUrl]);

  const clearActiveFile = useCallback(() => {
    revokeOldUrl();
    setIsChained(false);
    setState({ file: null, name: '', size: 0, objectUrl: null, files: [] });
    setFileUpdatedIndicator(false);
    if (indicatorTimeoutRef.current) {
      clearTimeout(indicatorTimeoutRef.current);
      indicatorTimeoutRef.current = null;
    }
  }, [revokeOldUrl]);

  return (
    <PdfWorkspaceContext.Provider
      value={{
        activeFile: state.file,
        activeFileName: state.name,
        activeFileSize: state.size,
        activeFileUrl: state.objectUrl,
        activeFiles: state.files,
        isChained,
        setIsChained,
        fileUpdatedIndicator,
        setActiveFile,
        addActiveFiles,
        removeActiveFile,
        reorderActiveFiles,
        setAllActiveFiles,
        chainOutput,
        clearActiveFile,
        resetWorkspace: clearActiveFile,
      }}
    >
      {children}
    </PdfWorkspaceContext.Provider>
  );
}

export function usePdfWorkspace(): PdfWorkspaceContextValue {
  const ctx = useContext(PdfWorkspaceContext);
  if (!ctx) {
    throw new Error('usePdfWorkspace must be used inside <PdfWorkspaceProvider>');
  }
  return ctx;
}
