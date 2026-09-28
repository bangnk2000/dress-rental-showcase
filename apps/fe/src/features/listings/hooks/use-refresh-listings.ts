import { useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';

import {
  getGetDressHttpControllerGetQueryKey,
  getGetListingHttpControllerGetQueryKey,
  getListDressesHttpControllerListQueryKey,
  getListListingsHttpControllerListQueryKey,
} from '@/api/generated/catalog/catalog';

/**
 * After any listing write: the list (parameterless key), this listing's detail, and the dresses —
 * a dress's "Thuộc mẫu" row reads `DressResponseDto.listings`, so the dress list (parameterless
 * prefix of every filtered key) and the detail of every dress the write touched go stale too.
 */
export function useRefreshListings() {
  const queryClient = useQueryClient();

  return useCallback(
    async ({
      listingId,
      dressIds = [],
    }: {
      listingId?: string;
      dressIds?: readonly string[];
    }): Promise<void> => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: getListListingsHttpControllerListQueryKey() }),
        listingId
          ? queryClient.invalidateQueries({
              queryKey: getGetListingHttpControllerGetQueryKey(listingId),
            })
          : Promise.resolve(),
        queryClient.invalidateQueries({ queryKey: getListDressesHttpControllerListQueryKey() }),
        ...[...new Set(dressIds)].map((id) =>
          queryClient.invalidateQueries({ queryKey: getGetDressHttpControllerGetQueryKey(id) }),
        ),
      ]);
    },
    [queryClient],
  );
}
