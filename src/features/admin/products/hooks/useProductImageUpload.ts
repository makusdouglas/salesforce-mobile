import { useCallback, useState } from 'react';

import {
  pickAndUploadImage,
  takePhotoAndUpload,
  type ImageUploadResult,
} from '../service/imageUpload';

export function useProductImageUpload() {
  const [pending, setPending] = useState(false);

  const pickFromLibrary = useCallback(
    async (productId: string | undefined): Promise<ImageUploadResult> => {
      setPending(true);
      const result = await pickAndUploadImage(productId ?? 'new');
      setPending(false);
      return result;
    },
    [],
  );

  const takePhoto = useCallback(
    async (productId: string | undefined): Promise<ImageUploadResult> => {
      setPending(true);
      const result = await takePhotoAndUpload(productId ?? 'new');
      setPending(false);
      return result;
    },
    [],
  );

  return { pickFromLibrary, takePhoto, pending } as const;
}
