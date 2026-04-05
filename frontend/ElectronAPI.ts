import type { ElectronAPI as ElectronAPIType } from '@bridge';

export const ElectronAPI: ElectronAPIType = (window as any).electronAPI;
