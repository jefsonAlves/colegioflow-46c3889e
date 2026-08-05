import { useEffect, useCallback } from 'react';

// Simple global state for unsaved changes (just for this demo/session)
let hasUnsavedChangesGlobal = false;

export function setHasUnsavedChanges(value: boolean) {
  hasUnsavedChangesGlobal = value;
}

export function getHasUnsavedChanges() {
  return hasUnsavedChangesGlobal;
}

export function useUnsavedChanges(isDirty: boolean) {
  useEffect(() => {
    hasUnsavedChangesGlobal = isDirty;
    
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasUnsavedChangesGlobal) {
        e.preventDefault();
        e.returnValue = ''; // Required for some browsers
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      hasUnsavedChangesGlobal = false;
    };
  }, [isDirty]);

  const confirmNavigation = useCallback(() => {
    if (hasUnsavedChangesGlobal) {
      return window.confirm('Você tem alterações não salvas. Deseja realmente sair sem salvar?');
    }
    return true;
  }, []);

  return { confirmNavigation };
}
