import Axios, { type AxiosRequestConfig } from 'axios';

import { getAccessToken } from './auth-tokens';

export const AXIOS_INSTANCE = Axios.create({ baseURL: import.meta.env.VITE_API_BASE_URL });

AXIOS_INSTANCE.interceptors.request.use((config) => {
  const token = getAccessToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

/** The sole HTTP door for generated hooks and future QR-specific blob requests. */
export const customInstance = <T>(
  config: AxiosRequestConfig,
  options?: AxiosRequestConfig,
): Promise<T> => AXIOS_INSTANCE({ ...config, ...options }).then(({ data }) => data as T);
