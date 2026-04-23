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
  Catalog: undefined;
  ProductDetail: { productId: string };
  Clients: undefined;
  ClientForm: undefined;
  ClientProfile: { clientId: string };
  NewOrder: { clientId: string };
};

declare global {
  namespace ReactNavigation {
    // eslint-disable-next-line @typescript-eslint/no-empty-object-type
    interface RootParamList extends RootStackParamList {}
  }
}
