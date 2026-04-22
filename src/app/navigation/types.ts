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
  DataLayerSmoke: undefined;
  Catalog: undefined;
  ProductDetail: { productId: string };
};

declare global {
  namespace ReactNavigation {
    // eslint-disable-next-line @typescript-eslint/no-empty-object-type
    interface RootParamList extends RootStackParamList {}
  }
}
