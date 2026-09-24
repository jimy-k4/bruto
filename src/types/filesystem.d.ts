interface Window {
  showDirectoryPicker: () => Promise<FileSystemDirectoryHandle>
  showOpenFilePicker: (options?: {
    multiple?: boolean
    startIn?: FileSystemDirectoryHandle
  }) => Promise<FileSystemFileHandle[]>
}
