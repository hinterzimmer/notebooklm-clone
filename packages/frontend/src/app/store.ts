import { configureStore, createSlice, PayloadAction } from '@reduxjs/toolkit';
import {
  BaseQueryFn,
  FetchArgs,
  FetchBaseQueryError,
  createApi,
  fetchBaseQuery,
} from '@reduxjs/toolkit/query/react';
import {
  IngestionTelemetryEvent,
  AuthResponse,
  LoginRequest,
  SignUpRequest,
} from '@notebooklm/shared';

// 1. Auth Slice
interface AuthState {
  token: string | null;
  userId: string | null;
  email: string | null;
}

const initialAuth: AuthState = {
  token: localStorage.getItem('notebooklm_token'),
  userId: localStorage.getItem('notebooklm_user_id'),
  email: localStorage.getItem('notebooklm_email'),
};

export const authSlice = createSlice({
  name: 'auth',
  initialState: initialAuth,
  reducers: {
    setAuth: (
      state,
      action: PayloadAction<{ token: string; userId: string; email?: string }>,
    ) => {
      state.token = action.payload.token;
      state.userId = action.payload.userId;
      state.email = action.payload.email || null;
      localStorage.setItem('notebooklm_token', action.payload.token);
      localStorage.setItem('notebooklm_user_id', action.payload.userId);
      if (action.payload.email) {
        localStorage.setItem('notebooklm_email', action.payload.email);
      }
    },
    clearAuth: (state) => {
      state.token = null;
      state.userId = null;
      state.email = null;
      localStorage.removeItem('notebooklm_token');
      localStorage.removeItem('notebooklm_user_id');
      localStorage.removeItem('notebooklm_email');
    },
  },
});

// 2. Workspace Slice
interface WorkspaceState {
  activeNotebookId: string | null;
  activeThreadId: string | null;
  ingestionStatuses: Record<string, IngestionTelemetryEvent>;
}

const initialWorkspace: WorkspaceState = {
  activeNotebookId: null,
  activeThreadId: null,
  ingestionStatuses: {},
};

export const workspaceSlice = createSlice({
  name: 'workspace',
  initialState: initialWorkspace,
  reducers: {
    setActiveNotebook: (state, action: PayloadAction<string | null>) => {
      state.activeNotebookId = action.payload;
      state.activeThreadId = null;
    },
    setActiveThread: (state, action: PayloadAction<string | null>) => {
      state.activeThreadId = action.payload;
    },
    updateIngestionStatus: (state, action: PayloadAction<IngestionTelemetryEvent>) => {
      state.ingestionStatuses[action.payload.version_id] = action.payload;
    },
  },
});

// 3. RTK Query API
export const API_BASE =
  (import.meta as any).env?.VITE_API_URL ||
  (typeof window !== 'undefined' &&
  (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
    ? `http://${window.location.hostname}:3000`
    : '');

const rawBaseQuery = fetchBaseQuery({
  baseUrl: API_BASE,
  prepareHeaders: (headers, { getState }) => {
    const token = (getState() as RootState).auth.token;
    if (token) {
      headers.set('Authorization', `Bearer ${token}`);
    }
    return headers;
  },
});

const baseQueryWithReauth: BaseQueryFn<
  string | FetchArgs,
  unknown,
  FetchBaseQueryError
> = async (args, api, extraOptions) => {
  const result = await rawBaseQuery(args, api, extraOptions);
  if (result.error && result.error.status === 401) {
    api.dispatch(authSlice.actions.clearAuth());
  }
  return result;
};

export const apiSlice = createApi({
  reducerPath: 'api',
  baseQuery: baseQueryWithReauth,
  tagTypes: ['Notebook', 'Source', 'Thread', 'Message'],
  endpoints: (builder) => ({
    login: builder.mutation<AuthResponse, LoginRequest>({
      query: (credentials) => ({
        url: '/auth/login',
        method: 'POST',
        body: credentials,
      }),
    }),
    signUp: builder.mutation<
      { userSub: string; userConfirmed: boolean; message: string },
      SignUpRequest
    >({
      query: (data) => ({
        url: '/auth/signup',
        method: 'POST',
        body: data,
      }),
    }),
    devLogin: builder.mutation<AuthResponse, void>({
      query: () => ({
        url: '/auth/dev-login',
        method: 'POST',
      }),
    }),
    getNotebooks: builder.query<any[], void>({
      query: () => '/notebooks',
      providesTags: ['Notebook'],
    }),
    createNotebook: builder.mutation<any, { title: string; strategy?: string }>({
      query: (body) => ({
        url: '/notebooks',
        method: 'POST',
        body,
      }),
      invalidatesTags: ['Notebook'],
    }),
    deleteNotebook: builder.mutation<any, string>({
      query: (id) => ({
        url: `/notebooks/${id}`,
        method: 'DELETE',
      }),
      invalidatesTags: ['Notebook'],
    }),
    updateNotebook: builder.mutation<any, { id: string; title: string }>({
      query: ({ id, title }) => ({
        url: `/notebooks/${id}`,
        method: 'PATCH',
        body: { title },
      }),
      invalidatesTags: ['Notebook'],
    }),
    getSources: builder.query<any[], string>({
      query: (notebookId) => `/notebooks/${notebookId}/sources`,
      providesTags: ['Source'],
    }),
    uploadSource: builder.mutation<any, { notebookId: string; formData: FormData }>({
      query: ({ notebookId, formData }) => ({
        url: `/notebooks/${notebookId}/sources`,
        method: 'POST',
        body: formData,
      }),
      invalidatesTags: ['Source'],
    }),
    getThreads: builder.query<any[], string>({
      query: (notebookId) => `/notebooks/${notebookId}/threads`,
      providesTags: ['Thread'],
    }),
    createThread: builder.mutation<any, { notebookId: string; title?: string }>({
      query: ({ notebookId, title }) => ({
        url: `/notebooks/${notebookId}/threads`,
        method: 'POST',
        body: { title },
      }),
      invalidatesTags: ['Thread'],
    }),
    updateThread: builder.mutation<any, { id: string; title?: string; notebookId?: string }>({
      query: ({ id, ...body }) => ({
        url: `/threads/${id}`,
        method: 'PATCH',
        body,
      }),
      invalidatesTags: ['Thread'],
    }),
    deleteThread: builder.mutation<any, string>({
      query: (id) => ({
        url: `/threads/${id}`,
        method: 'DELETE',
      }),
      invalidatesTags: ['Thread'],
    }),
    getMessages: builder.query<any[], { threadId: string; cursor?: string }>({
      query: ({ threadId, cursor }) =>
        `/threads/${threadId}/messages${cursor ? `?cursor=${cursor}` : ''}`,
      providesTags: ['Message'],
    }),
  }),
});

export const {
  useLoginMutation,
  useSignUpMutation,
  useDevLoginMutation,
  useGetNotebooksQuery,
  useCreateNotebookMutation,
  useUpdateNotebookMutation,
  useDeleteNotebookMutation,
  useGetSourcesQuery,
  useUploadSourceMutation,
  useGetThreadsQuery,
  useCreateThreadMutation,
  useUpdateThreadMutation,
  useDeleteThreadMutation,
  useGetMessagesQuery,
} = apiSlice;

export const store = configureStore({
  reducer: {
    auth: authSlice.reducer,
    workspace: workspaceSlice.reducer,
    [apiSlice.reducerPath]: apiSlice.reducer,
  },
  middleware: (getDefault) => getDefault().concat(apiSlice.middleware),
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
