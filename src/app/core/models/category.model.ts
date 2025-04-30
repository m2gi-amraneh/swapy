export interface Category {
  id: string;
  name: string;
  description?: string;
  icon?: string;
  image?: string;
  parentId?: string;
  order?: number;
  createdAt: number;
  updatedAt: number;
}
