// File System Access API pieces not yet in TypeScript's DOM library.

interface FileSystemHandlePermissionDescriptor {
  mode?: 'read' | 'readwrite'
}

interface FileSystemHandle {
  queryPermission?(descriptor?: FileSystemHandlePermissionDescriptor): Promise<PermissionState>
  requestPermission?(descriptor?: FileSystemHandlePermissionDescriptor): Promise<PermissionState>
}

interface Window {
  showDirectoryPicker(options?: {
    id?: string
    mode?: 'read' | 'readwrite'
    startIn?: FileSystemHandle | 'documents' | 'desktop' | 'downloads'
  }): Promise<FileSystemDirectoryHandle>
  showOpenFilePicker(options?: {
    multiple?: boolean
    startIn?: FileSystemHandle
    types?: { description?: string; accept: Record<string, string[]> }[]
  }): Promise<FileSystemFileHandle[]>
}
