import { AXIOS_INSTANCE } from './mutator/custom-instance';

/** SVG needs an Authorization header, so it is deliberately fetched as a Blob. */
export async function getQrSvgBlob(id: string): Promise<Blob> {
  const response = await AXIOS_INSTANCE.get<Blob>(`/api/v1/qr-links/${id}/image.svg`, {
    responseType: 'blob',
  });
  return response.data;
}
