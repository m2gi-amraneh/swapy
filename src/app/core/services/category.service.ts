import { Injectable } from '@angular/core';
import { 
  Firestore, 
  collection, 
  collectionData, 
  doc, 
  docData, 
  query, 
  where, 
  orderBy, 
  setDoc, 
  updateDoc, 
  deleteDoc, 
  getDocs
} from '@angular/fire/firestore';
import { Observable, of } from 'rxjs';
import { map } from 'rxjs/operators';
import { Category } from '../models/category.model';

@Injectable({
  providedIn: 'root'
})
export class CategoryService {
  
  constructor(
    private firestore: Firestore
  ) {}

  getCategories(): Observable<Category[]> {
    const categoriesRef = collection(this.firestore, 'categories');
    const q = query(categoriesRef, orderBy('order', 'asc'));
    return collectionData(q, { idField: 'id' }) as Observable<Category[]>;
  }

  getTopLevelCategories(): Observable<Category[]> {
    const categoriesRef = collection(this.firestore, 'categories');
    const q = query(
      categoriesRef,
      where('parentId', '==', null),
      orderBy('order', 'asc')
    );
    return collectionData(q, { idField: 'id' }) as Observable<Category[]>;
  }

  getSubcategories(parentId: string): Observable<Category[]> {
    const categoriesRef = collection(this.firestore, 'categories');
    const q = query(
      categoriesRef,
      where('parentId', '==', parentId),
      orderBy('order', 'asc')
    );
    return collectionData(q, { idField: 'id' }) as Observable<Category[]>;
  }

  getCategory(id: string): Observable<Category | null> {
    const categoryRef = doc(this.firestore, `categories/${id}`);
    return docData(categoryRef, { idField: 'id' }).pipe(
      map(category => category as Category || null)
    );
  }

  async createCategory(category: Omit<Category, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
    const categoriesRef = collection(this.firestore, 'categories');
    const id = doc(categoriesRef).id;
    const timestamp = Date.now();
    
    await setDoc(doc(categoriesRef, id), {
      ...category,
      id,
      createdAt: timestamp,
      updatedAt: timestamp
    });
    
    return id;
  }

  async updateCategory(id: string, category: Partial<Category>): Promise<void> {
    const timestamp = Date.now();
    const categoryRef = doc(this.firestore, `categories/${id}`);
    
    await updateDoc(categoryRef, {
      ...category,
      updatedAt: timestamp
    });
  }

  async deleteCategory(id: string): Promise<void> {
    // First check if there are any subcategories
    const categoriesRef = collection(this.firestore, 'categories');
    const q = query(categoriesRef, where('parentId', '==', id));
    const querySnapshot = await getDocs(q);
    
    if (!querySnapshot.empty) {
      throw new Error('Cannot delete category with subcategories');
    }
    
    const categoryRef = doc(this.firestore, `categories/${id}`);
    return deleteDoc(categoryRef);
  }
}