export interface UserRole {
  id: string;
  user_id: string;
  role_id: string;
  organization_id: string | null;
  createdAt: string;
  updatedAt: string;
}
