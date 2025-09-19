// User types
export interface User {
  id: string;
  username: string;
  email: string;
  storage_quota: number;
  used_storage: number;
  is_admin: boolean;
  created_at: string;
}

export interface AuthPayload {
  token: string;
  user: User;
}

// File types
export interface FileMetadata {
  id: string;
  content_hash: string;
  size_bytes: number;
  created_at: string;
}

export interface UserFile {
  id: string;
  user_id: string;
  file_id: string;
  filename: string;
  mime_type: string;
  encryption_key: string;
  folder_id?: string;
  created_at: string;
  updated_at: string;
  user?: User;
  file?: FileMetadata;
  folder?: Folder;
}

// Folder types
export interface Folder {
  id: string;
  user_id: string;
  name: string;
  parent_id?: string;
  created_at: string;
  updated_at: string;
  user?: User;
  parent?: Folder;
  children: Folder[];
  files: UserFile[];
}

// Display item types for file explorer
export type FileExplorerItem = UserFile | Folder;

export function isFolder(item: FileExplorerItem): item is Folder {
  return 'children' in item && 'files' in item;
}

export function isFile(item: FileExplorerItem): item is UserFile {
  return 'filename' in item && 'mime_type' in item;
}

// Room types
export enum RoomRole {
  ADMIN = 'ADMIN',
  CONTENT_CREATOR = 'CONTENT_CREATOR',
  CONTENT_EDITOR = 'CONTENT_EDITOR',
  CONTENT_VIEWER = 'CONTENT_VIEWER'
}

export interface RoomMember {
  id: string;
  room_id: string;
  user_id: string;
  role: RoomRole;
  created_at: string;
  room?: Room;
  user?: User;
}

export interface Room {
  id: string;
  name: string;
  creator_id: string;
  created_at: string;
  creator?: User;
  members?: RoomMember[];
  files?: UserFile[];
  folders?: Folder[];
}

// Input types
export interface RegisterInput {
  username: string;
  email: string;
  password: string;
}

export interface LoginInput {
  email: string;
  password: string;
}

export interface UploadFileInput {
  filename: string;
  content_hash: string;
  size_bytes: number;
  mime_type: string;
  encrypted_key: string;
  folder_id?: string;
  file_data: File;
}

export interface FileFilterInput {
  filename?: string;
  mime_type?: string;
  min_size?: number;
  max_size?: number;
  date_from?: string;
  date_to?: string;
}

export interface CreateRoomInput {
  name: string;
}

export interface AddRoomMemberInput {
  room_id: string;
  user_id: string;
  role: RoomRole;
}

// Folder input types
export interface CreateFolderInput {
  name: string;
  parent_id?: string;
}

export interface RenameFolderInput {
  id: string;
  name: string;
}

export interface MoveFolderInput {
  id: string;
  parent_id?: string;
}

export interface MoveFileInput {
  id: string;
  folder_id?: string;
}

export interface ShareFolderToRoomInput {
  folder_id: string;
  room_id: string;
}

// Statistics types
export interface UserStats {
  total_files: number;
  used_storage: number;
  storage_quota: number;
  storage_savings: number;
}

export interface AdminDashboard {
  total_users: number;
  total_files: number;
  total_storage_used: number;
  recent_uploads: UserFile[];
}

// Auth context types
export interface AuthContextType {
  user: User | null;
  token: string | null;
  login: (email: string, password: string) => Promise<void>;
  register: (username: string, email: string, password: string) => Promise<void>;
  logout: () => void;
  refreshToken: () => Promise<boolean>;
  loading: boolean;
}

// File upload types
export interface FileUploadProgress {
  file: File;
  progress: number;
  status: 'pending' | 'uploading' | 'completed' | 'error';
  error?: string;
}

// Crypto types for E2EE
export interface EncryptionKey {
  key: Uint8Array;
  nonce: Uint8Array;
}

export interface EncryptedFile {
  encryptedData: Uint8Array;
  key: Uint8Array;
  nonce: Uint8Array;
}
