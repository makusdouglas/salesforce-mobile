// 011-order-email-delivery: thin React hook wrapping orderSendService.
// The plain function `runSendOrder` is also exported so unit tests can
// exercise the behaviour without mounting a component (same split as
// 010's runRepeatOrder).

import { useCallback, useState } from 'react';

import { orderSendService, type SendOrderResult } from './orderSendService';

export async function runSendOrder(orderId: string): Promise<SendOrderResult> {
  return orderSendService.sendOrder({ orderId });
}

export function useSendOrder() {
  const [isSending, setIsSending] = useState(false);

  const send = useCallback(async (orderId: string): Promise<SendOrderResult> => {
    setIsSending(true);
    try {
      return await runSendOrder(orderId);
    } finally {
      setIsSending(false);
    }
  }, []);

  return { send, isSending };
}
