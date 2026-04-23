export type RootStackParamList = {
  Auth: undefined;
  Home: undefined;
  Relogin: { resolve: () => void; reject: () => void };
};

export type AuthStackParamList = {
  Login: undefined;
};

export type HomeStackParamList = {
  HomePlaceholder: undefined;
  Settings: undefined;
  DataLayerSmoke: undefined;
  DatabaseInspector: undefined;
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
};

export type OrdersNavigatorParams =
  | { screen: 'OrderDraft'; params: OrdersStackParamList['OrderDraft'] }
  | { screen: 'AddToOrder'; params: OrdersStackParamList['AddToOrder'] }
  | { screen: 'OrderSummary'; params: OrdersStackParamList['OrderSummary'] };

declare global {
  namespace ReactNavigation {
    // eslint-disable-next-line @typescript-eslint/no-empty-object-type
    interface RootParamList extends RootStackParamList {}
  }
}
