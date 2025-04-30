import { ActionReducerMap, MetaReducer } from '@ngrx/store';
import { environment } from '../../../environments/environment';

export interface AppState {
  // Définir les états ici
}

export const reducers: ActionReducerMap<AppState> = {
  // Définir les reducers ici
};

export const metaReducers: MetaReducer<AppState>[] = !environment.production ? [] : [];
