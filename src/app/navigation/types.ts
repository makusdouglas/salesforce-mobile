export type RootStackParamList = {
  Auth: undefined;
  Home: undefined;
};

export type AuthStackParamList = {
  AuthPlaceholder: undefined;
};

export type HomeStackParamList = {
  HomePlaceholder: undefined;
  DataLayerSmoke: undefined;
};

declare global {
  namespace ReactNavigation {
    // eslint-disable-next-line @typescript-eslint/no-empty-object-type
    interface RootParamList extends RootStackParamList {}
  }
}
