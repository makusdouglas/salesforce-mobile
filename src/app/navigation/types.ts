export type RootStackParamList = {
  Auth: undefined;
  Home: undefined;
  Relogin: { resolve: () => void; reject: () => void };
};

export type RootTabsParamList = {
  HomeTab: undefined;
  AdminTab: undefined;
};

export type AdminStackParamList = {
  // 015-admin-sellers: landing menu that lists admin areas.
  AdminMenu: undefined;
  AdminProducts: undefined;
  AdminProductSource: undefined;
  AdminBarcodeScanner: undefined;
  AdminBarcodeMatch: { productId: string };
  AdminProductForm: {
    productId?: string;
    prefilledBarcode?: string;
  };
  AdminImageSource: undefined;
  // 015-admin-sellers: sellers module routes.
  AdminSellersList: undefined;
  AdminSellerForm:
    | { mode: 'create' }
    | { mode: 'edit'; authUserId: string };
};

export type AuthStackParamList = {
  Login: undefined;
};

export type HomeStackParamList = {
  HomePlaceholder: undefined;
  Settings: undefined;
  DatabaseInspector: undefined;
  SyncInspector: undefined;
  // 009-order-assembly: catalog routes now carry an optional inOrderId.
  // When present, the catalog and product-detail screens swap their
  // primary CTAs to "Adicionar ao pedido" and show a sticky summary bar.
  Catalog: { inOrderId?: string } | undefined;
  ProductDetail: { productId: string; inOrderId?: string };
  Clients: undefined;
  ClientForm: undefined;
  ClientProfile: { clientId: string };
  NewOrder: { clientId: string };
  // 009-order-assembly: nested stack for the three order-assembly screens.
  Orders: OrdersNavigatorParams;
  // 009-order-assembly: drafts-in-progress list, reached from Home.
  DraftsList: undefined;
  // 013-orders-overview: consolidated orders list (monthly + filters).
  OrdersOverview: undefined;
};

export type OrdersStackParamList = {
  OrderDraft:
    | { orderId: string; clientId?: undefined }
    | { orderId?: undefined; clientId: string };
  AddToOrder: { orderId: string; productId: string; variantId?: string };
  // 010-repeat-last-order: optional droppedNames surfaces items that were
  // skipped by the availability gate when the draft was cloned from a past
  // order. The summary renders a non-dismissable notice listing them.
  OrderSummary: { orderId: string; droppedNames?: string[] };
  // 011-order-email-delivery: terminal confirmation reached after the user
  // returns from the OS mail/share intent with a SENT outcome.
  OrderSent: {
    orderId: string;
    orderNumber: string;
    pdfPath: string;
    recipientEmail: string | null;
    clientId: string;
  };
  // 012-payment-receipts: three routes for the receipts sub-flow. Entry
  // point is the sent-status branch of OrderSummary (no new detail screen).
  OrderReceipts: { orderId: string };
  // correctionOf, when set, flips the form to createCorrection() and
  // pre-links the new receipt to the original.
  PaymentReceiptForm: { orderId: string; correctionOf?: string };
  PaymentReceiptDetail: { receiptId: string };
  // 013-orders-overview: read-only order detail reachable from three
  // entry points. `deepLinked: true` selects the full-screen tablet
  // layout; OrdersOverview's own tablet tap omits the flag and renders
  // the detail in its right pane instead of pushing here.
  OrderDetail: { orderId: string; deepLinked?: boolean };
};

export type OrdersNavigatorParams =
  | { screen: 'OrderDraft'; params: OrdersStackParamList['OrderDraft'] }
  | { screen: 'AddToOrder'; params: OrdersStackParamList['AddToOrder'] }
  | { screen: 'OrderSummary'; params: OrdersStackParamList['OrderSummary'] }
  | { screen: 'OrderSent'; params: OrdersStackParamList['OrderSent'] }
  | { screen: 'OrderReceipts'; params: OrdersStackParamList['OrderReceipts'] }
  | {
      screen: 'PaymentReceiptForm';
      params: OrdersStackParamList['PaymentReceiptForm'];
    }
  | {
      screen: 'PaymentReceiptDetail';
      params: OrdersStackParamList['PaymentReceiptDetail'];
    }
  | { screen: 'OrderDetail'; params: OrdersStackParamList['OrderDetail'] };

declare global {
  namespace ReactNavigation {
    // eslint-disable-next-line @typescript-eslint/no-empty-object-type
    interface RootParamList extends RootStackParamList {}
  }
}
