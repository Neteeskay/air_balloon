export type LoginPayload = {
  login: string;
  password: string;
};

export type CurrentUser = {
  userId: string;
  displayName: string;
};

export type AuthResult = {
  ok: boolean;
  message: string;
  user?: CurrentUser;
};
