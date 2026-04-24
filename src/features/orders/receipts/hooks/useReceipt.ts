// 012-payment-receipts: observe a single receipt by id.

import { useEffect, useState } from 'react';

import type PaymentReceipt from '@/data/models/PaymentReceipt';
import { paymentReceiptsRepository } from '@/data/repositories/paymentReceiptsRepository';

export function useReceipt(receiptId: string): {
  readonly receipt: PaymentReceipt | null;
  readonly loading: boolean;
} {
  const [receipt, setReceipt] = useState<PaymentReceipt | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const sub = paymentReceiptsRepository.observe(receiptId).subscribe({
      next: (row) => {
        setReceipt(row);
        setLoading(false);
      },
    });
    return () => sub.unsubscribe();
  }, [receiptId]);

  return { receipt, loading };
}
